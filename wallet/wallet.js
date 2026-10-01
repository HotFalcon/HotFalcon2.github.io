(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const STYLES = ['boardingPass', 'coupon', 'eventTicket', 'generic', 'storeCard'];
  const STYLE_NAMES = { boardingPass: 'Boarding pass', coupon: 'Coupon', eventTicket: 'Event ticket', generic: 'Generic', storeCard: 'Store card' };
  const IMAGE_NAMES = ['logo', 'icon', 'strip', 'thumbnail', 'background', 'footer'];
  const BARCODES = {
    PKBarcodeFormatQR: { fn: 'qrcode', cls: 'square', name: 'QR', opts: { eclevel: 'M' } },
    PKBarcodeFormatAztec: { fn: 'azteccode', cls: 'square', name: 'Aztec', opts: {} },
    PKBarcodeFormatPDF417: { fn: 'pdf417', cls: 'pdf417', name: 'PDF417', opts: { rowmult: 4 } },
    PKBarcodeFormatCode128: { fn: 'code128', cls: 'code128', name: 'Code 128', opts: { height: 10 } },
  };

  const fileInput = $('#file');
  const errorBox = $('#error');
  const content = $('#content');
  const emptyState = content.firstElementChild;
  const moreBtn = $('#moreBtn');
  const sheet = $('#sheet');
  const sheetBody = $('#sheetBody');
  const backdrop = $('#sheetBackdrop');
  const infoBox = $('#info');
  const langRow = $('#langRow');
  const langSelect = $('#lang');

  let passes = [];
  let current = 0;
  let objectUrls = [];

  class PassError extends Error {}

  // ---------- Reading the .pkpass (a zip archive) ----------

  async function inflate(data) {
    if (typeof DecompressionStream === 'undefined') {
      throw new PassError('This browser is too old to open .pkpass files. Try a current Chrome, Safari, Edge or Firefox.');
    }
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(buffer) {
    const u8 = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new PassError('This file isn’t a Wallet pass (it isn’t a .pkpass archive).');

    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const utf8 = new TextDecoder();
    const files = {};
    for (let i = 0; i < count && dv.getUint32(p, true) === 0x02014b50; i++) {
      const method = dv.getUint16(p + 10, true);
      const size = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = utf8.decode(u8.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith('/') || name.startsWith('__MACOSX/') || /(^|\/)\.DS_Store$/.test(name)) continue;
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const raw = u8.subarray(start, start + size);
      if (method === 0) files[name] = raw;
      else if (method === 8) files[name] = await inflate(raw);
    }
    return files;
  }

  // A .pkpasses bundle is a zip of .pkpass files, so this recurses.
  async function readArchive(buffer) {
    const files = await unzip(buffer);
    const names = Object.keys(files);
    const passJson = names.filter((n) => /(^|\/)pass\.json$/.test(n)).sort((a, b) => a.length - b.length)[0];
    if (passJson) return [bundleFromFiles(files, passJson.slice(0, -'pass.json'.length))];

    const inner = names.filter((n) => /\.pkpass$/i.test(n)).sort();
    if (!inner.length) throw new PassError('No pass.json was found inside this file, so it isn’t a Wallet pass.');
    const out = [];
    for (const n of inner) out.push(...await readArchive(files[n].slice().buffer));
    return out;
  }

  function bundleFromFiles(files, root) {
    const pass = parseJson(decodeText(files[root + 'pass.json']));
    if (!pass || typeof pass !== 'object') throw new PassError('pass.json is empty.');
    const langs = [...new Set(Object.keys(files)
      .filter((n) => n.startsWith(root))
      .map((n) => n.slice(root.length).match(/^([^/]+)\.lproj\//))
      .filter(Boolean)
      .map((m) => m[1]))].sort();
    return { pass, files, root, langs, lang: pickLang(langs), strings: {} };
  }

  function decodeText(bytes) {
    if (!bytes) return '';
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    if (bytes.length > 3 && bytes[1] === 0 && bytes[3] === 0) return new TextDecoder('utf-16le').decode(bytes);
    if (bytes.length > 3 && bytes[0] === 0 && bytes[2] === 0) return new TextDecoder('utf-16be').decode(bytes);
    return new TextDecoder().decode(bytes);
  }

  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      try {
        return JSON.parse(text.replace(/,\s*([}\]])/g, '$1'));
      } catch {
        throw new PassError('pass.json couldn’t be read: ' + e.message);
      }
    }
  }

  // Apple .strings files: "key" = "value"; with /* */ and // comments.
  function parseStrings(text) {
    const out = {};
    const n = text.length;
    let i = 0;
    const skip = () => {
      for (;;) {
        while (i < n && /\s/.test(text[i])) i++;
        if (text.startsWith('/*', i)) { const e = text.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; }
        else if (text.startsWith('//', i)) { const e = text.indexOf('\n', i); i = e < 0 ? n : e + 1; }
        else return;
      }
    };
    const readString = () => {
      let s = '';
      i++;
      while (i < n && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < n) {
          const c = text[++i];
          const hex = text.substr(i + 1, 4);
          if (c === 'n') s += '\n';
          else if (c === 't') s += '\t';
          else if (c === 'r') s += '\r';
          else if ((c === 'U' || c === 'u') && /^[0-9a-f]{4}$/i.test(hex)) { s += String.fromCharCode(parseInt(hex, 16)); i += 4; }
          else s += c;
        } else {
          s += text[i];
        }
        i++;
      }
      i++;
      return s;
    };
    const readToken = () => {
      const m = text.slice(i).match(/^[\w.$-]+/);
      if (!m) return null;
      i += m[0].length;
      return m[0];
    };
    while (i < n) {
      skip();
      if (i >= n) break;
      const key = text[i] === '"' ? readString() : readToken();
      if (key == null) { i++; continue; }
      skip();
      if (text[i] !== '=') continue;
      i++;
      skip();
      const value = text[i] === '"' ? readString() : readToken();
      if (value == null) continue;
      skip();
      if (text[i] === ';') i++;
      out[key] = value;
    }
    return out;
  }

  function pickLang(langs) {
    if (!langs.length) return null;
    const norm = (s) => s.toLowerCase().replace('_', '-');
    const wanted = (navigator.languages || [navigator.language || 'en'])
      .flatMap((l) => [norm(l), norm(l).split('-')[0]])
      .concat('en');
    for (const w of wanted) { const hit = langs.find((l) => norm(l) === w); if (hit) return hit; }
    for (const w of wanted) { const hit = langs.find((l) => norm(l).split('-')[0] === w); if (hit) return hit; }
    return langs[0];
  }

  // Localized images win over root images; @3x beats @2x beats 1x.
  function imageFor(b, name) {
    if (b.images) return b.images[name] || null;
    const dirs = [b.lang ? b.root + b.lang + '.lproj/' : null, b.root].filter((d) => d != null);
    for (const d of dirs) {
      for (const [suffix, scale] of [['@3x', 3], ['@2x', 2], ['', 1]]) {
        const f = b.files[d + name + suffix + '.png'];
        if (f) {
          const url = URL.createObjectURL(new Blob([f], { type: 'image/png' }));
          objectUrls.push(url);
          return { url, scale };
        }
      }
    }
    return null;
  }

  // ---------- Field values ----------

  const loc = (b, v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(b.strings, v) ? b.strings[v] : v);

  const DATE_STYLES = { PKDateStyleShort: 'short', PKDateStyleMedium: 'medium', PKDateStyleLong: 'long', PKDateStyleFull: 'full' };
  const isEnglish = /^en\b/i.test(navigator.language || 'en');

  function parseIso(s) {
    if (typeof s !== 'string') return null;
    const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i);
    if (!m) return null;
    const [, y, mo, d, h = '0', mi = '0', sec = '0', tz] = m;
    const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec);
    let instant;
    if (!tz) instant = new Date(+y, +mo - 1, +d, +h, +mi, +sec).getTime();
    else if (/z/i.test(tz)) instant = wall;
    else {
      const digits = tz.slice(1).replace(':', '');
      const offset = (+digits.slice(0, 2) * 60 + +(digits.slice(2) || 0)) * (tz[0] === '-' ? -1 : 1);
      instant = wall - offset * 60000;
    }
    return { instant: new Date(instant), wall: new Date(wall) };
  }

  function relativeDay(date, zone) {
    const key = (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    const diff = Math.round((Date.parse(key(date, zone)) - Date.parse(key(new Date()))) / 864e5);
    if (Math.abs(diff) > 1) return null;
    const s = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(diff, 'day');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatDate(value, f) {
    const p = parseIso(value);
    if (!p) return null;
    const ds = DATE_STYLES[f.dateStyle];
    let ts = DATE_STYLES[f.timeStyle];
    const zone = f.ignoresTimeZone ? 'UTC' : undefined;
    const date = f.ignoresTimeZone ? p.wall : p.instant;
    if (f.ignoresTimeZone && (ts === 'long' || ts === 'full')) ts = 'medium';
    if (!ds && !ts) return '';

    const rel = ds && f.isRelative ? relativeDay(date, zone) : null;
    const time = ts ? new Intl.DateTimeFormat(undefined, { timeStyle: ts, timeZone: zone }).format(date) : '';
    if (rel) return time ? rel + (isEnglish ? ' at ' : ', ') + time : rel;
    return new Intl.DateTimeFormat(undefined, { dateStyle: ds, timeStyle: ts, timeZone: zone }).format(date);
  }

  function spellOut(n) {
    if (!isEnglish || !Number.isInteger(n) || Math.abs(n) >= 1e15) return null;
    if (n === 0) return 'zero';
    const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
      'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const scales = ['', ' thousand', ' million', ' billion', ' trillion'];
    const chunk = (x) => {
      const words = [];
      if (x >= 100) { words.push(ones[Math.floor(x / 100)] + ' hundred'); x %= 100; }
      if (x >= 20) words.push(tens[Math.floor(x / 10)] + (x % 10 ? '-' + ones[x % 10] : ''));
      else if (x) words.push(ones[x]);
      return words.join(' ');
    };
    const parts = [];
    let x = Math.abs(n);
    for (let i = 0; x > 0; i++, x = Math.floor(x / 1000)) {
      if (x % 1000) parts.unshift(chunk(x % 1000) + scales[i]);
    }
    return (n < 0 ? 'minus ' : '') + parts.join(' ');
  }

  function formatNumber(n, f) {
    if (f.currencyCode) {
      try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: f.currencyCode }).format(n); } catch { /* bad code */ }
    }
    switch (f.numberStyle) {
      case 'PKNumberStylePercent': return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(n);
      case 'PKNumberStyleScientific': return new Intl.NumberFormat(undefined, { notation: 'scientific' }).format(n);
      case 'PKNumberStyleSpellOut': return spellOut(n) ?? new Intl.NumberFormat().format(n);
      default: return new Intl.NumberFormat(undefined, { maximumFractionDigits: 20 }).format(n);
    }
  }

  function formatValue(b, f) {
    const v = loc(b, f.value ?? '');
    if (f.dateStyle || f.timeStyle) {
      const d = formatDate(v, f);
      if (d != null) return d;
    }
    if (f.currencyCode || f.numberStyle) {
      const num = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && !isNaN(v) ? Number(v) : null);
      if (num != null) return formatNumber(num, f);
    }
    return String(v);
  }

  // ---------- Colors ----------

  function parseColor(s) {
    if (typeof s !== 'string') return null;
    const t = s.trim();
    let m = t.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i);
    if (m) return [m[1], m[2], m[3]].map((v) => Math.min(255, +v));
    m = t.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
    if (m) {
      const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
      return [0, 2, 4].map((k) => parseInt(h.substr(k, 2), 16));
    }
    return null;
  }
  const rgb = (c) => `rgb(${c.join(', ')})`;
  const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  // ---------- Building the front of the pass ----------

  const ALIGN = { PKTextAlignmentLeft: 'left', PKTextAlignmentCenter: 'center', PKTextAlignmentRight: 'right' };

  function fieldNode(b, f, natural) {
    const node = el('div', 'f al-' + (ALIGN[f.textAlignment] || natural));
    const label = loc(b, f.label);
    node.append(el('span', 'f-label', label != null && label !== '' ? String(label) : ' '));
    const value = el('span', 'f-value', formatValue(b, f));
    value.dir = 'auto';
    node.append(value);
    return node;
  }

  // Wallet spreads a row across the card: first field hugs the left edge, last hugs the right.
  function row(b, fields, extra) {
    const r = el('div', 'p-row' + (extra ? ' ' + extra : '') + (fields.length === 1 ? ' single' : ''));
    fields.forEach((f, i) => r.append(fieldNode(b, f, fields.length > 1 && i === fields.length - 1 ? 'right' : 'left')));
    return r;
  }

  function sizedImg(image, cls, maxW, maxH) {
    const node = el('img', cls);
    node.alt = '';
    node.onload = () => {
      const w = node.naturalWidth / image.scale;
      const h = node.naturalHeight / image.scale;
      const k = Math.min(1, maxW / w, maxH / h);
      node.style.width = w * k + 'px';
      node.style.height = h * k + 'px';
    };
    node.src = image.url;
    return node;
  }

  const TRANSIT = {
    PKTransitTypeAir: '<path transform="rotate(90 12 12)" d="M12 1.5c.9 0 1.5 1 1.5 2.3V9l8 4.6v2.1l-8-2.4v5l2.2 1.6v1.6L12 20.6l-3.7.9v-1.6l2.2-1.6v-5l-8 2.4v-2.1l8-4.6V3.8c0-1.3.6-2.3 1.5-2.3Z"/>',
    PKTransitTypeTrain: '<path fill-rule="evenodd" d="M7 2.5h10A3.5 3.5 0 0 1 20.5 6v9.5a3.5 3.5 0 0 1-2.9 3.5l1.9 2.5h-2.3l-1.7-2h-7l-1.7 2H4.5l1.9-2.5a3.5 3.5 0 0 1-2.9-3.5V6A3.5 3.5 0 0 1 7 2.5Zm-1 4V11h12V6.5Zm2 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/>',
    PKTransitTypeBus: '<path fill-rule="evenodd" d="M6 2.5h12A2.5 2.5 0 0 1 20.5 5v13a1.5 1.5 0 0 1-1.5 1.5V21h-2.5v-1.5h-9V21H5v-1.5A1.5 1.5 0 0 1 3.5 18V5A2.5 2.5 0 0 1 6 2.5ZM6 6v6h12V6Zm1.5 8.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm9 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"/>',
    PKTransitTypeBoat: '<path fill-rule="evenodd" d="M10.5 2.5h3v3h3.6l1 4.3 3.4 1.2-2.6 6.5H5.1L2.5 11l3.4-1.2 1-4.3h3.6Zm-1.9 5-.5 2.3 3.9-1.3 3.9 1.3-.5-2.3ZM2 19.5h20v1.6H2Z"/>',
    PKTransitTypeGeneric: '<path d="M3 10.8h13.6l-4.8-4.8 1.7-1.7 7.7 7.7-7.7 7.7-1.7-1.7 4.8-4.8H3Z"/>',
  };

  function transitIcon(type) {
    const wrap = el('div', 'p-transit');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<svg viewBox="0 0 24 24">' + (TRANSIT[type] || TRANSIT.PKTransitTypeGeneric) + '</svg>';
    return wrap;
  }

  function pickBarcode(pass) {
    const list = Array.isArray(pass.barcodes) && pass.barcodes.length ? pass.barcodes : (pass.barcode ? [pass.barcode] : []);
    return list.find((x) => x && BARCODES[x.format] && typeof x.message === 'string') || null;
  }

  function barcodeNode(b, bc, dim) {
    const spec = BARCODES[bc.format];
    const box = el('div', 'bc ' + spec.cls + (dim ? ' dim' : ''));
    try {
      const enc = String(bc.messageEncoding || 'iso-8859-1').toLowerCase();
      const latin = /^(iso-?8859-?1|latin-?1|windows-1252|cp1252|us-ascii|ascii)$/.test(enc) && !/[^\x00-\xff]/.test(bc.message);
      let svg = window.bwipjs[spec.fn]({ text: bc.message, binarytext: latin, ...spec.opts }, window.bwipjs.drawingSVG());
      if (spec.cls === 'code128') svg = svg.replace('<svg ', '<svg preserveAspectRatio="none" ');
      const image = el('img');
      image.alt = 'Barcode';
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      box.append(image);
    } catch {
      box.append(el('div', 'bc-error', 'This barcode couldn’t be drawn.'));
    }
    if (bc.altText) box.append(el('div', 'bc-alt', String(loc(b, bc.altText))));
    return box;
  }

  function withThumb(children, thumb) {
    const main = el('div', 'p-main');
    const col = el('div', 'p-col');
    col.append(...children);
    main.append(col);
    if (thumb) main.append(sizedImg(thumb, 'p-thumb', 90, 90));
    return main;
  }

  function stripBlock(b, strip, primary) {
    const box = el('div', strip ? 'p-strip' : 'p-strip p-strip-none');
    if (strip) {
      const image = el('img');
      image.alt = '';
      image.src = strip.url;
      box.append(image);
    }
    if (primary) {
      const sp = el('div', 'p-sprimary');
      sp.append(fieldNode(b, primary, 'left'));
      box.append(sp);
    }
    return box;
  }

  function primaryBlock(b, f) {
    const box = el('div', 'p-primary');
    box.append(fieldNode(b, f, 'left'));
    return box;
  }

  function renderPass(b, dim) {
    const pass = b.pass;
    const style = STYLES.find((s) => pass[s] && typeof pass[s] === 'object') || 'generic';
    const fields = pass[style] || {};
    const list = (k) => (Array.isArray(fields[k]) ? fields[k] : []).filter((f) => f && typeof f === 'object');
    const images = {};
    IMAGE_NAMES.forEach((n) => { images[n] = imageFor(b, n); });
    const barcode = pickBarcode(pass);
    const square = !!barcode && BARCODES[barcode.format].cls === 'square';

    const bgImage = style === 'eventTicket' && !images.strip ? images.background : null;
    const bg = parseColor(pass.backgroundColor) || (bgImage ? [40, 40, 40] : [255, 255, 255]);
    const fg = parseColor(pass.foregroundColor) || (luminance(bg) > 0.55 ? [0, 0, 0] : [255, 255, 255]);
    const lbl = parseColor(pass.labelColor) || fg;

    const card = el('article', 'pass ' + style);
    card.style.setProperty('--bg', rgb(bg));
    card.style.setProperty('--fg', rgb(fg));
    card.style.setProperty('--lbl', rgb(lbl));
    card.setAttribute('aria-label', String(loc(b, pass.description) || 'Wallet pass'));

    if (bgImage) {
      const layer = el('div', 'p-bgimg');
      layer.style.backgroundImage = `url("${bgImage.url}")`;
      card.append(layer);
    }

    const head = el('div', 'p-head');
    if (images.logo) head.append(sizedImg(images.logo, 'p-logo', 160, 50));
    const logoText = loc(b, pass.logoText);
    head.append(el('div', 'p-logotext', logoText != null ? String(logoText) : ''));
    const headerFields = list('headerFields').slice(0, 3);
    if (headerFields.length) {
      const hf = el('div', 'p-hfields');
      headerFields.forEach((f) => hf.append(fieldNode(b, f, 'right')));
      head.append(hf);
    }
    card.append(head);

    const primary = list('primaryFields');
    const secondary = list('secondaryFields');
    const auxiliary = list('auxiliaryFields');

    if (style === 'boardingPass') {
      const bp = el('div', 'p-bp');
      if (primary[0]) bp.append(fieldNode(b, primary[0], 'left'));
      if (primary[1]) bp.append(transitIcon(fields.transitType), fieldNode(b, primary[1], 'right'));
      card.append(bp);
      // Boarding passes show the auxiliary row above the secondary row.
      if (auxiliary.length) card.append(row(b, auxiliary.slice(0, 5), 'p-pad'));
      if (secondary.length) card.append(row(b, secondary.slice(0, 5), 'p-pad'));
    } else if (style === 'coupon' || style === 'storeCard') {
      if (images.strip || primary[0]) card.append(stripBlock(b, images.strip, primary[0]));
      if (square) {
        const both = secondary.concat(auxiliary).slice(0, 4);
        if (both.length) card.append(row(b, both, 'p-pad'));
      } else {
        if (secondary.length) card.append(row(b, secondary.slice(0, 4), 'p-pad'));
        if (auxiliary.length) card.append(row(b, auxiliary.slice(0, 4), 'p-pad'));
      }
    } else if (style === 'eventTicket') {
      const aux0 = auxiliary.filter((f) => f.row !== 1).slice(0, 4);
      const aux1 = auxiliary.filter((f) => f.row === 1).slice(0, 4);
      if (images.strip) {
        card.append(stripBlock(b, images.strip, primary[0]));
        if (secondary.length) card.append(row(b, secondary.slice(0, 4), 'p-pad'));
      } else {
        const top = [];
        if (primary[0]) top.push(primaryBlock(b, primary[0]));
        if (secondary.length) top.push(row(b, secondary.slice(0, 4)));
        card.append(withThumb(top, images.thumbnail));
      }
      if (aux0.length) card.append(row(b, aux0, 'p-pad'));
      if (aux1.length) card.append(row(b, aux1, 'p-pad'));
    } else {
      const top = [];
      if (primary[0]) top.push(primaryBlock(b, primary[0]));
      if (square) {
        const both = secondary.concat(auxiliary).slice(0, 4);
        if (both.length) top.push(row(b, both));
      } else if (secondary.length) {
        top.push(row(b, secondary.slice(0, 4)));
      }
      card.append(withThumb(top, images.thumbnail));
      if (!square && auxiliary.length) card.append(row(b, auxiliary.slice(0, 4), 'p-pad'));
    }

    const bottom = el('div', 'p-bottom');
    if (style === 'boardingPass' && images.footer) bottom.append(sizedImg(images.footer, 'p-footer', 286, 15));
    if (barcode) bottom.append(barcodeNode(b, barcode, dim));
    card.append(bottom);
    return card;
  }

  // ---------- Back of the pass ("Pass Details" sheet) ----------

  function safeHref(h) {
    return typeof h === 'string' && /^(https?:|mailto:|tel:)/i.test(h.trim()) ? h.trim() : null;
  }

  function link(text, href) {
    const a = el('a', null, text);
    a.href = href;
    if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  }

  // attributedValue may hold <a href> tags; everything else is reduced to text.
  function appendAttributed(target, html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const walk = (node) => node.childNodes.forEach((c) => {
      if (c.nodeType === Node.TEXT_NODE) target.append(c.textContent);
      else if (c.nodeType === Node.ELEMENT_NODE) {
        const href = c.tagName === 'A' && safeHref(c.getAttribute('href'));
        if (c.tagName === 'BR') target.append('\n');
        else if (href) target.append(link(c.textContent, href));
        else walk(c);
      }
    });
    walk(doc.body);
  }

  // Rough stand-in for iOS data detectors: links, emails, phone numbers.
  const DETECT = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+\.[^\s<>"']+|[\w.+-]+@[\w-]+\.[\w.-]+|(?<![\w+])(?:\+\d{1,3}(?:[\s.-]?\(?\d{1,4}\)?){2,5}|(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4})(?![\w-]))/g;

  function linkify(target, text) {
    let last = 0;
    for (const m of text.matchAll(DETECT)) {
      const t = m[0].replace(/[.,;:!?)\]]+$/, '');
      let href;
      if (/^https?:\/\//i.test(t)) href = t;
      else if (/^www\./i.test(t)) href = 'https://' + t;
      else if (t.includes('@')) href = 'mailto:' + t;
      else href = 'tel:' + t.replace(/[^\d+]/g, '');
      target.append(text.slice(last, m.index), link(t, href));
      last = m.index + t.length;
    }
    target.append(text.slice(last));
  }

  function backField(b, f) {
    const node = el('div', 'bf');
    const label = loc(b, f.label);
    if (label != null && label !== '') node.append(el('div', 'bf-label', String(label)));
    const value = el('div', 'bf-value');
    value.dir = 'auto';
    if (f.attributedValue != null && f.attributedValue !== '') appendAttributed(value, String(loc(b, f.attributedValue)));
    else linkify(value, formatValue(b, f));
    node.append(value);
    return node;
  }

  function switchRow(label, on) {
    const r = el('label', 'ios-row');
    r.append(el('span', null, label));
    const sw = el('span', 'ios-switch');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = on;
    input.setAttribute('role', 'switch');
    sw.append(input, el('span'));
    r.append(sw);
    return r;
  }

  function openSheet() {
    const b = passes[current];
    if (!b) return;
    const pass = b.pass;
    const style = STYLES.find((s) => pass[s] && typeof pass[s] === 'object') || 'generic';
    sheetBody.replaceChildren();

    const org = el('div', 'ios-org');
    const icon = imageFor(b, 'icon') || imageFor(b, 'logo');
    if (icon) {
      const i = el('img');
      i.alt = '';
      i.src = icon.url;
      org.append(i);
    } else {
      org.append(el('span', 'ios-org-ph'));
    }
    const names = el('div');
    names.append(el('strong', null, String(loc(b, pass.organizationName) || 'Wallet pass')));
    names.append(el('span', null, String(loc(b, pass.description) || STYLE_NAMES[style])));
    org.append(names);
    sheetBody.append(org);

    const toggles = el('div', 'ios-group');
    if (pass.webServiceURL) toggles.append(switchRow('Automatic Updates', true), switchRow('Allow Notifications', true));
    if (pass.relevantDate || (Array.isArray(pass.locations) && pass.locations.length) || (Array.isArray(pass.beacons) && pass.beacons.length)) {
      toggles.append(switchRow('Suggest on Lock Screen', true));
    }
    if (toggles.childElementCount) sheetBody.append(toggles);

    const back = (Array.isArray(pass[style] && pass[style].backFields) ? pass[style].backFields : []).filter((f) => f && typeof f === 'object');
    if (back.length) {
      const g = el('div', 'ios-group');
      back.forEach((f) => g.append(backField(b, f)));
      sheetBody.append(g);
    } else {
      sheetBody.append(el('p', 'ios-caption', 'This pass has no details on the back.'));
    }

    const g = el('div', 'ios-group');
    const remove = el('button', 'ios-row danger', 'Remove Pass');
    remove.type = 'button';
    remove.onclick = () => { closeSheet(); removeCurrent(); };
    g.append(remove);
    sheetBody.append(g);

    sheet.hidden = false;
    backdrop.hidden = false;
    sheetBody.scrollTop = 0;
    $('#sheetDone').focus();
  }

  function closeSheet() {
    if (sheet.hidden) return;
    sheet.hidden = true;
    backdrop.hidden = true;
    moreBtn.focus();
  }

  // ---------- Screen ----------

  function passStatus(pass) {
    if (pass.voided) return 'This pass has been voided.';
    const exp = parseIso(pass.expirationDate);
    if (exp && exp.instant < new Date()) {
      return 'This pass expired ' + new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(exp.instant) + '.';
    }
    return '';
  }

  function pager() {
    const p = el('div', 'w-pager');
    const prev = el('button', null, '‹');
    const next = el('button', null, '›');
    prev.type = next.type = 'button';
    prev.setAttribute('aria-label', 'Previous pass');
    next.setAttribute('aria-label', 'Next pass');
    prev.disabled = current === 0;
    next.disabled = current === passes.length - 1;
    prev.onclick = () => { current--; renderCurrent(); };
    next.onclick = () => { current++; renderCurrent(); };
    p.append(prev, el('span', null, `${current + 1} of ${passes.length}`), next);
    return p;
  }

  function renderInfo(b) {
    const p = b.pass;
    const style = STYLES.find((s) => p[s] && typeof p[s] === 'object') || 'generic';
    const bc = pickBarcode(p);
    const dateText = (s) => {
      const d = parseIso(s);
      return d ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d.instant) : null;
    };
    const rows = [
      ['Style', STYLE_NAMES[style]],
      ['Organization', loc(b, p.organizationName)],
      ['Description', loc(b, p.description)],
      ['Serial number', p.serialNumber],
      ['Pass type ID', p.passTypeIdentifier],
      ['Team ID', p.teamIdentifier],
      ['Barcode', bc ? `${BARCODES[bc.format].name} · ${bc.messageEncoding || 'iso-8859-1'}` : 'None'],
      ['Barcode data', bc && bc.message],
      ['Relevant date', dateText(p.relevantDate)],
      ['Expires', dateText(p.expirationDate)],
      ['Voided', p.voided ? 'Yes' : null],
      ['Locations', Array.isArray(p.locations) && p.locations.length ? String(p.locations.length) : null],
      ['Web service', p.webServiceURL],
      ['Languages', b.langs && b.langs.length ? b.langs.join(', ') : null],
      ['Signature', b.files ? (b.files[b.root + 'signature'] ? 'Present' : 'Missing (iPhone would reject this pass)') : null],
      ['Source', b.files ? null : 'Built-in sample'],
    ];
    const dl = $('#infoList');
    dl.replaceChildren();
    rows.forEach(([k, v]) => {
      if (v == null || v === '') return;
      dl.append(el('dt', null, k), el('dd', null, String(v)));
    });
    infoBox.hidden = false;
  }

  function renderLangs(b) {
    langRow.hidden = !(b.langs && b.langs.length > 1);
    if (langRow.hidden) return;
    let names = null;
    try { names = new Intl.DisplayNames(undefined, { type: 'language' }); } catch { /* unsupported */ }
    langSelect.replaceChildren(...b.langs.map((l) => {
      const o = el('option', null, (names && safeName(names, l)) || l);
      o.value = l;
      o.selected = l === b.lang;
      return o;
    }));
  }

  function safeName(names, code) {
    try { return names.of(code.replace('_', '-')); } catch { return null; }
  }

  function renderCurrent() {
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
    objectUrls = [];
    closeSheet();
    content.replaceChildren();
    const b = passes[current];
    if (!b) {
      content.append(emptyState);
      moreBtn.disabled = true;
      infoBox.hidden = true;
      langRow.hidden = true;
      return;
    }
    if (b.files) {
      const strings = b.lang && b.files[b.root + b.lang + '.lproj/pass.strings'];
      b.strings = strings ? parseStrings(decodeText(strings)) : {};
    }
    const status = passStatus(b.pass);
    if (status) content.append(el('p', 'w-note', status));
    const wrap = el('div', 'pass-wrap');
    wrap.append(renderPass(b, !!status));
    content.append(wrap);
    if (passes.length > 1) content.append(pager());
    content.scrollTop = 0;
    moreBtn.disabled = false;
    renderInfo(b);
    renderLangs(b);
  }

  function removeCurrent() {
    passes.splice(current, 1);
    current = Math.max(0, Math.min(current, passes.length - 1));
    if (!passes.length) markSample(null);
    renderCurrent();
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = !msg;
  }

  function revealPhone() {
    if (matchMedia('(max-width: 820px)').matches) $('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function openFile(file) {
    showError('');
    try {
      passes = await readArchive(await file.arrayBuffer());
      current = 0;
      markSample(null);
      renderCurrent();
      revealPhone();
    } catch (e) {
      if (!(e instanceof PassError)) console.error(e);
      showError(e instanceof PassError ? e.message : 'That file couldn’t be opened as a Wallet pass.');
    }
  }

  // ---------- Samples (fictional brands, drawn as SVG) ----------

  const svgUrl = (w, h, body) => 'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);

  function localIso(days, h, m) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}`;
  }

  const SAMPLES = [
    {
      name: 'Boarding pass',
      build: () => ({
        images: {
          logo: { scale: 1, url: svgUrl(34, 30, '<path d="M2 21c6-9 15-15 30-17-7 3-12 8-14 15-4-3-10-3-16 2Z" fill="#fff"/><path d="M14 21c3-2 7-3 12-2-4 1-7 4-8 8-1-3-2-5-4-6Z" fill="#8fc1ff"/>') },
          icon: { scale: 1, url: svgUrl(58, 58, '<rect width="58" height="58" fill="#123463"/><path d="M8 40c10-15 25-25 44-28-11 5-19 13-22 25-7-5-15-5-22 3Z" fill="#fff"/>') },
          footer: { scale: 1, url: svgUrl(286, 15, '<text x="143" y="11" text-anchor="middle" font-family="Helvetica,Arial" font-size="9" letter-spacing="2" fill="#8fc1ff">SKYPRIORITY · ZONE 3</text>') },
        },
        pass: {
          formatVersion: 1,
          passTypeIdentifier: 'pass.net.hotfalcon.sample.boarding',
          serialNumber: 'FA2741-14C',
          teamIdentifier: 'SAMPLE',
          organizationName: 'Falcon Air',
          description: 'Falcon Air boarding pass',
          logoText: 'Falcon Air',
          backgroundColor: 'rgb(18, 52, 99)',
          foregroundColor: 'rgb(255, 255, 255)',
          labelColor: 'rgb(143, 193, 255)',
          relevantDate: localIso(1, 7, 25),
          webServiceURL: 'https://example.com/passes/',
          barcodes: [{ format: 'PKBarcodeFormatPDF417', message: 'M1APPLESEED/JOHNNY    EFA2741 SFOJFKFA 2741 180Y014C0045 100', messageEncoding: 'iso-8859-1' }],
          boardingPass: {
            transitType: 'PKTransitTypeAir',
            headerFields: [{ key: 'gate', label: 'Gate', value: 'B22', changeMessage: 'Gate changed to %@' }],
            primaryFields: [
              { key: 'origin', label: 'San Francisco', value: 'SFO' },
              { key: 'destination', label: 'New York', value: 'JFK' },
            ],
            auxiliaryFields: [
              { key: 'boards', label: 'Boards', value: localIso(1, 7, 25), timeStyle: 'PKDateStyleShort' },
              { key: 'flight', label: 'Flight', value: 'FA 2741' },
              { key: 'group', label: 'Group', value: '3' },
              { key: 'seat', label: 'Seat', value: '14C' },
            ],
            secondaryFields: [
              { key: 'passenger', label: 'Passenger', value: 'Johnny Appleseed' },
              { key: 'departs', label: 'Departs', value: localIso(1, 8, 5), dateStyle: 'PKDateStyleMedium', isRelative: true },
            ],
            backFields: [
              { key: 'conf', label: 'Confirmation', value: 'K7QX2M' },
              { key: 'ff', label: 'Frequent flyer', value: 'FA 4402 1187' },
              { key: 'bags', label: 'Baggage', value: '1 carry-on and 1 personal item included.\nChecked bags can be added at the airport.' },
              { key: 'help', label: 'Need help?', value: 'Call (555) 010-2030 or visit https://example.com/help' },
            ],
          },
        },
      }),
    },
    {
      name: 'Event ticket',
      build: () => ({
        images: {
          logo: { scale: 1, url: svgUrl(30, 30, '<circle cx="15" cy="15" r="13" fill="none" stroke="#ffb45a" stroke-width="3"/><path d="M9 19 15 8l6 11Z" fill="#ffb45a"/>') },
          icon: { scale: 1, url: svgUrl(58, 58, '<rect width="58" height="58" fill="#1c1630"/><path d="M17 38 29 16l12 22Z" fill="#ffb45a"/>') },
          strip: {
            scale: 1,
            url: svgUrl(375, 98, '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#3b1d6e"/><stop offset=".55" stop-color="#b8326b"/><stop offset="1" stop-color="#f08a3c"/></linearGradient><radialGradient id="l" cx=".8" cy="0" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="375" height="98" fill="url(#g)"/><rect width="375" height="98" fill="url(#l)"/><path d="M0 98c40-22 70-30 110-14s80 6 120-10 90-6 145 8v16Z" fill="#0f0b1c" opacity=".55"/>'),
          },
        },
        pass: {
          formatVersion: 1,
          passTypeIdentifier: 'pass.net.hotfalcon.sample.event',
          serialNumber: 'SKY-58213-112F07',
          teamIdentifier: 'SAMPLE',
          organizationName: 'Skyline Arena',
          description: 'Ticket for The Night Owls at Skyline Arena',
          logoText: 'Skyline Arena',
          backgroundColor: 'rgb(28, 22, 48)',
          foregroundColor: 'rgb(255, 255, 255)',
          labelColor: 'rgb(255, 180, 90)',
          relevantDate: localIso(4, 19, 0),
          barcodes: [{ format: 'PKBarcodeFormatQR', message: 'SKY-EVT-58213-112-F-07', messageEncoding: 'iso-8859-1', altText: '58213 · 112F07' }],
          eventTicket: {
            headerFields: [{ key: 'doors', label: 'Doors', value: localIso(4, 19, 0), timeStyle: 'PKDateStyleShort' }],
            primaryFields: [{ key: 'event', label: 'Live in concert', value: 'The Night Owls' }],
            secondaryFields: [
              { key: 'section', label: 'Section', value: '112' },
              { key: 'row', label: 'Row', value: 'F' },
              { key: 'seat', label: 'Seat', value: '7' },
            ],
            auxiliaryFields: [
              { key: 'date', label: 'Date', value: localIso(4, 20, 0), dateStyle: 'PKDateStyleMedium', timeStyle: 'PKDateStyleShort' },
              { key: 'entry', label: 'Entrance', value: 'Gate C' },
            ],
            backFields: [
              { key: 'order', label: 'Order number', value: '58213-4471' },
              { key: 'venue', label: 'Venue', value: 'Skyline Arena\n100 Example Way, Springfield' },
              { key: 'policy', label: 'Bag policy', value: 'Clear bags up to 12" × 6" × 12" only. Small clutches are allowed.' },
              { key: 'web', label: 'Manage tickets', attributedValue: '<a href="https://example.com/tickets">Open my tickets</a>', value: 'https://example.com/tickets' },
            ],
          },
        },
      }),
    },
    {
      name: 'Store card',
      build: () => ({
        images: {
          logo: { scale: 1, url: svgUrl(30, 30, '<ellipse cx="15" cy="15" rx="9" ry="13" transform="rotate(30 15 15)" fill="#3c2415"/><path d="M11 5c6 6 2 14 8 20" stroke="#f4ece1" stroke-width="2" fill="none"/>') },
          icon: { scale: 1, url: svgUrl(58, 58, '<rect width="58" height="58" fill="#f4ece1"/><ellipse cx="29" cy="29" rx="13" ry="19" transform="rotate(30 29 29)" fill="#3c2415"/>') },
          strip: {
            scale: 1,
            url: svgUrl(375, 144, '<defs><linearGradient id="c" x1="0" x2="1"><stop offset="0" stop-color="#e9d6bd"/><stop offset="1" stop-color="#c79b6d"/></linearGradient></defs><rect width="375" height="144" fill="url(#c)"/><g fill="#3c2415" opacity=".18"><ellipse cx="300" cy="40" rx="16" ry="24" transform="rotate(30 300 40)"/><ellipse cx="345" cy="100" rx="14" ry="21" transform="rotate(-20 345 100)"/><ellipse cx="255" cy="115" rx="12" ry="18" transform="rotate(50 255 115)"/></g>'),
          },
        },
        pass: {
          formatVersion: 1,
          passTypeIdentifier: 'pass.net.hotfalcon.sample.store',
          serialNumber: 'BB-0042-7781',
          teamIdentifier: 'SAMPLE',
          organizationName: 'Bean & Brew',
          description: 'Bean & Brew rewards card',
          logoText: 'Bean & Brew',
          backgroundColor: 'rgb(244, 236, 225)',
          foregroundColor: 'rgb(60, 36, 21)',
          labelColor: 'rgb(140, 98, 66)',
          webServiceURL: 'https://example.com/passes/',
          barcodes: [{ format: 'PKBarcodeFormatAztec', message: 'BB00427781', messageEncoding: 'iso-8859-1', altText: '0042 7781' }],
          storeCard: {
            headerFields: [{ key: 'stars', label: 'Stars', value: 142 }],
            primaryFields: [{ key: 'balance', label: 'Balance', value: 24.5, currencyCode: 'USD' }],
            secondaryFields: [{ key: 'member', label: 'Member', value: 'Johnny Appleseed' }],
            auxiliaryFields: [
              { key: 'level', label: 'Level', value: 'Gold' },
              { key: 'since', label: 'Member since', value: '2021-03-14', dateStyle: 'PKDateStyleMedium' },
            ],
            backFields: [
              { key: 'rewards', label: 'Rewards', value: 'Earn 2 stars for every $1. 150 stars = a free drink of any size.' },
              { key: 'reload', label: 'Reload your card', value: 'https://example.com/reload' },
              { key: 'contact', label: 'Questions?', value: 'hello@example.com' },
            ],
          },
        },
      }),
    },
    {
      name: 'Coupon',
      build: () => ({
        images: {
          logo: { scale: 1, url: svgUrl(30, 30, '<path d="M15 3C7 9 6 19 15 27c9-8 8-18 0-24Z" fill="#c8f0d2"/><path d="M15 8v18" stroke="#207d48" stroke-width="2"/>') },
          icon: { scale: 1, url: svgUrl(58, 58, '<rect width="58" height="58" fill="#207d48"/><path d="M29 10c-12 9-14 24 0 38 14-14 12-29 0-38Z" fill="#c8f0d2"/>') },
          strip: {
            scale: 1,
            url: svgUrl(375, 144, '<rect width="375" height="144" fill="#2a9a5a"/><g fill="#c8f0d2" opacity=".16"><circle cx="300" cy="30" r="46"/><circle cx="360" cy="120" r="38"/><circle cx="230" cy="130" r="24"/></g>'),
          },
        },
        pass: {
          formatVersion: 1,
          passTypeIdentifier: 'pass.net.hotfalcon.sample.coupon',
          serialNumber: 'GG-FRESH20-4471',
          teamIdentifier: 'SAMPLE',
          organizationName: 'Green Grocer',
          description: 'Green Grocer coupon: 20% off produce',
          logoText: 'Green Grocer',
          backgroundColor: 'rgb(32, 125, 72)',
          foregroundColor: 'rgb(255, 255, 255)',
          labelColor: 'rgb(200, 240, 210)',
          expirationDate: localIso(14, 23, 59),
          barcodes: [{ format: 'PKBarcodeFormatCode128', message: 'GGFRESH204471', messageEncoding: 'iso-8859-1', altText: 'GGFRESH204471' }],
          coupon: {
            headerFields: [{ key: 'offer', label: 'Offer', value: 'Weekly' }],
            primaryFields: [{ key: 'discount', label: 'Off all produce', value: 0.2, numberStyle: 'PKNumberStylePercent' }],
            secondaryFields: [{ key: 'expires', label: 'Valid through', value: localIso(14, 23, 59), dateStyle: 'PKDateStyleMedium' }],
            auxiliaryFields: [{ key: 'code', label: 'Promo code', value: 'FRESH20' }],
            backFields: [
              { key: 'terms', label: 'Terms', value: 'One use per customer. Not valid with other offers. No cash value.' },
              { key: 'stores', label: 'Find a store', value: 'www.example.com/stores' },
            ],
          },
        },
      }),
    },
    {
      name: 'Membership',
      build: () => ({
        images: {
          logo: { scale: 1, url: svgUrl(30, 30, '<rect x="2" y="12" width="5" height="6" rx="1" fill="#ff453a"/><rect x="23" y="12" width="5" height="6" rx="1" fill="#ff453a"/><rect x="6" y="9" width="4" height="12" rx="1" fill="#fff"/><rect x="20" y="9" width="4" height="12" rx="1" fill="#fff"/><rect x="10" y="14" width="10" height="2" fill="#fff"/>') },
          icon: { scale: 1, url: svgUrl(58, 58, '<rect width="58" height="58" fill="#141416"/><rect x="12" y="20" width="8" height="18" rx="2" fill="#fff"/><rect x="38" y="20" width="8" height="18" rx="2" fill="#fff"/><rect x="20" y="27" width="18" height="4" fill="#fff"/>') },
          thumbnail: { scale: 1, url: svgUrl(80, 80, '<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b5e"/><stop offset="1" stop-color="#b3261e"/></linearGradient></defs><circle cx="40" cy="40" r="40" fill="url(#a)"/><text x="40" y="51" text-anchor="middle" font-family="Helvetica,Arial" font-size="30" font-weight="700" fill="#fff">JA</text>') },
        },
        pass: {
          formatVersion: 1,
          passTypeIdentifier: 'pass.net.hotfalcon.sample.generic',
          serialNumber: 'FF-209-3381',
          teamIdentifier: 'SAMPLE',
          organizationName: 'Falcon Fitness',
          description: 'Falcon Fitness membership card',
          logoText: 'Falcon Fitness',
          backgroundColor: 'rgb(20, 20, 22)',
          foregroundColor: 'rgb(255, 255, 255)',
          labelColor: 'rgb(255, 69, 58)',
          barcodes: [{ format: 'PKBarcodeFormatQR', message: 'FF2093381', messageEncoding: 'iso-8859-1', altText: 'FF-209-3381' }],
          generic: {
            headerFields: [{ key: 'tier', label: 'Tier', value: 'Gold' }],
            primaryFields: [{ key: 'member', label: 'Member', value: 'Johnny Appleseed' }],
            secondaryFields: [{ key: 'plan', label: 'Plan', value: 'All Access' }],
            auxiliaryFields: [{ key: 'since', label: 'Member since', value: '2022-01-10', dateStyle: 'PKDateStyleMedium' }],
            backFields: [
              { key: 'id', label: 'Member ID', value: 'FF-209-3381' },
              { key: 'club', label: 'Home club', value: 'Downtown' },
              { key: 'hours', label: 'Club hours', value: 'Mon–Fri 5 AM – 11 PM\nSat–Sun 7 AM – 9 PM' },
              { key: 'guest', label: 'Guest passes', value: 'You have 2 guest passes left this month.' },
              { key: 'phone', label: 'Front desk', value: '+1 555 010 4477' },
            ],
          },
        },
      }),
    },
  ];

  const sampleBox = $('#samples');
  SAMPLES.forEach((s, i) => {
    const chip = el('button', 'chip', s.name);
    chip.type = 'button';
    chip.dataset.index = i;
    chip.setAttribute('aria-pressed', 'false');
    chip.onclick = () => {
      showError('');
      const built = s.build();
      passes = [{ ...built, strings: {}, langs: [], lang: null, files: null }];
      current = 0;
      markSample(i);
      renderCurrent();
      revealPhone();
    };
    sampleBox.append(chip);
  });

  function markSample(index) {
    sampleBox.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(+c.dataset.index === index)));
  }

  // ---------- Wiring ----------

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (f) openFile(f);
    fileInput.value = '';
  });

  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    dragDepth++;
    document.body.classList.add('dragging');
  });
  window.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) document.body.classList.remove('dragging');
  });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('dragging');
    const f = e.dataTransfer.files[0];
    if (f) openFile(f);
  });

  langSelect.addEventListener('change', () => {
    const b = passes[current];
    if (!b) return;
    b.lang = langSelect.value;
    renderCurrent();
  });

  moreBtn.addEventListener('click', openSheet);
  $('#sheetDone').addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  function fitDevice() {
    const scale = innerWidth > 520 ? Math.max(0.6, Math.min(1, (innerHeight - 32) / 868)) : 1;
    document.documentElement.style.setProperty('--device-scale', scale.toFixed(3));
  }
  addEventListener('resize', fitDevice);
  fitDevice();

  function tick() {
    $('#sbTime').textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
  }
  tick();
  setInterval(tick, 30000);
})();
