# Dave Drop

Contact page for **davedrop.online**. Plain HTML, CSS and JavaScript. No build step.

## Files

- `index.html`: page markup
- `style.css`: styles (lime / navy / white palette)
- `script.js`: contact details and behaviour

## Change the contact details

Open `script.js` and edit the `CONFIG` object at the top:

```js
whatsappNumber: "237670178126",   // digits only, with country code
telegramUsername: "davedrop",      // without the @
```

## Run locally

Open `index.html` in a browser, or run `python3 -m http.server` in this folder.

## Hosting

Hosted on **Vercel** as a static site (no build step, no config needed).

1. In Vercel: **Add New → Project**, import `johnbrindi/Dave-Drop`.
2. Framework preset: **Other**. Leave the build command and output directory empty.
3. Deploy. Every push to `main` redeploys automatically.

### Custom domain (davedrop.online)

In the Vercel project: **Settings → Domains → Add** `davedrop.online` (and `www.davedrop.online`).
Then, at the domain registrar's DNS settings, add the records Vercel shows, typically:

| Type  | Name | Value                  |
|-------|------|------------------------|
| A     | @    | 76.76.21.21            |
| CNAME | www  | cname.vercel-dns.com   |

Always use the exact values Vercel displays for your project. HTTPS is set up automatically.
