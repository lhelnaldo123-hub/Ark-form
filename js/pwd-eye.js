// ARK Form Center - adds a "show / hide password" eye to every password box (login, register, staff, change password).
// Works on boxes added later too (pop-up dialogs).
(function () {
  const EYE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const OFF = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12A3 3 0 1 1 9.88 9.88"/><path d="M1 1l22 22"/></svg>';
  const css = document.createElement('style');
  css.textContent = '.pwbox{position:relative;display:block;margin:5px 0 10px}.pwbox>input{margin:0!important;padding-right:48px!important}' +
    '.pwbox>.pweye{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:38px;height:38px;min-height:0;padding:0;margin:0;border:0;border-radius:50%;background:none!important;box-shadow:none!important;color:#6b7280;display:flex;align-items:center;justify-content:center;cursor:pointer}' +
    '.pwbox>.pweye:hover{background:#0000000d!important;transform:translateY(-50%)}.pwbox>.pweye.on{color:#0f2342}';
  document.head.appendChild(css);
  function wrap(inp) {
    if (inp.dataset.eye) return; inp.dataset.eye = '1';
    const w = document.createElement('span'); w.className = 'pwbox';
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pweye'; b.innerHTML = EYE; b.setAttribute('aria-label', 'Show password');
    b.onclick = () => {
      const show = inp.type === 'password'; inp.type = show ? 'text' : 'password';
      b.innerHTML = show ? OFF : EYE; b.classList.toggle('on', show); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); inp.focus();
    };
    w.appendChild(b);
  }
  const scan = root => (root || document).querySelectorAll('input[type=password]').forEach(wrap);
  scan();
  new MutationObserver(m => { if (m.some(x => x.addedNodes.length)) scan(); }).observe(document.body, { childList: true, subtree: true });
})();
