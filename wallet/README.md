# Wallet Pass Viewer: notes and findings

Live page: `/wallet/` (linked from the homepage). It opens an Apple Wallet `.pkpass` (or a `.pkpasses` bundle) in the browser and draws it the way an iPhone shows it. Nothing is uploaded; the file is read with JavaScript in the browser.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page markup: file picker, sample buttons, pass info, and the iPhone frame. |
| `wallet.css` | Page styles, the iPhone frame, the pass card, and the "Pass Details" sheet. |
| `wallet.js` | Zip reading, `pass.json` and `pass.strings` parsing, field formatting, layout for each pass style, barcodes, and the built-in samples. |
| `vendor/bwip-wallet.min.js` | A trimmed [bwip-js](https://github.com/metafloor/bwip-js) (MIT) build with only the 4 barcode types Wallet uses. |

## How a .pkpass is built

- A `.pkpass` is a plain **zip** file holding `pass.json`, `manifest.json`, `signature`, PNG images and optional `xx.lproj/` folders for translations.
- A `.pkpasses` file is a zip that holds several `.pkpass` files.
- The viewer unzips with the browser's built-in `DecompressionStream('deflate-raw')`, so it needs no zip library. This works in Chrome/Edge 103+, Safari 16.4+ and Firefox 113+.
- Some passes are zipped with a folder inside (`MyPass.pass/pass.json`). The viewer finds `pass.json` wherever it is and treats that folder as the root.
- The viewer does not check the signature. The Pass info panel only says whether a `signature` file exists (an iPhone would reject a pass without one).

## The 5 pass styles and their layouts

Sources: Apple's [Wallet Developer Guide: Pass Design and Creation](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html), plus how real passes look on an iPhone.

| Style | Shape | Images allowed | Layout used |
| --- | --- | --- | --- |
| `boardingPass` | Rounded rectangle | logo, icon, footer | Header → two primary fields (origin, transit icon, destination) → **auxiliary row, then secondary row** → footer image → barcode |
| `eventTicket` | Half-circle notch at top center | logo, icon, strip **or** background + thumbnail | Strip: primary sits on the strip. No strip: primary + secondary beside the thumbnail, and the background image is blurred behind the whole card. Auxiliary fields can use `"row": 0/1` for two rows. |
| `coupon` | Perforated top edge | logo, icon, strip | Primary value (big) with its label under it, on the strip → secondary row → auxiliary row |
| `storeCard` | Rounded rectangle | logo, icon, strip | Same as coupon |
| `generic` | Rounded rectangle | logo, icon, thumbnail | Primary + secondary beside the thumbnail → auxiliary row |

Rules that apply to all styles:

- **Field limits:** up to 3 header, 1 primary (2 on boarding passes), 4 secondary, 4 auxiliary (5 on boarding passes).
- **Square barcodes (QR, Aztec)** on coupon, store card and generic passes put secondary and auxiliary fields into **one row of up to 4**.
- **Image sizes in points:** logo up to 160×50, thumbnail up to 90×90, footer 286×15, background 180×220 (blurred), strip 375×98 (event ticket) or 375×144 (coupon, store card). The viewer picks `@3x`, then `@2x`, then 1x, and divides by the scale to get the point size.
- **Colors:** `backgroundColor`, `foregroundColor` (values) and `labelColor` (labels) use `rgb(r, g, b)`. The viewer also accepts hex. With a background image, `backgroundColor` is ignored. Missing colors default to white background and black text, with labels matching the value color.
- **Alignment:** fields in a row are spread across the card. The last field in a row is right-aligned unless `textAlignment` says otherwise. Header fields are right-aligned.

## Field formatting

- `dateStyle` / `timeStyle` (`PKDateStyleShort|Medium|Long|Full|None`) use `Intl.DateTimeFormat` in the viewer's locale. A field is only formatted as a date when one of these keys is present.
- `isRelative` shows "Today", "Tomorrow" or "Yesterday" when it applies.
- `ignoresTimeZone` shows the clock time written in the pass, not converted to the viewer's time zone.
- `currencyCode` and `numberStyle` (`Decimal`, `Percent`, `Scientific`, `SpellOut`) use `Intl.NumberFormat`. Spell-out uses a small English converter.
- **Localization:** labels and values that match a key in `xx.lproj/pass.strings` are replaced. The language is picked from the browser's language list, and a Language menu shows up when the pass has more than one. Images inside an `.lproj` folder replace the root images. `.strings` files may be UTF-16 (with or without a BOM) or UTF-8.

## Barcodes

- If `barcodes` (array) exists, the first entry with a supported format is used. Otherwise the older `barcode` key is used.
- Formats: `PKBarcodeFormatQR`, `PKBarcodeFormatPDF417`, `PKBarcodeFormatAztec`, `PKBarcodeFormatCode128`.
- `messageEncoding` `iso-8859-1` is sent as raw bytes (bwip-js `binarytext: true`). Anything else, or text that can't fit in Latin-1, is sent as UTF-8.
- `altText` is printed under the barcode inside the white box.
- Voided or expired passes show a note above the card and fade the barcode.

## The back of the pass

Since iOS 16, tapping **•••** opens a "Pass Details" sheet instead of flipping the card. The viewer does the same thing: it shows the organization, toggles (Automatic Updates and Allow Notifications when the pass has `webServiceURL`, Suggest on Lock Screen when it has a relevant date or locations), the `backFields`, and Remove Pass.

- Back field text gets links for URLs, emails and phone numbers. Phone numbers need a `+` country code or US `(555) 555-5555` / `555-555-5555` format, so order numbers like `58213-4471` don't become links.
- `attributedValue` may contain `<a href>` tags. Only `http`, `https`, `mailto` and `tel` links are kept. Every other tag becomes plain text, so a pass file can't run scripts on the page.

## Guesses (not confirmed from Apple docs)

I couldn't reach Apple's current design pages from the build environment, so these come from how passes usually look on an iPhone:

- Front labels are shown in UPPERCASE.
- On boarding passes, the auxiliary row is drawn above the secondary row. Apple's guide says this about the Apple Watch layout, and passes on iPhone look the same.
- On strip-style passes (coupon, store card, event ticket with a strip), the primary field's label sits under the value.
- Card size is about 358 × 455 points, about the size on a 6.1-inch iPhone.

If a real pass looks different on a phone, these are the first things to adjust in `wallet.css` and in `renderPass()` in `wallet.js`.

## Rebuilding the barcode bundle

```sh
npm install bwip-js@4 esbuild
cat > entry.mjs <<'EOF'
import { qrcode, pdf417, azteccode, code128, drawingSVG } from 'bwip-js/browser';
window.bwipjs = { qrcode, pdf417, azteccode, code128, drawingSVG };
EOF
npx esbuild entry.mjs --bundle --minify --format=iife --platform=browser \
  --banner:js="<MIT license header from bwip-js-min.js>" --outfile=vendor/bwip-wallet.min.js
```

The full bwip-js file is 1.1 MB. This build is about 250 KB.

## What was tested

These checks ran in headless Chromium:

- All 5 built-in samples.
- A pass with a blurred background, a thumbnail, UTF-16 `en.lproj` strings, UTF-8 `fr.lproj` strings with a localized logo, and a UTF-8 Aztec code.
- A train boarding pass zipped inside a folder, using the old `barcode` key and marked `voided`.
- A store card with hex colors, trailing commas in `pass.json` and Code 128.
- A `.pkpasses` bundle, including paging through it and removing a pass.
- A file that isn't a pass, which shows a friendly error.
- Script injection attempts in `attributedValue` (none ran).
- Light and dark mode, plus a 390 px-wide phone screen, where the frame is dropped and the page itself acts like the Wallet app.
