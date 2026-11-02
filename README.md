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

Upload `index.html`, `style.css` and `script.js` to the `public_html` folder of the hosting account
(or connect this GitHub repo through the host's Git deployment), then point davedrop.online at it.
