# Dave Drop

Contact page for **davedrop.online**. Plain HTML, CSS and JavaScript. No build step.

## Files

- `index.html`: page markup
- `style.css`: styles (lime / navy / white palette)
- `script.js`: contact details and behaviour

## Change the contact details

Open `script.js` and edit the `CONFIG` object at the top:

```js
whatsappNumber: "447343053226",   // digits only, with country code
telegramUsername: "Drop420s",      // without the @
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

## Live chat

- Visitors chat through the bubble on the site (`chat.js`, `chat.css`, `api/chat.js`).
- Admin app: **https://davedrop.online/admin** (password only, installable, push notifications).
  Code in `admin/` and `api/admin.js`. Messages are stored in Upstash Redis (Vercel Marketplace).

Environment variables (set in Vercel → Settings → Environment Variables):

| Name | What it is |
|------|------------|
| `ADMIN_PASSWORD` | Admin login password. Changing it logs out every device. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Added automatically by the Upstash integration |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Push notification keys |
| `SESSION_SECRET` | Signs admin login sessions |

After changing an environment variable, redeploy for it to take effect.
