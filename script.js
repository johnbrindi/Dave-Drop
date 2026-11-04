/* ==========================================================
   EDIT YOUR CONTACT DETAILS HERE
   ========================================================== */
const CONFIG = {
  // WhatsApp number: country code + number, digits only (no +, spaces or dashes)
  whatsappNumber: "447343053226",
  // Telegram username, without the @
  telegramUsername: "Drop420s",
  // Signal invite link (paste the full link exactly as given)
  signalUrl: "https://signal.me/#eu/5ZEg1z0tovQCukvpBRnQyzTMhuUxQLPqKV92TZ63RQHFglXE0D5MrJojqKbmptR0",
  // Shown on the page
  phoneDisplay: "+44 7343 053226",
};

(function () {
  const $ = (id) => document.getElementById(id);

  const waBase = `https://wa.me/${CONFIG.whatsappNumber}`;
  const tgBase = `https://t.me/${CONFIG.telegramUsername}`;

  // Fill links and text
  $("wa-link").href = `${waBase}?text=${encodeURIComponent("Hi Dave Drop! ")}`;
  $("tg-link").href = tgBase;
  $("sg-link").href = CONFIG.signalUrl;
  $("wa-handle").textContent = CONFIG.phoneDisplay;
  $("tg-handle").textContent = `@${CONFIG.telegramUsername}`;
  $("info-phone").textContent = CONFIG.phoneDisplay;
  $("year").textContent = new Date().getFullYear();

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
