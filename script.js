/* ==========================================================
   EDIT YOUR CONTACT DETAILS HERE
   ========================================================== */
const CONFIG = {
  // WhatsApp number: country code + number, digits only (no +, spaces or dashes)
  whatsappNumber: "237670178126",
  // Telegram username, without the @
  telegramUsername: "davedrop",
  // Shown on the page
  phoneDisplay: "+237 670 178 126",
  location: "Cameroon",
  hoursText: "Mon–Sat · 8:00–20:00 WAT",
  // Opening hours used for the "Online now" badge (24h clock, West Africa Time, UTC+1)
  openHour: 8,
  closeHour: 20,
  openDays: [1, 2, 3, 4, 5, 6], // 0 = Sunday
};

(function () {
  const $ = (id) => document.getElementById(id);

  const waBase = `https://wa.me/${CONFIG.whatsappNumber}`;
  const tgBase = `https://t.me/${CONFIG.telegramUsername}`;

  // Fill links and text
  $("wa-link").href = `${waBase}?text=${encodeURIComponent("Hi Dave Drop! ")}`;
  $("tg-link").href = tgBase;
  $("wa-handle").textContent = CONFIG.phoneDisplay;
  $("tg-handle").textContent = `@${CONFIG.telegramUsername}`;
  $("info-phone").textContent = CONFIG.phoneDisplay;
  $("info-location").textContent = CONFIG.location;
  $("info-hours").textContent = CONFIG.hoursText;
  $("year").textContent = new Date().getFullYear();

  // Online / away badge based on WAT (UTC+1)
  const now = new Date();
  const wat = new Date(now.getTime() + (now.getTimezoneOffset() + 60) * 60000);
  const open =
    CONFIG.openDays.includes(wat.getDay()) &&
    wat.getHours() >= CONFIG.openHour &&
    wat.getHours() < CONFIG.closeHour;
  if (!open) {
    $("status-text").textContent = "Away · we reply in the morning";
    $("status-text").parentElement.classList.add("is-away");
  }

  // Toast
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  // Copy phone number
  $("copy-phone").addEventListener("click", () => {
    const text = CONFIG.phoneDisplay;
    const fallback = () => {
      const range = document.createRange();
      range.selectNodeContents($("info-phone"));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      toast("Number selected. Press Ctrl+C to copy.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast("Number copied"), fallback);
    } else {
      fallback();
    }
  });

  // Form -> WhatsApp with the message pre-filled
  const form = $("contact-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("f-name");
    const msg = $("f-message");
    const err = $("form-error");
    [name, msg].forEach((f) => f.removeAttribute("aria-invalid"));

    const missing = [];
    if (!name.value.trim()) missing.push(name);
    if (!msg.value.trim()) missing.push(msg);
    if (missing.length) {
      missing.forEach((f) => f.setAttribute("aria-invalid", "true"));
      err.textContent = "Add your name and a message, then send.";
      err.hidden = false;
      missing[0].focus();
      return;
    }
    err.hidden = true;

    const text =
      `Hi Dave Drop, I'm ${name.value.trim()}.\n` +
      `Topic: ${$("f-topic").value}\n\n` +
      msg.value.trim();

    const link = document.createElement("a");
    link.href = `${waBase}?text=${encodeURIComponent(text)}`;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast("Opening WhatsApp…");
  });
})();
