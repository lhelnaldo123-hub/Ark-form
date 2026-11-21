// ARK Form Center - wishlist hearts on product cards and the product page.
// Saved in Firestore: customers/<uid>.wishlist (array of product ids). Load AFTER app.js and shop-account.js.
(function () {
  const auth = firebase.auth(), FV = firebase.firestore.FieldValue;
  let WISH = new Set(), unsub = null, raf = 0;
  const real = id => !!id && !/^d\d+$/.test(id);               // sample products (d1, d2...) cannot be saved

  function setBtn(b, id, detail) {
    const on = WISH.has(id), t = detail ? (on ? '♥ Saved to wishlist' : '♡ Save to wishlist') : (on ? '♥' : '♡');
    if (b.textContent !== t) b.textContent = t;
    if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
    if (b.dataset.id !== id) b.dataset.id = id;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function paint() {
    document.querySelectorAll('.pc').forEach(c => {
      const a = c.querySelector('.pimg'); if (!a) return;
      const id = (a.getAttribute('href') || '').replace('#view/', ''); if (!real(id)) return;
      let b = c.querySelector('.wh');
      if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'wh'; b.setAttribute('aria-label', 'Save to wishlist'); c.appendChild(b); }
      setBtn(b, id, false);
    });
    const h = document.querySelector('#detail .info h2');
    if (h && typeof CURP !== 'undefined' && CURP && real(CURP.id)) {
      let b = document.getElementById('whd');
      if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'whd'; b.id = 'whd'; h.insertAdjacentElement('afterend', b); }
      setBtn(b, CURP.id, true);
    }
  }
  const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); };
  new MutationObserver(later).observe(document.querySelector('main'), { childList: true, subtree: true });

  async function toggle(id) {
    const u = auth.currentUser;
    if (!u) { toast('Please log in to save favourites'); setTimeout(() => { location.href = 'account.html'; }, 1100); return; }
    const was = WISH.has(id);
    was ? WISH.delete(id) : WISH.add(id); paint();
    try {
      await db.collection('customers').doc(u.uid).set({ wishlist: was ? FV.arrayRemove(id) : FV.arrayUnion(id) }, { merge: true });
      toast(was ? 'Removed from wishlist' : 'Saved to wishlist ♥');
    } catch (e) { was ? WISH.add(id) : WISH.delete(id); paint(); toast('Could not update wishlist'); }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.wh,.whd'); if (!b) return;
    e.preventDefault(); e.stopPropagation(); toggle(b.dataset.id);
  }, true);

  auth.onAuthStateChanged(u => {
    if (unsub) { unsub(); unsub = null; }
    WISH = new Set(); paint();
    if (u) unsub = db.collection('customers').doc(u.uid).onSnapshot(s => { WISH = new Set((s.data() || {}).wishlist || []); paint(); }, () => {});
  });
  paint();
})();
