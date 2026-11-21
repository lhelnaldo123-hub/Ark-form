// ARK Form Center - "Install app" button (Android/Chrome prompt, iPhone instructions) + service worker
(function () {
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const btn = document.getElementById('installBtn'), tip = document.getElementById('installTip');
  if (!btn || standalone) return;
  let ev = null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); ev = e; btn.style.display = ''; });
  addEventListener('appinstalled', () => { btn.style.display = 'none'; if (tip) tip.style.display = 'none'; if (window.toast) toast('App installed ✓'); });
  if (ios) btn.style.display = '';
  btn.onclick = async () => {
    if (ev) { ev.prompt(); await ev.userChoice.catch(() => {}); ev = null; btn.style.display = 'none'; return; }
    if (tip) { tip.style.display = tip.style.display === 'none' ? '' : 'none'; tip.textContent = ios ? 'On iPhone: tap the Share button in Safari, then "Add to Home Screen".' : 'Open your browser menu (⋮) and choose "Install app" or "Add to Home screen".'; }
  };
})();
