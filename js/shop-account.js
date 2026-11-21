// ARK Form Center - checkout (login + Delivery/Pickup), notifications bell, drawer login/logout
// Load this LAST in index.html (after app.js, site-content.js and fx.js).
(function () {
  const auth = firebase.auth();
  const method = () => (document.querySelector('#coForm input[name=method]:checked') || {}).value || 'Delivery';

  // ---- Delivery / Pickup ----
  function syncMethod() {
    const f = document.getElementById('coForm'), pick = method() === 'Pickup', n = document.getElementById('pickNote');
    f.elements.address.style.display = pick ? 'none' : '';
    f.elements.address.required = !pick;
    n.style.display = pick ? '' : 'none';
    n.textContent = '🏬 You will collect your order from ' + (SITE && SITE.address ? SITE.address : 'our shop') + '. No delivery fee. We will message you when it is ready.';
    drawCart();
  }
  document.querySelectorAll('#coForm input[name=method]').forEach(r => r.addEventListener('change', syncMethod));
  const originalFees = fees;
  fees = function () {             // no delivery fee when collecting
    const r = originalFees();
    if (method() === 'Pickup' && r.delivery) { r.total -= r.delivery; r.delivery = 0; }
    return r;
  };

  // ---- checkout: needs login, remembers the cart ----
  checkout = async function (e) {
    e.preventDefault();
    const f = e.target, v = k => f.elements[k].value.trim(), m = method();
    if (!auth.currentUser) {
      try { sessionStorage.setItem('coDraft', JSON.stringify(Object.fromEntries(new FormData(f)))); } catch (x) {}
      fmsg(f, 'Please log in or create an account to place your order. Taking you there...', 0);
      setTimeout(() => { location.href = 'account.html?next=cart'; }, 900);
      return;
    }
    try { const st = await db.collection('staff').doc(auth.currentUser.uid).get(); if (st.exists) return fmsg(f, 'You are logged in as staff. Please log out and use a customer account to place an order.', 0); } catch (x) {}
    if (!cart.length) return fmsg(f, 'Your cart is empty', 0);
    if (v('name').length < 2) return fmsg(f, 'Please enter your full name', 0);
    if (!validPhone(v('phone'))) return fmsg(f, 'Please enter a valid phone number', 0);
    if (v('email') && !/^\S+@\S+\.\S+$/.test(v('email'))) return fmsg(f, 'Please enter a valid email or leave it empty', 0);
    if (m === 'Delivery' && v('address').length < 6) return fmsg(f, 'Please enter your full delivery address', 0);
    const b = f.querySelector('button[type=submit],button:not([type])'); b.disabled = true;
    const no = 'ORD' + Date.now().toString().slice(-7), d = disc(), s = sub(), fe = fees();
    const o = { orderNo: no, method: m, name: v('name'), phone: v('phone'), email: v('email'),
      address: m === 'Pickup' ? 'Pickup at shop' + (SITE && SITE.address ? ' - ' + SITE.address : '') : v('address'),
      notes: v('notes'), items: cart, subtotal: s, discount: d, delivery: fe.delivery, tax: fe.tax, total: fe.total,
      coupon: coupon ? coupon.code : '', payment: m === 'Pickup' ? 'Pay at pickup' : 'Cash on delivery', payStatus: 'Unpaid', status: 'Pending',
      uid: auth.currentUser.uid, date: new Date().toISOString() };
    try {
      const ref = await db.collection('orders').add(o);
      try { await db.collection('messages').add({ uid: o.uid, orderId: ref.id, orderNo: no, title: 'Order received 🧾', body: 'Thank you! We have received your order ' + no + '. Use this number to track it in My Orders > Track Order. We will message you here at every step.', kind: 'received', date: o.date, read: false, by: 'System' }); } catch (x) {}
      if (coupon && coupon.id) { try { await db.collection('offers').doc(coupon.id).update({ used: firebase.firestore.FieldValue.increment(1) }); } catch (x) {} }
      try { sessionStorage.setItem('lastOrder', JSON.stringify(o)); } catch (x) {}
      cart = []; coupon = null; saveCart(); f.reset(); syncMethod(); fmsg(f, '', 1);
      location.hash = '#confirm/' + no;
    } catch (er) { fmsg(f, 'Could not send order: ' + er.message, 0); }
    b.disabled = false;
  };

  // bring back what was typed before the customer went to log in
  try {
    const d = JSON.parse(sessionStorage.getItem('coDraft') || 'null');
    if (d) {
      const f = document.getElementById('coForm').elements;
      ['name', 'phone', 'email', 'address', 'notes'].forEach(k => { if (d[k] && f[k]) f[k].value = d[k]; });
      if (d.method === 'Pickup') f.method.value = 'Pickup';
      sessionStorage.removeItem('coDraft'); syncMethod();
    }
  } catch (x) {}

  // confirmation page -> orders page
  const originalConfirm = drawConfirm;
  drawConfirm = function (no) {
    originalConfirm(no);
    document.querySelectorAll('#confBox a[href="account.html"]').forEach(a => { a.href = 'account.html#track'; a.textContent = '📍 Track my order'; });
    const c = document.querySelector('#confBox .card');
    if (c && !document.getElementById('rcvd')) c.insertAdjacentHTML('beforebegin', `<div class="gate" id="rcvd" style="background:#e6f6ea;border-color:#1b7f3b;color:#14602b">📦 Order received! Your tracking number is <b>${esc(no)}</b>. We also sent it to your Inbox.</div>`);
  };

  // ---- keep the floating cart badge in step with the cart ----
  const originalDraw = drawCart;
  drawCart = function () {
    originalDraw();
    const n = cart.reduce((a, i) => a + i.qty, 0), c2 = document.getElementById('cartn2');
    if (c2) { c2.textContent = n; c2.style.display = n ? '' : 'none'; }
  };
  drawCart();

  // ---- login state: note, button text, drawer, bell badge ----
  let unsubBell = null;
  auth.onAuthStateChanged(async u0 => {
    const staff = await isStaff(u0), u = staff ? null : u0;
    const pv = document.getElementById('prevbar'); if (pv) pv.style.display = staff ? '' : 'none';
    const f = document.getElementById('coForm'), b = f.querySelector('button:not([type=button])'), n = document.getElementById('loginNote');
    if (b) b.textContent = u ? 'Place Order' : 'Log in to place order';
    const to = document.getElementById('topOut'); if (to) to.style.display = u ? '' : 'none';
    if (n) n.style.display = u ? 'none' : '';
    if (unsubBell) { unsubBell(); unsubBell = null; }
    const bell = document.getElementById('inboxn'); let un = 0;
    const paint = () => {
      if (bell) { bell.textContent = un; bell.style.display = un ? '' : 'none'; }
      const d = document.getElementById('dInbox'); if (d) { d.textContent = un ? ' (' + un + ' new)' : ''; }
    };
    if (u) unsubBell = db.collection('messages').where('uid', '==', u.uid).where('read', '==', false).onSnapshot(s => { un = s.size; paint(); }, () => {});
    const box = document.getElementById('dAuth');
    if (box) box.innerHTML = u
      ? `<b>👋 ${esc(u.displayName || u.email)}</b><a class="btn sm" href="account.html">My profile</a><a class="btn dk sm" href="account.html#track">📍 Track order</a><a class="btn dk sm" href="account.html#inbox" style="margin-top:6px">🔔 Inbox<span id="dInbox"></span></a><br><br><button class="btn-out sm" onclick="drawerLogout()">Log out</button>`
      : `<b>Welcome!</b><a class="btn sm" href="account.html">Login / Register</a>`;
    if (staff) {
      if (b) b.textContent = 'Preview only - ordering is off';
      if (n) { n.style.display = ''; n.textContent = '👁 Staff preview: placing orders is disabled. Use a customer account to test ordering.'; }
      if (box) box.innerHTML = '<b>👁 Staff preview</b><a class="btn sm" href="admin.html">← Back to admin</a><br><br><button class="btn-out sm" onclick="drawerLogout()">Log out</button>';
    }
    paint();
    if (u) setTimeout(() => rateCheck(u), 2500);
  });
  // ---- small pop-up: please rate what you bought ----
  async function rateCheck(u) {
    try {
      if (sessionStorage.getItem('rateShown') || Date.now() - (+localStorage.getItem('rateLater') || 0) < 864e5) return;
      const s = await db.collection('orders').where('uid', '==', u.uid).get(), done = ['Delivered', 'Picked up', 'Completed'];
      for (const d of s.docs) {
        const o = d.data(); if (!done.includes(o.status)) continue;
        const rv = o.reviewedItems || [], it = (o.items || []).find(i => !rv.includes(String(i.id || i.name)));
        if (it) return showRate(d.id, o, it);
      }
    } catch (e) {}
  }
  function showRate(id, o, it) {
    try { sessionStorage.setItem('rateShown', '1'); } catch (e) {}
    const el = document.createElement('div'); el.className = 'ratepop';
    el.innerHTML = `<button class="x" aria-label="Close">✕</button><b>⭐ How would you rate your purchase?</b><p>${esc(it.name)} · order ${esc(o.orderNo)}</p>
      <div class="rs">${[1, 2, 3, 4, 5].map(n => `<a href="account.html?rate=${esc(id)}&stars=${n}#orders" aria-label="${n} stars">★</a>`).join('')}</div>
      <a class="btn sm" href="account.html?rate=${esc(id)}#orders">Rate now</a> <button class="sm dk later">Later</button>`;
    const close = () => { try { localStorage.setItem('rateLater', Date.now()); } catch (e) {} el.remove(); };
    el.querySelector('.x').onclick = close; el.querySelector('.later').onclick = close;
    document.body.appendChild(el);
  }
  window.drawerLogout = function () { auth.signOut().then(() => { closeMenu(); toast('You are logged out'); }); };
})();
