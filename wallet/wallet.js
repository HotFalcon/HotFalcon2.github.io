(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const STYLES = ['boardingPass', 'coupon', 'eventTicket', 'generic', 'storeCard'];
  const STYLE_NAMES = { boardingPass: 'Boarding pass', coupon: 'Coupon', eventTicket: 'Event ticket', generic: 'Generic', storeCard: 'Store card' };
  const IMAGE_NAMES = ['logo', 'icon', 'strip', 'thumbnail', 'background', 'footer'];
  const BARCODES = {
    PKBarcodeFormatQR: { fn: 'qrcode', cls: 'square', name: 'QR', opts: { eclevel: 'M' } },
    PKBarcodeFormatAztec: { fn: 'azteccode', cls: 'square', name: 'Aztec', opts: {} },
    PKBarcodeFormatPDF417: { fn: 'pdf417', cls: 'pdf417', name: 'PDF417', opts: { rowmult: 4 } },
    PKBarcodeFormatCode128: { fn: 'code128', cls: 'code128', name: 'Code 128', opts: { height: 10 } },
  };
  const styleOf = (pass) => STYLES.find((s) => pass[s] && typeof pass[s] === 'object') || 'generic';
  // This is a visual presentation of the imported pass, never an NFC session.
  const hasContactless = (b) => styleOf(b.pass) === 'eventTicket' && !!b.original.nfc && !passMark(b) && !b.pass.voided;

  const screen = $('#screen');
  const scroller = $('#content');
  const stack = $('#stack');
  const emptyState = $('#empty');
  const fileInput = $('#file');
  const restoreInput = $('#restoreFile');
  const errorBox = $('#error');
  const sheet = $('#sheet');
  const sheetBody = $('#sheetBody');
  const editor = $('#editor');
  const editorBody = $('#editorBody');
  const backdrop = $('#sheetBackdrop');
  const asheet = $('#asheet');
  const asBackdrop = $('#asBackdrop');
  const infoBox = $('#info');
  const langRow = $('#langRow');
  const langSelect = $('#lang');
  const toastBox = $('#toast');

  let items = [];       // { entry, parsed, b, wrap, y }
  let openItem = null;

  class PassError extends Error {}

  // ---------- Reading .pkpass files (zip archives) ----------

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
    if (eocd < 0) throw new PassError('isn’t a Wallet pass.');

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

  // Returns one { bytes, files, root } per pass; a .pkpasses bundle holds several.
  async function readArchive(buffer) {
    const files = await unzip(buffer);
    const names = Object.keys(files);
    const passJson = names.filter((n) => /(^|\/)pass\.json$/.test(n)).sort((a, b) => a.length - b.length)[0];
    if (passJson) return [{ bytes: buffer, files, root: passJson.slice(0, -'pass.json'.length) }];

    const inner = names.filter((n) => /\.pkpass$/i.test(n)).sort();
    if (!inner.length) throw new PassError('has no pass.json, so it isn’t a Wallet pass.');
    const out = [];
    for (const n of inner) out.push(...await readArchive(files[n].slice().buffer));
    return out;
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
        throw new PassError('has a pass.json that couldn’t be read.');
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

  // Compares every file with the SHA hashes in manifest.json. Wallet refuses passes that fail this.
  async function verify(files, root) {
    const manifestBytes = files[root + 'manifest.json'];
    if (!manifestBytes || !files[root + 'signature']) return 'unsigned';
    let manifest;
    try { manifest = JSON.parse(decodeText(manifestBytes)); } catch { return 'modified'; }
    if (!manifest || typeof manifest !== 'object' || !manifest['pass.json']) return 'modified';
    if (!(crypto.subtle && crypto.subtle.digest)) return 'ok';
    const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
    const listed = new Set(Object.keys(manifest));
    for (const name of Object.keys(files)) {
      if (!name.startsWith(root)) continue;
      const rel = name.slice(root.length);
      if (rel === 'manifest.json' || rel === 'signature') continue;
      const want = String(manifest[rel] || '').toLowerCase();
      if (!want) return 'modified';
      const got = hex(await crypto.subtle.digest(want.length === 64 ? 'SHA-256' : 'SHA-1', files[name]));
      if (got !== want) return 'modified';
      listed.delete(rel);
    }
    return listed.size ? 'modified' : 'ok';
  }

  // ---------- Field values ----------

  const loc = (b, v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(b.strings, v) ? b.strings[v] : v);

  const DATE_STYLES = { PKDateStyleShort: 'short', PKDateStyleMedium: 'medium', PKDateStyleLong: 'long', PKDateStyleFull: 'full' };
  const isEnglish = /^en\b/i.test(navigator.language || 'en');
  const mediumDate = (d) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);

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

  // The date used to sort the collection: relevant date, then the first date field.
  function passDate(pass) {
    const style = styleOf(pass);
    const cands = [pass.relevantDate];
    if (Array.isArray(pass.relevantDates) && pass.relevantDates[0]) cands.push(pass.relevantDates[0].startDate || pass.relevantDates[0].date);
    for (const k of ['primaryFields', 'secondaryFields', 'auxiliaryFields', 'headerFields']) {
      const list = pass[style] && Array.isArray(pass[style][k]) ? pass[style][k] : [];
      list.forEach((f) => { if (f && (f.dateStyle || f.timeStyle)) cands.push(f.value); });
    }
    cands.push(pass.expirationDate);
    for (const c of cands) {
      const d = parseIso(c);
      if (d) return d.instant.getTime();
    }
    return 0;
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
  const toHex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  function passColors(pass, hasBgImage) {
    const bg = parseColor(pass.backgroundColor) || (hasBgImage ? [40, 40, 40] : [255, 255, 255]);
    const fg = parseColor(pass.foregroundColor) || (luminance(bg) > 0.55 ? [0, 0, 0] : [255, 255, 255]);
    return { bg, fg, lbl: parseColor(pass.labelColor) || fg };
  }

  // ---------- Images ----------

  // Edited images win, then localized images, then root images; @3x beats @2x beats 1x.
  function imageFor(b, name) {
    if (b.editImages && name in b.editImages) {
      const blob = b.editImages[name];
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      b.urls.push(url);
      return { url, scale: 2 };
    }
    if (b.images) return b.images[name] || null;
    if (!b.files) return null;
    const dirs = [b.lang ? b.root + b.lang + '.lproj/' : null, b.root].filter((d) => d != null);
    for (const d of dirs) {
      for (const [suffix, scale] of [['@3x', 3], ['@2x', 2], ['', 1]]) {
        const f = b.files[d + name + suffix + '.png'];
        if (f) {
          const url = URL.createObjectURL(new Blob([f], { type: 'image/png' }));
          b.urls.push(url);
          return { url, scale };
        }
      }
    }
    return null;
  }

  // Uploaded photos are scaled down before saving so the collection stays small.
  const IMAGE_MAX = { logo: [320, 100], icon: [116, 116], strip: [1125, 432], thumbnail: [180, 180], background: [360, 440], footer: [572, 30] };

  async function shrinkImage(file, name) {
    try {
      const bmp = await createImageBitmap(file);
      const [mw, mh] = IMAGE_MAX[name];
      const k = name === 'strip' || name === 'background'
        ? Math.min(1, Math.max(mw / bmp.width, mh / bmp.height))
        : Math.min(1, mw / bmp.width, mh / bmp.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.width * k));
      canvas.height = Math.max(1, Math.round(bmp.height * k));
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const photo = name === 'strip' || name === 'background';
      return await new Promise((r) => canvas.toBlob((blob) => r(blob || file), photo ? 'image/jpeg' : 'image/png', 0.88));
    } catch {
      return file;
    }
  }

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
    node.draggable = false;
    node.onload = () => {
      const w = node.naturalWidth / image.scale;
      const h = node.naturalHeight / image.scale;
      const k = Math.min(1, maxW / w, maxH / h);
      node.style.width = w * k + 'px';
      node.style.height = h * k + 'px';
      requestAnimationFrame(layout);
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
      image.draggable = false;
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      box.append(image);
    } catch {
      box.append(el('div', 'bc-error', 'This barcode couldn’t be drawn.'));
    }
    if (bc.altText) box.append(el('div', 'bc-alt', String(loc(b, bc.altText))));
    return box;
  }

  const MARK_ICONS = {
    unverified: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z"/><path d="M12 8v5m0 3v.1"/></svg>',
  };

  // Files that fail verification keep their barcodes hidden, even when edited.
  function passMark(b) {
    if (b.status === 'modified' || b.status === 'unsigned') return ['unverified', 'Unverified pass', 'Barcode hidden · not signed by its issuer'];
    return null;
  }

  function markNode([icon, title, detail]) {
    const box = el('div', 'keepsake');
    box.innerHTML = MARK_ICONS[icon];
    const text = el('div');
    text.append(el('strong', null, title), el('span', null, detail));
    box.append(text);
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
      image.draggable = false;
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

  function renderPass(b) {
    const pass = b.pass;
    const style = styleOf(pass);
    const fields = pass[style] || {};
    const list = (k) => (Array.isArray(fields[k]) ? fields[k] : []).filter((f) => f && typeof f === 'object');
    const images = {};
    IMAGE_NAMES.forEach((n) => { images[n] = imageFor(b, n); });
    const barcode = pickBarcode(pass);
    const square = !!barcode && BARCODES[barcode.format].cls === 'square';

    const bgImage = style === 'eventTicket' && !images.strip ? images.background : null;
    const { bg, fg, lbl } = passColors(pass, !!bgImage);

    const card = el('article', 'pass ' + style);
    card.classList.toggle('contactless', hasContactless(b));
    card.style.setProperty('--bg', rgb(bg));
    card.style.setProperty('--fg', rgb(fg));
    card.style.setProperty('--lbl', rgb(lbl));

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
        if (secondary.length) card.append(row(b, secondary.slice(0, 4), 'p-pad p-event-secondary'));
      } else {
        const top = [];
        if (primary[0]) top.push(primaryBlock(b, primary[0]));
        if (secondary.length) top.push(row(b, secondary.slice(0, 4)));
        card.append(withThumb(top, images.thumbnail));
      }
      if (aux0.length) card.append(row(b, aux0, 'p-pad p-event-seats'));
      if (aux1.length) card.append(row(b, aux1, 'p-pad p-event-extra'));
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
    const mark = passMark(b);
    if (mark) bottom.append(markNode(mark));
    else if (barcode) bottom.append(barcodeNode(b, barcode, !!pass.voided));
    if (hasContactless(b)) {
      const contactless = el('div', 'p-contactless');
      if (images.icon) contactless.append(sizedImg(images.icon, 'p-app-icon', 20, 20));
      const waves = el('span', 'p-contactless-symbol');
      waves.setAttribute('aria-label', 'Contactless pass');
      waves.innerHTML = '<svg viewBox="0 0 24 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 11a7 7 0 0 1 0 6M9 8a13 13 0 0 1 0 12M13 5a19 19 0 0 1 0 18M17 2a25 25 0 0 1 0 24"/></svg>';
      contactless.append(waves);
      bottom.append(contactless);
    }
    card.append(bottom);
    return card;
  }

  // ---------- Storage (IndexedDB, so the collection survives reloads) ----------

  const store = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('hotfalcon-wallet', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('passes', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const run = async (mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const tx = db.transaction('passes', mode);
        const req = fn(tx.objectStore('passes'));
        tx.oncomplete = () => res(req && req.result);
        tx.onerror = tx.onabort = () => rej(tx.error);
      });
    };
    return {
      all: () => run('readonly', (s) => s.getAll()),
      put: (e) => run('readwrite', (s) => s.put(e)),
      del: (id) => run('readwrite', (s) => s.delete(id)),
    };
  })();

  let canSave = true;
  async function persist(entry) {
    try {
      await store.put(entry);
    } catch (e) {
      console.error(e);
      if (canSave) { canSave = false; toast('This browser can’t save passes'); }
    }
  }
  async function unpersist(id) {
    try { await store.del(id); } catch (e) { console.error(e); }
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

  // ---------- Collection ----------

  // A pass as shown: the original (from the file or sample) with any saved edits on top.
  function makeBundle(entry, parsed) {
    let b;
    if (entry.source === 'sample') {
      const s = SAMPLES[entry.sample];
      if (!s) throw new Error('Unknown sample');
      b = { ...s.build(), files: null, root: '', langs: [], lang: null, status: 'sample' };
    } else {
      const pass = parseJson(decodeText(parsed.files[parsed.root + 'pass.json']));
      if (!pass || typeof pass !== 'object') throw new PassError('has an empty pass.json.');
      const langs = [...new Set(Object.keys(parsed.files)
        .filter((n) => n.startsWith(parsed.root))
        .map((n) => n.slice(parsed.root.length).match(/^([^/]+)\.lproj\//))
        .filter(Boolean)
        .map((m) => m[1]))].sort();
      b = {
        pass, files: parsed.files, root: parsed.root, langs, status: parsed.status,
        lang: entry.lang && langs.includes(entry.lang) ? entry.lang : pickLang(langs),
      };
    }
    b.original = b.pass;
    b.edited = !!entry.edit;
    if (entry.edit) {
      b.pass = entry.edit.pass;
      b.editImages = entry.edit.images || {};
      b.editedAt = entry.edit.at;
    }
    const strings = b.files && b.lang && b.files[b.root + b.lang + '.lproj/pass.strings'];
    b.strings = strings ? parseStrings(decodeText(strings)) : {};
    b.urls = [];
    return b;
  }

  async function makeItem(entry) {
    const it = { entry, parsed: null, b: null, wrap: null, y: 0 };
    if (entry.source !== 'sample') {
      const [parsed] = await readArchive(entry.bytes);
      parsed.status = await verify(parsed.files, parsed.root);
      it.parsed = parsed;
    }
    it.b = makeBundle(entry, it.parsed);
    renderCard(it);
    return it;
  }

  function rebuild(it, flash) {
    it.b.urls.forEach((u) => URL.revokeObjectURL(u));
    it.b = makeBundle(it.entry, it.parsed);
    renderCard(it);
    if (flash) it.wrap.firstChild.classList.add('refresh');
  }

  const sortKey = (it) => passDate(it.b.pass) || it.entry.added;
  function sortItems() {
    items.sort((a, b) => sortKey(b) - sortKey(a) || b.entry.added - a.entry.added);
  }

  function describe(b) {
    return [loc(b, b.pass.organizationName), loc(b, b.pass.description)].filter(Boolean).join(', ') || 'Wallet pass';
  }

  function renderCard(it) {
    if (!it.wrap) {
      const wrap = el('div', 'w-card');
      wrap.setAttribute('role', 'button');
      wrap.tabIndex = 0;
      wrap.addEventListener('click', () => onCardTap(it));
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardTap(it); }
      });
      it.wrap = wrap;
    }
    const inner = el('div', 'pass-wrap');
    inner.append(renderPass(it.b));
    it.wrap.replaceChildren(inner);
    it.wrap.setAttribute('aria-label', describe(it.b));
  }

  // Adds entries to the collection and slides their cards in from below.
  async function addEntries(entries) {
    const fresh = [];
    const failed = [];
    for (const entry of entries) {
      try {
        const it = await makeItem(entry);
        const same = items.find((x) => x.entry.id === entry.id);
        if (same) dropItem(same);
        items.push(it);
        fresh.push(it);
        await persist(entry);
      } catch (e) {
        failed.push(e);
        if (!(e instanceof PassError)) console.error(e);
      }
    }
    if (fresh.length && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    sortItems();
    mount(fresh);
    return { fresh, failed };
  }

  function dropItem(it) {
    it.b.urls.forEach((u) => URL.revokeObjectURL(u));
    it.wrap.remove();
    items = items.filter((x) => x !== it);
    if (openItem === it) openItem = null;
  }

  // ---------- The stack ----------

  // Group by original issuer metadata so display edits do not move a pass.
  // Samples never join imported passes, even when their styles match.
  function swipeGroupKey(it) {
    if (it.entry.source === 'sample') return JSON.stringify(['sample', it.entry.sample]);
    const pass = it.b.original;
    const style = styleOf(pass);
    const issuer = pass.passTypeIdentifier || pass.organizationName || it.entry.id;
    let group = ['issuer'];
    if (typeof pass.groupingIdentifier === 'string' && pass.groupingIdentifier.trim()) {
      group = ['group', pass.groupingIdentifier];
    } else if (style === 'eventTicket') {
      const event = pass.semantics?.eventName || pass.description;
      const date = passDate(pass);
      // Without an event name and date, keep unrelated tickets separate.
      group = event && date ? ['event', event, date] : ['pass', pass.serialNumber || it.entry.id];
    }
    return JSON.stringify(['file', style, issuer, ...group]);
  }

  function swipeItems() {
    if (!openItem) return [];
    const key = swipeGroupKey(openItem);
    return items.filter((it) => swipeGroupKey(it) === key);
  }

  const PEEK = 62;
  const dots = el('div', 'w-dots');
  dots.setAttribute('aria-hidden', 'true');
  const reader = el('div', 'w-reader');
  reader.hidden = true;
  reader.setAttribute('aria-label', 'Hold Near Reader animation preview. This website does not transmit NFC.');
  reader.innerHTML = '<svg viewBox="0 0 72 72" aria-hidden="true"><defs><clipPath id="reader-circle"><circle cx="36" cy="36" r="30"/></clipPath></defs><g clip-path="url(#reader-circle)"><g class="reader-phone"><rect x="22" y="25" width="28" height="49" rx="5" fill="#08477f" stroke="currentColor" stroke-width="1.5"/><path d="M23 43 49 63v10H23Z" fill="#002d55"/><path d="M33 28h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></g></g><circle class="reader-ring" cx="36" cy="36" r="30" fill="none" stroke="currentColor" stroke-width="4"/></svg><span aria-hidden="true">Hold Near Reader</span>';
  const place = (it, x, y) => { it.wrap.style.transform = `translate3d(${x}px, ${y}px, 0)`; };

  let readerRestartTimer = 0;
  function restartReader() {
    clearTimeout(readerRestartTimer);
    reader.classList.remove('is-restarting');
    if (reader.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    reader.classList.add('is-restarting');
    readerRestartTimer = setTimeout(() => {
      reader.querySelectorAll('.reader-phone, .reader-ring').forEach((node) => {
        node.getAnimations().forEach((animation) => { animation.currentTime = 0; });
      });
      reader.classList.remove('is-restarting');
    }, 300);
  }

  // Fit full values to the available row before allowing wrapping on narrow screens.
  function fitContactlessFields() {
    stack.querySelectorAll('.contactless .f-value').forEach((node) => {
      node.style.fontSize = '';
      node.style.whiteSpace = '';
      const initial = parseFloat(getComputedStyle(node).fontSize);
      let size = initial;
      while (node.scrollWidth > node.clientWidth + 1 && size > initial * .78) {
        size -= .25;
        node.style.fontSize = size + 'px';
      }
      if (node.scrollWidth > node.clientWidth + 1) node.style.whiteSpace = 'normal';
    });
  }

  function layout() {
    const n = items.length;
    emptyState.hidden = n > 0;
    stack.hidden = n === 0;
    if (dots.parentNode !== stack) stack.append(dots);
    if (reader.parentNode !== stack) stack.append(reader);
    const contactless = !!openItem && hasContactless(openItem.b);
    screen.classList.toggle('is-reader', contactless);
    reader.hidden = !contactless;
    if (!n) return;
    const pages = swipeItems();
    const pageIndex = pages.indexOf(openItem);
    items.forEach((it) => it.wrap.classList.toggle('is-parked', !!openItem && !pages.includes(it)));
    fitContactlessFields();
    const base = scroller.scrollTop - stack.offsetTop;
    const viewH = scroller.clientHeight;
    const pileStart = openItem ? Math.max(base + viewH - 82, base + 10 + openItem.wrap.offsetHeight + (contactless ? 185 : 50)) : 0;
    let pile = 0;
    items.forEach((it, i) => {
      let y;
      let z;
      let x = 0;
      if (!openItem) { y = i * PEEK; z = i + 1; }
      else if (it === openItem) { y = base + 10; z = 900; }
      else if (pages.includes(it)) {
        const offset = pages.indexOf(it) - pageIndex;
        x = offset * pageWidth();
        y = base + 10;
        z = 899 - Math.abs(offset);
      }
      // Unrelated passes stay in the lower stack, outside the swipe group.
      else {
        y = pileStart + Math.min(pile, 3) * 10;
        z = 100 + pile;
        pile++;
      }
      it.y = y;
      place(it, x, y);
      it.wrap.style.zIndex = z;
    });
    syncOpenState();
    if (contactless) reader.style.transform = `translate3d(0, ${openItem.y + openItem.wrap.offsetHeight + 46}px, 0)`;
    if (openItem) stack.style.height = Math.max(
      openItem.y + openItem.wrap.offsetHeight + (contactless ? 165 : 40),
      pile ? pileStart + Math.min(pile - 1, 3) * 10 + 80 : 0,
    ) + 'px';
    if (!openItem) stack.style.height = (n - 1) * PEEK + items[n - 1].wrap.offsetHeight + 'px';
  }

  function syncOpenState() {
    items.forEach((it) => {
      it.wrap.classList.toggle('is-open', it === openItem);
      it.wrap.tabIndex = !openItem || it === openItem || it.wrap.classList.contains('is-parked') ? 0 : -1;
      it.wrap.setAttribute('aria-expanded', String(it === openItem));
    });
    renderDots();
  }

  // iOS-style page dots under an open pass; long collections show a sliding window of 9.
  function renderDots() {
    const pages = swipeItems();
    const n = pages.length;
    const show = !!openItem && n > 1;
    dots.classList.toggle('show', show);
    if (!show) return;
    const idx = pages.indexOf(openItem);
    const MAX = 9;
    const start = n <= MAX ? 0 : Math.min(Math.max(0, idx - 4), n - MAX);
    const end = Math.min(n, start + MAX);
    const nodes = [];
    for (let i = start; i < end; i++) {
      const d = el('i');
      if (i === idx) d.className = 'on';
      else if ((i === start && start > 0) || (i === end - 1 && end < n)) d.className = 'small';
      nodes.push(d);
    }
    dots.replaceChildren(...nodes);
    dots.style.transform = `translate3d(0, ${openItem.y + openItem.wrap.offsetHeight + 16}px, 0)`;
  }

  // Cards are ordered by z-index, so new ones are only appended; moving nodes would cancel their transitions.
  async function mount(fresh) {
    const viewH = scroller.clientHeight;
    const base = scroller.scrollTop - stack.offsetTop;
    fresh.forEach((it) => {
      it.wrap.classList.add('no-anim');
      it.wrap.style.transform = `translate3d(0, ${base + viewH + 60}px, 0)`;
      stack.append(it.wrap);
    });
    if (fresh.length) {
      await nextFrame();
      fresh.forEach((it, i) => {
        it.wrap.classList.remove('no-anim');
        it.wrap.style.transitionDelay = Math.min(i, 8) * 45 + 'ms';
      });
    }
    layout();
    updatePanel();
    if (fresh.length) {
      await wait(900);
      fresh.forEach((it) => { it.wrap.style.transitionDelay = ''; });
    }
  }

  function onCardTap(it) {
    if (suppressClick) return;
    if (!openItem) openPass(it);
    else if (it !== openItem) {
      const pages = swipeItems();
      const offset = pages.indexOf(it) - pages.indexOf(openItem);
      if (pages.includes(it) && hasContactless(openItem.b) && Math.abs(offset) === 1) pageTo(offset);
      else openPass(it);
    }
    else if (hasContactless(it.b)) screen.classList.toggle('reader-controls');
  }

  function openPass(it) {
    if (openItem === it) return;
    openItem = it;
    screen.classList.remove('reader-controls');
    screen.classList.add('is-open');
    scroller.classList.add('locked');
    $('#doneBtn').tabIndex = 0;
    $('#moreBtn').tabIndex = 0;
    layout();
    restartReader();
    updatePanel();
  }

  function closePass() {
    if (!openItem) return;
    const was = openItem;
    openItem = null;
    screen.classList.remove('is-open');
    screen.classList.remove('reader-controls');
    scroller.classList.remove('locked');
    $('#doneBtn').tabIndex = -1;
    $('#moreBtn').tabIndex = -1;
    layout();
    restartReader();
    updatePanel();
    if (items.includes(was)) was.wrap.focus({ preventScroll: true });
  }

  // Gestures on an open pass: swipe down to close it, swipe left/right for the next or previous pass.
  let drag = null;
  let suppressClick = false;
  let deviceScale = 1;
  let pagingTimer = 0;
  const pageWidth = () => hasContactless(openItem.b) ? openItem.wrap.firstChild.offsetWidth + 8 : openItem.wrap.offsetWidth + 24;

  function pagingTransition(pages, duration) {
    pages.forEach((it) => {
      it.wrap.style.setProperty('--swipe-duration', duration + 'ms');
      it.wrap.classList.add('is-paging');
    });
  }

  function movePages(pages, index, x, width, y) {
    pages.forEach((it, i) => place(it, (i - index) * width + x, y));
  }

  stack.addEventListener('pointerdown', (e) => {
    if (!openItem || !openItem.wrap.contains(e.target) || e.button > 0) return;
    const pages = swipeItems();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, axis: null, vx: 0, lastX: e.clientX, lastT: performance.now(), neighbor: null, dir: 0, pages, index: pages.indexOf(openItem), width: pageWidth(), offset: 0 };
  });

  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !openItem) return;
    const now = performance.now();
    drag.vx = (e.clientX - drag.lastX) / deviceScale / Math.max(1, now - drag.lastT);
    drag.lastX = e.clientX;
    drag.lastT = now;
    drag.dx = (e.clientX - drag.x0) / deviceScale;
    drag.dy = (e.clientY - drag.y0) / deviceScale;
    if (!drag.axis) {
      if (Math.abs(drag.dx) > 8 && Math.abs(drag.dx) > Math.abs(drag.dy)) {
        drag.axis = 'x';
        // Pick up an interrupted slide from its visible position, without a jump.
        drag.offset = new DOMMatrixReadOnly(getComputedStyle(openItem.wrap).transform).m41;
        drag.pages.forEach((it) => it.wrap.classList.add('dragging'));
      }
      else if (drag.dy > 8) drag.axis = 'y';
      else return;
      openItem.wrap.classList.add('dragging');
    }
    if (drag.axis === 'y') {
      const dy = Math.max(0, drag.dy);
      openItem.wrap.style.transform = `translate3d(0, ${openItem.y + dy * 0.9}px, 0) scale(${1 - Math.min(dy, 300) / 3000})`;
      return;
    }
    const W = drag.width;
    const distance = drag.dx + drag.offset;
    const dir = distance < 0 ? 1 : -1;
    const nb = drag.pages[drag.index + dir] || null;
    drag.neighbor = nb;
    drag.dir = dir;
    // All cards follow the same track. Compress overscroll at group boundaries.
    const x = nb ? Math.max(-W, Math.min(W, distance)) : distance * .32 / (1 + Math.abs(distance) / W);
    movePages(drag.pages, drag.index, x, W, openItem.y);
  });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    d.pages.forEach((it) => it.wrap.classList.remove('dragging'));
    if (!d.axis || !openItem) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
    openItem.wrap.classList.remove('dragging');
    const cancelled = e.type === 'pointercancel';
    if (d.axis === 'y') {
      if (!cancelled && d.dy > 110) closePass();
      else layout();
      return;
    }
    // A pause before releasing must not count as a fast flick.
    const velocity = performance.now() - d.lastT < 100 ? d.vx : 0;
    const distance = d.dx + d.offset;
    const projected = distance + velocity * 180;
    const advance = !cancelled && d.neighbor && Math.abs(distance) > 12 && (
      Math.abs(distance) > d.width * .35 || (Math.sign(projected) === -d.dir && Math.abs(projected) > d.width * .5)
    );
    const remaining = advance ? Math.max(0, d.width - Math.abs(distance)) : Math.min(d.width, Math.abs(distance));
    const duration = Math.round(Math.max(220, Math.min(380, 220 + remaining * .4 - Math.abs(velocity) * 35)));
    if (advance) {
      commitPage(d.neighbor, duration);
    } else {
      pagingTransition(d.pages, duration);
      movePages(d.pages, d.index, 0, d.width, openItem.y);
      parkLater(d.pages, duration);
    }
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // Move the entire group to its new page with a shared settling curve.
  function commitPage(nb, duration = 380) {
    if (!openItem || !swipeItems().includes(nb)) return;
    const old = openItem;
    const W = pageWidth();
    const pages = swipeItems();
    pagingTransition(pages, duration);
    movePages(pages, pages.indexOf(nb), 0, W, old.y);
    nb.wrap.style.zIndex = 900;
    nb.y = old.y;
    openItem = nb;
    // Recompute the header, field sizes and reader position when pass styles change.
    screen.classList.toggle('is-reader', hasContactless(nb.b));
    reader.hidden = !hasContactless(nb.b);
    restartReader();
    fitContactlessFields();
    if (!reader.hidden) reader.style.transform = `translate3d(0, ${nb.y + nb.wrap.offsetHeight + 46}px, 0)`;
    syncOpenState();
    updatePanel();
    // Preserve keyboard focus without drawing a focus ring after a touch swipe.
    if (old.wrap.matches(':focus-visible')) nb.wrap.focus({ preventScroll: true });
    parkLater(pages, duration);
  }

  // Reconcile the stack after settling, without overlapping cleanup timers.
  function parkLater(cards, duration = 380) {
    const list = [...cards];
    clearTimeout(pagingTimer);
    pagingTimer = setTimeout(async () => {
      if (drag && drag.axis) { parkLater(list, duration); return; }
      const live = list.filter((it) => items.includes(it) && it !== openItem);
      live.forEach((it) => it.wrap.classList.add('no-anim'));
      layout();
      await nextFrame();
      live.forEach((it) => it.wrap.classList.remove('no-anim'));
      list.forEach((it) => it.wrap.classList.remove('is-paging'));
    }, duration + 30);
  }

  async function pageTo(dir) {
    if (!openItem || drag) return;
    const selected = openItem;
    const pages = swipeItems();
    const nb = pages[pages.indexOf(openItem) + dir];
    if (!nb) {
      const it = openItem;
      place(it, -dir * 28, it.y);
      setTimeout(() => { if (openItem === it) place(it, 0, it.y); }, 160);
      return;
    }
    nb.wrap.classList.add('no-anim');
    nb.wrap.style.zIndex = 899;
    place(nb, dir * pageWidth(), openItem.y);
    await nextFrame();
    nb.wrap.classList.remove('no-anim');
    if (openItem !== selected) { layout(); return; }
    commitPage(nb);
  }

  async function removeItem(it) {
    await hideSheets();
    if (openItem === it) closePass();
    it.wrap.classList.add('removing');
    it.wrap.style.transform = `translate3d(0, ${it.y + 80}px, 0) scale(.92)`;
    await unpersist(it.entry.id);
    await wait(380);
    dropItem(it);
    layout();
    updatePanel();
    toast('Pass removed');
  }

  async function duplicateItem(it) {
    const e = it.entry;
    const copy = { ...e, id: uuid(), added: Date.now() };
    if (e.edit) copy.edit = { ...e.edit, pass: clone(e.edit.pass), images: { ...(e.edit.images || {}) } };
    const { fresh } = await addEntries([copy]);
    return fresh[0];
  }

  // ---------- Sheets ----------

  function present(node, back) {
    back.classList.remove('out');
    node.classList.remove('out');
    back.hidden = false;
    node.hidden = false;
  }

  function dismiss(node, back) {
    if (node.hidden) return Promise.resolve();
    node.classList.add('out');
    if (back) back.classList.add('out');
    return wait(250).then(() => {
      node.hidden = true;
      node.classList.remove('out');
      if (back) { back.hidden = true; back.classList.remove('out'); }
    });
  }

  async function hideSheets() {
    await Promise.all([
      dismiss(asheet, asBackdrop),
      !sheet.hidden ? dismiss(sheet, editor.hidden ? backdrop : null) : null,
      !editor.hidden ? closeEditor() : null,
    ]);
  }

  function actionSheet({ title, message, actions }) {
    asheet.replaceChildren();
    const group = el('div', 'as-group');
    if (title || message) {
      const head = el('div', 'as-title');
      if (title) head.append(el('strong', null, title));
      if (message) head.append(el('span', null, message));
      group.append(head);
    }
    actions.forEach((a) => {
      const btn = el('button', 'as-btn' + (a.destructive ? ' destructive' : ''), a.label);
      btn.type = 'button';
      // Run inside the tap itself: Safari only opens a file picker from a direct user gesture.
      btn.onclick = () => { a.run(); dismiss(asheet, asBackdrop); };
      group.append(btn);
    });
    const cancel = el('button', 'as-btn as-cancel', 'Cancel');
    cancel.type = 'button';
    cancel.onclick = () => dismiss(asheet, asBackdrop);
    asheet.append(group, cancel);
    present(asheet, asBackdrop);
    (group.querySelector('.as-btn') || cancel).focus();
  }

  function mainMenu() {
    actionSheet({
      actions: [
        ...(!matchMedia('(display-mode: standalone)').matches ? [{ label: document.body.classList.contains('phone-mode') ? 'Exit Full Screen' : 'Full Screen Phone View', run: togglePhoneMode }] : []),
        { label: 'Add Passes', run: () => fileInput.click() },
        { label: 'Add Sample Passes', run: addAllSamples },
        { label: 'Back Up Passes', run: backup },
        { label: 'Restore From Backup', run: () => restoreInput.click() },
      ],
    });
  }

  // ---------- Pass Details (back of the pass) ----------

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

  function buttonRow(label, cls, run) {
    const btn = el('button', 'ios-row ' + cls, label);
    btn.type = 'button';
    btn.onclick = run;
    return btn;
  }

  function group(...rows) {
    const g = el('div', 'ios-group');
    g.append(...rows.filter(Boolean));
    return g;
  }

  function openDetails(it) {
    const b = it.b;
    const pass = b.pass;
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
    names.append(el('span', null, String(loc(b, pass.description) || STYLE_NAMES[styleOf(pass)])));
    org.append(names);
    sheetBody.append(org);

    const toggles = group(
      pass.webServiceURL ? switchRow('Automatic Updates', true) : null,
      pass.webServiceURL ? switchRow('Allow Notifications', true) : null,
      pass.relevantDate || (Array.isArray(pass.locations) && pass.locations.length) ? switchRow('Suggest on Lock Screen', true) : null,
    );
    if (toggles.childElementCount) sheetBody.append(toggles);

    sheetBody.append(group(
      buttonRow('Edit Pass', 'link', () => switchToEditor(it)),
      buttonRow('Duplicate Pass', 'link', async () => {
        await dismiss(sheet, backdrop);
        const copy = await duplicateItem(it);
        if (copy) { closePass(); await wait(350); openPass(copy); toast('Pass duplicated'); }
      }),
    ));

    if (b.langs.length > 1) {
      const r = el('label', 'ios-row');
      r.append(el('span', null, 'Language'));
      const select = el('select');
      b.langs.forEach((l) => {
        const o = el('option', null, langName(l));
        o.value = l;
        o.selected = l === b.lang;
        select.append(o);
      });
      select.onchange = () => { setLang(it, select.value); openDetails(it); };
      r.append(select);
      sheetBody.append(group(r));
    }

    const notes = [];
    if (b.original.nfc) notes.push('The Hold Near Reader animation is a visual preview. To use contactless entry, open the original ticket in Apple Wallet. Tap the card to show controls, or swipe down to close it.');
    if (b.edited) notes.push(`Edited ${mediumDate(new Date(b.editedAt || Date.now()))}. Display details changed; the original barcode is unchanged.`);
    if (b.status === 'unsigned') notes.push('This file isn’t signed, so its barcode is hidden.');
    else if (b.status === 'modified') notes.push('This file was changed after it was signed, so its barcode is hidden.');
    if (pass.voided) notes.push('This pass has been voided.');
    const exp = parseIso(pass.expirationDate);
    if (exp && exp.instant < new Date()) notes.push(`Expired ${mediumDate(exp.instant)}.`);
    if (notes.length) sheetBody.append(el('p', 'ios-caption solo', notes.join(' ')));

    const style = styleOf(pass);
    const back = (Array.isArray(pass[style] && pass[style].backFields) ? pass[style].backFields : []).filter((f) => f && typeof f === 'object');
    if (back.length) {
      const g = el('div', 'ios-group');
      back.forEach((f) => g.append(backField(b, f)));
      sheetBody.append(g);
    }

    if (b.edited) {
      sheetBody.append(group(buttonRow('Reset to Original', 'link center', () => {
        actionSheet({
          message: 'Your changes to this pass will be lost.',
          actions: [{ label: 'Reset to Original', destructive: true, run: () => resetItem(it) }],
        });
      })));
    }

    sheetBody.append(group(buttonRow('Remove Pass', 'danger center', () => {
      actionSheet({
        message: 'This pass will be removed from this browser.',
        actions: [{ label: 'Remove Pass', destructive: true, run: () => removeItem(it) }],
      });
    })));

    sheetBody.scrollTop = 0;
    present(sheet, backdrop);
    $('#sheetDone').focus();
  }

  async function resetItem(it) {
    delete it.entry.edit;
    await persist(it.entry);
    rebuild(it, true);
    sortItems();
    layout();
    updatePanel();
    if (!sheet.hidden) openDetails(it);
    toast('Pass reset');
  }

  function setLang(it, lang) {
    it.entry.lang = lang;
    persist(it.entry);
    rebuild(it);
    layout();
    updatePanel();
  }

  function langName(code) {
    try { return new Intl.DisplayNames(undefined, { type: 'language' }).of(code.replace('_', '-')) || code; } catch { return code; }
  }

  // ---------- Editor ----------

  const FIELD_GROUPS = [
    ['headerFields', 'Top right', 3],
    ['primaryFields', 'Main', 1],
    ['secondaryFields', 'Second row', 4],
    ['auxiliaryFields', 'Third row', 4],
    ['backFields', 'Back of pass', 50],
  ];
  const IMAGE_SLOTS = {
    boardingPass: ['logo', 'footer'],
    coupon: ['logo', 'strip'],
    storeCard: ['logo', 'strip'],
    eventTicket: ['logo', 'strip', 'background', 'thumbnail'],
    generic: ['logo', 'thumbnail'],
  };
  const IMAGE_LABELS = { logo: 'Logo', strip: 'Banner image', background: 'Background', thumbnail: 'Thumbnail', footer: 'Footer image' };
  const TRANSIT_NAMES = { PKTransitTypeAir: 'Plane', PKTransitTypeTrain: 'Train', PKTransitTypeBus: 'Bus', PKTransitTypeBoat: 'Boat', PKTransitTypeGeneric: 'Other' };

  let editing = null;

  function section(text) {
    return el('div', 'ios-section', text);
  }

  function textRow(b, label, obj, key) {
    const r = el('label', 'ios-row ed-row');
    r.append(el('span', null, label));
    const input = el('input');
    input.value = obj[key] != null ? String(loc(b, obj[key])) : '';
    input.placeholder = 'None';
    input.oninput = () => {
      if (input.value) obj[key] = input.value;
      else delete obj[key];
    };
    r.append(input);
    return r;
  }

  function colorRow(label, obj, key, fallback) {
    const r = el('label', 'ios-row');
    r.append(el('span', null, label));
    const wrap = el('span', 'ed-color');
    const input = el('input');
    input.type = 'color';
    input.value = toHex(parseColor(obj[key]) || fallback);
    input.oninput = () => { obj[key] = rgb(parseColor(input.value)); };
    wrap.append(input);
    r.append(wrap);
    return r;
  }

  function transitRow(fields) {
    const r = el('label', 'ios-row ed-row');
    r.append(el('span', null, 'Travel by'));
    const select = el('select');
    Object.entries(TRANSIT_NAMES).forEach(([v, name]) => {
      const o = el('option', null, name);
      o.value = v;
      o.selected = (fields.transitType || 'PKTransitTypeGeneric') === v;
      select.append(o);
    });
    select.onchange = () => { fields.transitType = select.value; };
    r.append(select);
    return r;
  }

  function imageRow(b, imgs, name, urls) {
    const r = el('div', 'ios-row ed-img');
    const thumb = el('span', 'ed-thumb');
    const change = el('label', 'ed-btn', 'Change');
    const input = el('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;
    change.append(input);
    const remove = el('button', 'ed-btn danger', 'Remove');
    remove.type = 'button';
    const draw = () => {
      thumb.replaceChildren();
      let src = null;
      if (name in imgs) {
        if (imgs[name]) { src = URL.createObjectURL(imgs[name]); urls.push(src); }
      } else {
        const img = imageFor({ ...b, editImages: null, urls }, name);
        src = img && img.url;
      }
      if (src) {
        const i = el('img');
        i.alt = '';
        i.src = src;
        thumb.append(i);
      }
      remove.hidden = !src;
    };
    input.onchange = async () => {
      const f = input.files[0];
      input.value = '';
      if (!f) return;
      imgs[name] = await shrinkImage(f, name);
      draw();
    };
    remove.onclick = () => { imgs[name] = null; draw(); };
    draw();
    r.append(thumb, el('span', 'ed-img-name', IMAGE_LABELS[name]), change, remove);
    return r;
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  function toLocalInput(p, ignoresTimeZone) {
    const d = ignoresTimeZone ? p.wall : p.instant;
    const get = ignoresTimeZone
      ? [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()]
      : [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];
    return `${get[0]}-${pad2(get[1])}-${pad2(get[2])}T${pad2(get[3])}:${pad2(get[4])}`;
  }

  function valueInput(b, f, multiline) {
    const parsed = (f.dateStyle || f.timeStyle) ? parseIso(f.value) : null;
    let input;
    if (parsed) {
      input = el('input', 'ed-value');
      input.type = 'datetime-local';
      input.value = toLocalInput(parsed, f.ignoresTimeZone);
      input.oninput = () => { if (input.value) f.value = input.value; };
    } else if (typeof f.value === 'number') {
      input = el('input', 'ed-value');
      input.type = 'number';
      input.step = 'any';
      input.inputMode = 'decimal';
      input.value = String(f.value);
      input.oninput = () => { f.value = input.value === '' ? '' : Number(input.value); };
    } else {
      input = el(multiline ? 'textarea' : 'input', 'ed-value');
      input.rows = 2;
      input.value = f.value == null && f.attributedValue != null
        ? new DOMParser().parseFromString(String(loc(b, f.attributedValue)), 'text/html').body.textContent
        : String(loc(b, f.value ?? ''));
      input.oninput = () => {
        f.value = input.value;
        delete f.attributedValue;
      };
    }
    input.placeholder = 'Value';
    input.setAttribute('aria-label', 'Value');
    return input;
  }

  function fieldEditor(b, f, multiline, onDelete) {
    const r = el('div', 'ed-field');
    const label = el('input', 'ed-label');
    label.placeholder = 'Label';
    label.setAttribute('aria-label', 'Label');
    label.value = f.label != null ? String(loc(b, f.label)) : '';
    label.oninput = () => { f.label = label.value; };
    const del = el('button', 'ed-del');
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete field');
    del.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7"/></svg>';
    del.onclick = onDelete;
    r.append(label, del, valueInput(b, f, multiline));
    return r;
  }

  function fieldGroup(b, fields, key, title, max) {
    const box = el('div');
    const draw = (focusLast) => {
      const list = Array.isArray(fields[key]) ? fields[key] : [];
      const g = el('div', 'ios-group');
      list.forEach((f, i) => {
        if (!f || typeof f !== 'object') return;
        g.append(fieldEditor(b, f, key === 'backFields', () => { list.splice(i, 1); draw(); }));
      });
      if (list.length < max) {
        const add = buttonRow('Add Field', 'link ed-add', () => {
          if (!Array.isArray(fields[key])) fields[key] = list;
          list.push({ key: 'field-' + Date.now().toString(36), label: '', value: '' });
          draw(true);
        });
        g.append(add);
      }
      box.replaceChildren(section(title), g);
      if (focusLast) {
        const labels = box.querySelectorAll('.ed-label');
        if (labels.length) labels[labels.length - 1].focus();
      }
    };
    draw();
    return box;
  }

  function openEditor(it) {
    const b = it.b;
    const draft = clone(b.pass);
    const style = styleOf(draft);
    if (!draft[style] || typeof draft[style] !== 'object') draft[style] = {};
    const fields = draft[style];
    const imgs = { ...(b.editImages || {}) };
    const urls = [];
    editing = { it, draft, imgs, urls };

    const hasBg = style === 'eventTicket' && !!imageFor({ ...b, urls }, 'background') && !imageFor({ ...b, urls }, 'strip');
    const colors = passColors(draft, hasBg);

    editorBody.replaceChildren(
      section('Card'),
      group(
        textRow(b, 'Name', draft, 'logoText'),
        textRow(b, 'Organization', draft, 'organizationName'),
        style === 'boardingPass' ? transitRow(fields) : null,
      ),
      section('Colors'),
      group(
        colorRow('Background', draft, 'backgroundColor', colors.bg),
        colorRow('Text', draft, 'foregroundColor', colors.fg),
        colorRow('Labels', draft, 'labelColor', colors.lbl),
      ),
      section('Images'),
      group(...IMAGE_SLOTS[style].map((n) => imageRow(b, imgs, n, urls))),
      ...FIELD_GROUPS.map(([key, title, max]) => {
        const bp = style === 'boardingPass';
        const limit = bp && key !== 'headerFields' && key !== 'backFields' ? (key === 'primaryFields' ? 2 : 5) : max;
        // Boarding passes draw the auxiliary row above the secondary row.
        const name = bp && key === 'auxiliaryFields' ? 'Second row' : bp && key === 'secondaryFields' ? 'Third row' : title;
        return fieldGroup(b, fields, key, name, limit);
      }),
      el('p', 'ios-caption solo', 'Editing changes this wallet’s display details. The original barcode stays the same and still refers to the original pass, including its original admission and seat. Barcodes from unverified files remain hidden.'),
    );
    editorBody.scrollTop = 0;
    present(editor, backdrop);
    $('#editorCancel').focus();
  }

  async function switchToEditor(it) {
    sheet.hidden = true;
    openEditor(it);
  }

  async function closeEditor() {
    await dismiss(editor, backdrop);
    if (editing) editing.urls.forEach((u) => URL.revokeObjectURL(u));
    editing = null;
  }

  async function saveEditor() {
    if (!editing) return;
    const { it, draft, imgs } = editing;
    const before = it.b.editImages || {};
    const imgsChanged = Object.keys(imgs).length !== Object.keys(before).length || Object.keys(imgs).some((k) => imgs[k] !== before[k]);
    const passChanged = JSON.stringify(draft) !== JSON.stringify(it.b.pass);
    await closeEditor();
    if (!passChanged && !imgsChanged) return;
    it.entry.edit = { pass: draft, images: imgs, at: Date.now() };
    await persist(it.entry);
    rebuild(it, true);
    sortItems();
    layout();
    updatePanel();
    toast('Pass saved');
  }

  // ---------- Backup ----------

  function toB64(buf) {
    const u8 = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(s) {
    const bin = atob(s);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8.buffer;
  }
  const blobToDataUrl = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

  async function backup() {
    if (!items.length) { toast('No passes to back up'); return; }
    const passes = [];
    for (const { entry: e } of items) {
      const out = { id: e.id, added: e.added, source: e.source };
      if (e.source === 'sample') out.sample = e.sample;
      else out.bytes = toB64(e.bytes);
      if (e.lang) out.lang = e.lang;
      if (e.edit) {
        const images = {};
        for (const [k, v] of Object.entries(e.edit.images || {})) images[k] = v ? await blobToDataUrl(v) : null;
        out.edit = { pass: e.edit.pass, at: e.edit.at, images };
      }
      passes.push(out);
    }
    const blob = new Blob([JSON.stringify({ app: 'hotfalcon-wallet', version: 1, exported: new Date().toISOString(), passes })], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wallet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast(`Backed up ${passes.length} ${passes.length === 1 ? 'pass' : 'passes'}`);
  }

  async function restore(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch { throw new PassError('isn’t a backup this page can read.'); }
    if (!data || data.app !== 'hotfalcon-wallet' || !Array.isArray(data.passes)) throw new PassError('isn’t a Wallet Pass Viewer backup.');
    const entries = [];
    for (const p of data.passes) {
      try {
        const entry = { id: typeof p.id === 'string' ? p.id : uuid(), added: +p.added || Date.now(), source: p.source === 'sample' ? 'sample' : 'file' };
        if (entry.source === 'sample') {
          if (!SAMPLES[p.sample]) continue;
          entry.sample = p.sample;
        } else {
          entry.bytes = fromB64(p.bytes);
        }
        if (typeof p.lang === 'string') entry.lang = p.lang;
        if (p.edit && p.edit.pass && typeof p.edit.pass === 'object') {
          const images = {};
          for (const [k, v] of Object.entries(p.edit.images || {})) {
            if (!IMAGE_NAMES.includes(k)) continue;
            images[k] = typeof v === 'string' && v.startsWith('data:image/') ? await (await fetch(v)).blob() : null;
          }
          entry.edit = { pass: p.edit.pass, at: +p.edit.at || Date.now(), images };
        }
        entries.push(entry);
      } catch (e) {
        console.error(e);
      }
    }
    const { fresh } = await addEntries(entries);
    return fresh.length;
  }

  // ---------- Adding passes ----------

  const passKey = (it) => it.entry.source === 'file' && it.b.original.passTypeIdentifier && it.b.original.serialNumber
    ? it.b.original.passTypeIdentifier + '|' + it.b.original.serialNumber : null;

  async function openFiles(list) {
    showError('');
    const files = [...list];
    if (!files.length) return;
    const entries = [];
    const problems = [];
    let restored = 0;
    for (const f of files) {
      try {
        if (/\.json$/i.test(f.name) || f.type === 'application/json') { restored += await restore(f); continue; }
        const parts = await readArchive(await f.arrayBuffer());
        parts.forEach((p) => entries.push({ id: uuid(), added: Date.now(), source: 'file', bytes: p.bytes }));
      } catch (e) {
        problems.push(`${f.name} ${e instanceof PassError ? e.message : 'couldn’t be opened.'}`);
        if (!(e instanceof PassError)) console.error(e);
      }
    }

    // Wallet treats the same type + serial number as the same pass, so skip repeats.
    const known = new Set(items.map(passKey).filter(Boolean));
    const toAdd = [];
    let repeats = 0;
    for (const entry of entries) {
      try {
        const [parsed] = await readArchive(entry.bytes);
        const pass = parseJson(decodeText(parsed.files[parsed.root + 'pass.json']));
        const key = pass.passTypeIdentifier && pass.serialNumber ? pass.passTypeIdentifier + '|' + pass.serialNumber : null;
        if (key && known.has(key)) { repeats++; continue; }
        if (key) known.add(key);
      } catch { /* addEntries reports it */ }
      toAdd.push(entry);
    }

    const { fresh, failed } = await addEntries(toAdd);
    failed.forEach((e) => problems.push(`A pass ${e instanceof PassError ? e.message : 'couldn’t be opened.'}`));
    if (problems.length) showError(problems.join(' '));

    const added = fresh.length + restored;
    if (added === 1 && fresh.length === 1) {
      await wait(450);
      openPass(fresh[0]);
    }
    if (added > 1) toast(`Added ${added} passes`);
    else if (added === 0 && repeats) toast(repeats === 1 ? 'That pass is already here' : 'Those passes are already here');
    else if (added === 0 && problems.length) toast(problems.length === 1 && files.length === 1 ? 'That file isn’t a Wallet pass' : 'Some files couldn’t be added');
  }

  async function addSample(i) {
    if (openItem) closePass();
    const { fresh } = await addEntries([{ id: uuid(), added: Date.now(), source: 'sample', sample: i }]);
    if (fresh[0]) { await wait(450); openPass(fresh[0]); }
  }

  async function addAllSamples() {
    const have = new Set(items.filter((it) => it.entry.source === 'sample' && !it.entry.edit).map((it) => it.entry.sample));
    const entries = SAMPLES.map((_, i) => i).filter((i) => !have.has(i)).map((i) => ({ id: uuid(), added: Date.now(), source: 'sample', sample: i }));
    if (!entries.length) { toast('Samples are already here'); return; }
    if (openItem) closePass();
    await addEntries(entries);
    toast(`Added ${entries.length} sample passes`);
  }

  // ---------- Side panel (desktop) ----------

  function updatePanel() {
    const n = items.length;
    $('#count').textContent = n ? `${n} ${n === 1 ? 'pass' : 'passes'} saved` : 'No passes yet';
    $('#backupBtn').hidden = !n;
    const it = openItem;
    if (!it) {
      infoBox.hidden = true;
      langRow.hidden = true;
      return;
    }
    renderInfo(it.b);
    langRow.hidden = it.b.langs.length < 2;
    if (!langRow.hidden) {
      langSelect.replaceChildren(...it.b.langs.map((l) => {
        const o = el('option', null, langName(l));
        o.value = l;
        o.selected = l === it.b.lang;
        return o;
      }));
    }
  }

  function renderInfo(b) {
    const p = b.pass;
    const bc = pickBarcode(p);
    const dateText = (s) => {
      const d = parseIso(s);
      return d ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d.instant) : null;
    };
    const STATUS = { ok: 'Signed, files match the manifest', modified: 'Changed after signing', unsigned: 'Not signed', sample: 'Built-in sample' };
    const rows = [
      ['Style', STYLE_NAMES[styleOf(p)]],
      ['Organization', loc(b, p.organizationName)],
      ['Description', loc(b, p.description)],
      ['Serial number', p.serialNumber],
      ['Pass type ID', p.passTypeIdentifier],
      ['Team ID', p.teamIdentifier],
      ['Barcode', bc ? `${BARCODES[bc.format].name} · ${bc.messageEncoding || 'iso-8859-1'}` : 'None'],
      ['Relevant date', dateText(p.relevantDate)],
      ['Expires', dateText(p.expirationDate)],
      ['Voided', p.voided ? 'Yes' : null],
      ['Languages', b.langs.length ? b.langs.join(', ') : null],
      ['File', STATUS[b.status]],
      ['Edited', b.edited ? mediumDate(new Date(b.editedAt || Date.now())) : null],
    ];
    const dl = $('#infoList');
    dl.replaceChildren();
    rows.forEach(([k, v]) => {
      if (v == null || v === '') return;
      dl.append(el('dt', null, k), el('dd', null, String(v)));
    });
    infoBox.hidden = false;
  }

  // ---------- Small helpers ----------

  let toastTimer = 0;
  function toast(msg) {
    toastBox.textContent = msg;
    toastBox.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastBox.classList.remove('show'), 2200);
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = !msg;
  }

  // ---------- Wiring ----------

  const sampleBox = $('#samples');
  SAMPLES.forEach((s, i) => {
    const chip = el('button', 'chip', s.name);
    chip.type = 'button';
    chip.onclick = () => addSample(i);
    sampleBox.append(chip);
  });

  fileInput.addEventListener('change', () => {
    const list = [...fileInput.files];
    fileInput.value = '';
    openFiles(list);
  });
  restoreInput.addEventListener('change', async () => {
    const f = restoreInput.files[0];
    restoreInput.value = '';
    if (!f) return;
    showError('');
    try {
      const n = await restore(f);
      toast(n ? `Restored ${n} ${n === 1 ? 'pass' : 'passes'}` : 'Nothing to restore');
    } catch (e) {
      showError(`${f.name} ${e instanceof PassError ? e.message : 'couldn’t be restored.'}`);
      toast('That backup couldn’t be read');
    }
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
    openFiles(e.dataTransfer.files);
  });

  $('.drop').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  $('#addBtn').addEventListener('click', () => fileInput.click());
  $('#emptyAdd').addEventListener('click', () => fileInput.click());
  $('#emptySamples').addEventListener('click', addAllSamples);
  $('#menuBtn').addEventListener('click', mainMenu);
  $('#doneBtn').addEventListener('click', closePass);
  $('#moreBtn').addEventListener('click', () => { if (openItem) openDetails(openItem); });
  $('#sheetDone').addEventListener('click', () => dismiss(sheet, backdrop));
  $('#editorCancel').addEventListener('click', closeEditor);
  $('#editorSave').addEventListener('click', saveEditor);
  $('#backupBtn').addEventListener('click', backup);
  $('#restoreBtn').addEventListener('click', () => restoreInput.click());
  $('#phoneModeBtn').addEventListener('click', togglePhoneMode);
  $('#phoneModeExit').addEventListener('click', exitPhoneMode);
  backdrop.addEventListener('click', () => { if (!editor.hidden) closeEditor(); else dismiss(sheet, backdrop); });
  asBackdrop.addEventListener('click', () => dismiss(asheet, asBackdrop));
  langSelect.addEventListener('change', () => { if (openItem) setLang(openItem, langSelect.value); });

  document.addEventListener('keydown', (e) => {
    const sheetsClosed = asheet.hidden && editor.hidden && sheet.hidden;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && openItem && sheetsClosed && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) {
      e.preventDefault();
      pageTo(e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (e.key !== 'Escape') return;
    if (!asheet.hidden) dismiss(asheet, asBackdrop);
    else if (!editor.hidden) closeEditor();
    else if (!sheet.hidden) dismiss(sheet, backdrop);
    else if (document.body.classList.contains('phone-mode')) exitPhoneMode();
    else closePass();
  });

  function syncPhoneMode() {
    const active = document.body.classList.contains('phone-mode');
    $('#phoneModeBtn').setAttribute('aria-pressed', String(active));
    $('#phoneModeExit').hidden = !active;
    fitDevice();
    requestAnimationFrame(layout);
  }

  function exitPhoneMode() {
    document.body.classList.remove('phone-mode');
    syncPhoneMode();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  async function togglePhoneMode() {
    if (document.body.classList.contains('phone-mode')) { exitPhoneMode(); return; }
    if (!document.documentElement.requestFullscreen && matchMedia('(max-width: 600px)').matches) {
      toast('Add this page to your home screen for full screen');
      return;
    }
    document.body.classList.add('phone-mode');
    syncPhoneMode();
    if (document.documentElement.requestFullscreen) {
      try { await document.documentElement.requestFullscreen(); } catch { /* The phone view still works inside this tab. */ }
    }
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('phone-mode')) exitPhoneMode();
  });

  function fitDevice() {
    const phone = document.body.classList.contains('phone-mode') || matchMedia('(max-width: 600px), (display-mode: standalone)').matches;
    const scale = phone ? 1 : Math.max(0.6, Math.min(1, (innerHeight - 32) / 868));
    deviceScale = +scale.toFixed(3);
    document.documentElement.style.setProperty('--device-scale', String(deviceScale));
  }
  let resizeTimer = 0;
  addEventListener('resize', () => {
    fitDevice();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 100);
  });
  fitDevice();
  document.fonts.ready.then(() => requestAnimationFrame(layout));

  function tick() {
    $('#sbTime').textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
  }
  tick();
  setInterval(tick, 30000);

  // Load the saved collection without animating it in.
  (async () => {
    let entries = [];
    try { entries = await store.all(); } catch (e) { console.error(e); canSave = false; }
    for (const entry of entries) {
      try { items.push(await makeItem(entry)); } catch (e) { console.error(e); }
    }
    sortItems();
    stack.classList.add('no-anim');
    stack.replaceChildren(...items.map((it) => it.wrap), dots);
    layout();
    updatePanel();
    await nextFrame();
    stack.classList.remove('no-anim');
  })();
})();
