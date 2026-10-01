# Bot detection site (Pixelscan / Accertify-style): research notes

Question: can hotfalcon.net host a page that checks whether a visitor is a bot, like Pixelscan or Accertify?

## How this site is hosted today
- GitHub Pages repo (`HotFalcon2.github.io`) with custom domain `hotfalcon.net` (see `CNAME`).
- GitHub Pages only serves static files: HTML, CSS, JS, and images.
- No server-side code runs. `filedownload.php` is served as a plain file and never executes.
- So no backend, no database, and no access to raw request data (IP, headers, TLS handshake).

## What these tools actually do
| Tool | What it is | Where checks run |
|------|------------|------------------|
| Pixelscan | Public test page: "does my browser look real and consistent?" | Mostly browser JS, plus a server for IP/proxy lookups |
| CreepJS / BrowserLeaks / FingerprintJS demo | Similar fingerprint test pages | Mostly browser JS |
| Accertify (Amex-owned) | Commercial fraud and bot platform for checkout/login | Browser SDK, then server scoring with ML and a cross-merchant device/risk database |

## Checks by where they can run

### Works on GitHub Pages (pure browser JS)
- `navigator.webdriver`, plus traces left by headless Chrome, Puppeteer, Playwright, and Selenium (`cdc_` vars, missing `window.chrome`, etc.)
- Consistency checks: user agent vs `navigator.platform`, `userAgentData`, screen size, and touch support
- Canvas, WebGL (GPU vendor/renderer), and AudioContext fingerprints, plus hashes of those
- Font list, `hardwareConcurrency`, `deviceMemory`, plugins, and mimeTypes
- Timezone (`Intl`) vs language settings
- Signs of tampered native functions (`Function.prototype.toString` checks)
- Behavior: mouse movement, typing rhythm, scrolling, time-to-first-interaction
- WebRTC local/public IP leak (via a public STUN server)
- Calling a third-party IP API (e.g. ipinfo/ipapi) from the browser to compare IP location with timezone. Free tiers are limited, and the key is visible to visitors.

### Needs a real server
- Reading the visitor's real IP, and the exact header order and values as sent
- TLS/JA3/JA4 and HTTP/2 fingerprints. These are often the strongest bot signals, and only the server sees the handshake.
- Datacenter, VPN, and proxy IP detection with your own database (e.g. MaxMind, IP2Proxy)
- Storing fingerprints to spot repeat visitors and devices seen across many accounts
- Hiding the scoring logic. Anything client-side can be read and spoofed.
- Rate limiting, plus history and a dashboard

### Accertify-level, beyond a hobby project
- Data from millions of transactions across many merchants
- Trained ML risk models, chargeback feedback loops, and analyst teams
- Server SDK integrations into checkout and login flows

## Hosting options
1. **Static only (GitHub Pages):** a Pixelscan-like self-test page that shows results to the visitor. Doable now.
2. **Static plus serverless functions (Cloudflare Workers/Pages, Vercel, Netlify):** free tiers available. You get the real IP and headers, and Cloudflare exposes JA3/JA4 and bot score on some plans. You can store results with KV or D1. Good middle ground.
3. **VPS (e.g. a $5/mo DigitalOcean/Hetzner box running Node or Python behind nginx):** full control, including custom TLS fingerprinting. Most work.

hotfalcon.net could stay on GitHub Pages and call an API on a subdomain (e.g. `api.hotfalcon.net` on Cloudflare Workers).

## Hosting locally for testing
- Run a local server (Node/Express or Python/Flask) on your PC, e.g. `http://localhost:3000`. It gives you full server abilities for free: raw IP, headers, and storage.
- Ways to reach it:
  - **Same PC:** `localhost`. The IP always shows as `127.0.0.1`, so IP and proxy checks are meaningless here.
  - **Other devices on your Wi-Fi (phone, laptop):** `http://<your PC's LAN IP>:3000`. Find the LAN IP with `ipconfig` on Windows (e.g. `192.168.1.x`). You may need to allow the port through Windows Firewall.
  - **From the internet (to see real public IPs, VPNs, proxies):** use a tunnel, e.g. Cloudflare Tunnel (`cloudflared`) or ngrok. These give you a public HTTPS URL without opening ports on your router. Router port forwarding also works but exposes your home IP.
- Caveat: tunnels terminate TLS on their own servers, so TLS/JA3/JA4 fingerprints describe the tunnel, not the visitor. To test TLS fingerprinting locally, serve HTTPS yourself (e.g. with `mkcert` certs) and connect directly over LAN or port forwarding.
- Quick start for static pages only: `python -m http.server 8000` in the repo folder. This is the same as GitHub Pages: no server-side checks.
