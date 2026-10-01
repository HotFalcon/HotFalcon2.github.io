# Wallet Pass Viewer: notes and findings

Live page: `/wallet/` (linked from the homepage). It keeps a collection of Apple Wallet `.pkpass` files (for example, tickets from games you've been to) and draws them the way an iPhone shows them. Nothing is uploaded: files are read with JavaScript and saved in the browser.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page markup: side panel (desktop), the iPhone frame, and the Wallet app screen with its sheets. |
| `wallet.css` | Page styles, the iPhone frame, the card stack and its animations, the pass card, sheets, editor, and phone full-screen mode. |
| `wallet.js` | Zip reading, manifest check, `pass.json` and `pass.strings` parsing, field formatting, layout for each pass style, barcodes, the saved collection (IndexedDB), the stack and gestures, the editor, backup/restore, and the samples. |
| `manifest.webmanifest`, `icons/` | Lets "Add to Home Screen" open the page full screen like an app. |
| `vendor/bwip-wallet.min.js` | A trimmed [bwip-js](https://github.com/metafloor/bwip-js) (MIT) build with only the 4 barcode types Wallet uses. |

## How a .pkpass is built

- A `.pkpass` is a plain **zip** file holding `pass.json`, `manifest.json`, `signature`, PNG images and optional `xx.lproj/` folders for translations.
- A `.pkpasses` file is a zip that holds several `.pkpass` files.
- The viewer unzips with the browser's built-in `DecompressionStream('deflate-raw')`, so it needs no zip library. This works in Chrome/Edge 103+, Safari 16.4+ and Firefox 113+.
- Some passes are zipped with a folder inside (`MyPass.pass/pass.json`). The viewer finds `pass.json` wherever it is and treats that folder as the root.
- `manifest.json` lists a SHA-1 (or SHA-256) hash for every file, and `signature` signs that manifest. The viewer re-hashes every file and compares. Genuine passes always match. A pass that doesn't match, or has no `signature`, is shown as an **Unverified pass**, with its barcode hidden. The viewer does not check the signature's certificate chain itself.

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
- Voided passes fade the barcode. Voided and expired notes appear in Pass Details.
- Edited passes retain the original barcode. Unverified files still hide their barcode and show an "Unverified pass" panel on the card face (see Editing below).

## Contactless event tickets

Imported event tickets with original `nfc` metadata use the compact reader presentation: a wide shallow notch, proportionally sized header and fields, issuer icon, contactless symbol, and a looping SVG/CSS **Hold Near Reader** animation. The animation respects reduced-motion preferences. The viewer does not transmit NFC or authenticate tickets; contactless entry still requires the original ticket in Apple Wallet. Unverified and voided passes do not activate this presentation.

Tap the open card to reveal **Done** and **Pass Details**, or swipe down to return to the collection. Neighboring tickets in the same group peek in from the side; other saved cards remain stacked below the reader. Field values shrink to fit, then wrap when necessary. Barcode-only passes keep their existing card layout. Use Add to Home Screen for the full-screen presentation; Safari's toolbar and the iPhone's system UI remain controlled by iOS.

## The back of the pass

Since iOS 16, tapping **•••** opens a "Pass Details" sheet instead of flipping the card. The viewer does the same thing. The sheet shows:

- the organization
- toggles: Automatic Updates and Allow Notifications when the pass has `webServiceURL`, and Suggest on Lock Screen when it has a relevant date or locations
- Edit Pass and Duplicate Pass
- a Language picker when the pass has translations
- the `backFields`
- Reset to Original (edited passes only) and Remove Pass, each confirmed with an action sheet

- Back field text gets links for URLs, emails and phone numbers. Phone numbers need a `+` country code or US `(555) 555-5555` / `555-555-5555` format, so order numbers like `58213-4471` don't become links.
- `attributedValue` may contain `<a href>` tags. Only `http`, `https`, `mailto` and `tel` links are kept. Every other tag becomes plain text, so a pass file can't run scripts on the page.

## The collection (Wallet app screen)

- **Several files at once:** pick or drop any number of `.pkpass` / `.pkpasses` files. Bundles are split into separate passes. A pass whose `passTypeIdentifier` + `serialNumber` is already saved is skipped, which is how Wallet treats repeats.
- **Order:** newest event first. The date comes from `relevantDate`, then `relevantDates[0]`, then the first date-formatted field, then `expirationDate`, then the date it was added.
- **Stack:** cards overlap so each shows its top 62 px (logo, name and header fields), and the last card is fully visible, like Wallet. The cards are positioned with `transform` and ordered by `z-index`, never by moving DOM nodes, because moving a node cancels its CSS transition.
- **Opening a pass:** the tapped card springs to the top. Related passes form its swipe group; unrelated passes remain in a compact stack below it. Tap a lower card to open its group. On short screens, scroll to reach the lower stack. The title turns into **Done** and **•••**. Tap Done, or swipe the card down (more than 110 px), to put it back.
- **Flipping between passes:** with a pass open, swipe left or right within its group. On desktop, drag with the mouse or use the ← → keys. Samples group only with copies of the same sample. Imported passes group by original issuer, pass style, and `groupingIdentifier` when supplied. Event tickets without an explicit group use their original event name/description and date; tickets lacking those stay separate. Other pass styles group by issuer and style. Display edits do not change group membership.
  - Page dots and reader side previews use the same group. A single pass has no dots. Large groups show a sliding window of 9 dots, with smaller dots at the ends.
  - A swipe commits once it passes 25% of the card width, or on a quick flick. Otherwise the card springs back.
  - At the first or last pass, the card rubber-bands instead of moving.
  - The first move decides the direction: mostly sideways means flip, mostly down means close.
  - The neighbor card is pulled from the hidden set below the screen only while you drag. Once a card has slid off to the side, it jumps back below the screen without animating, so nothing flies across the screen.
- **Animations:** new cards slide up from below (staggered), removed cards drop and fade, sheets slide up with a dimmed backdrop, and saved edits flash in. All use one spring curve, `cubic-bezier(.2, .9, .22, 1)`. Reduced motion is respected.
- **Phones:** at 600 px wide or less, or when launched from the home screen (`display-mode: standalone`), the side panel and iPhone frame are hidden and the page *is* the Wallet screen, full height with safe-area padding. `manifest.webmanifest` plus the `apple-mobile-web-app-*` tags make "Add to Home Screen" open it full screen.
- **Full Screen Phone View:** the desktop button or Wallet menu opens a borderless, phone-width display and requests browser full screen when supported. Escape, the exit button, or the Wallet menu restores the normal page. On mobile browsers without the Fullscreen API, the menu suggests adding the page to the home screen.
- **Safari detail:** the file picker only opens from a direct tap, so action-sheet buttons run their action inside the tap before the sheet animates away.

## Saving and backups

- Passes are stored in **IndexedDB** (database `hotfalcon-wallet`, store `passes`). Each record holds the original `.pkpass` bytes (or a sample number), the chosen language, and any edit. The page asks for persistent storage with `navigator.storage.persist()`.
- Browsers can still clear site data. Safari removes it from sites you haven't opened in 7 days, unless the site was added to the home screen. **Back up** downloads one `.json` file holding every pass (base64) and edit. **Restore** (or dropping that `.json` on the page) brings it back on any browser.

## Editing

Use this when you don't have the exact pass from a game: duplicate a similar pass, then edit it.

- The editor changes the name, organization, the three colors, images (logo, banner/strip, background, thumbnail, footer, depending on style), the transit type on boarding passes, and every field group: add, remove, or change the label and value. Date fields use a date-time picker, and number and currency fields use a number box.
- Edits are stored separately from the original file, so **Reset to Original** always works. Uploaded images are shrunk (for example, to 1125 × 432 for a strip) before saving.
- Editing a verified pass keeps its original barcode unchanged. Display edits do not change the admission, seat, or validity associated with that barcode. Unverified files continue to hide their barcode.

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
- A `.pkpasses` bundle, whose passes were skipped because they were already saved.
- A pass changed after signing (shown as Unverified, no barcode), and an unsigned pass.
- A file that isn't a pass, which shows a friendly error.
- Script injection attempts in `attributedValue` (none ran).
- Opening and closing passes, the swipe-down gesture with real touch events, Edit → Save (original barcode retained), Duplicate, Remove with confirmation, Reset, and reload (the collection persists).
- Backup in one browser profile and restore in a fresh one.
- Light and dark mode, desktop with the iPhone frame, and a 390 × 844 phone screen in full-screen mode.
