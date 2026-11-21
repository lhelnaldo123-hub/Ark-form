// ARK Form Center - customer account: register, login, profile, address book, orders (track / cancel / return / reorder / rate), inbox
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore(), auth = firebase.auth(), $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const validPhone = v => /^[+()\d\s-]{7,20}$/.test(v) && v.replace(/\D/g, '').length >= 7;
const money = n => 'Rs ' + Number(n || 0).toLocaleString();
function msg(id, t, ok) { const m = $('#' + id); m.className = 'msg ' + (ok ? 'ok' : 'err'); m.textContent = t; }
const fe = e => ({ 'auth/invalid-credential': 'Incorrect email or password', 'auth/wrong-password': 'Incorrect email or password', 'auth/user-not-found': 'No account found with this email', 'auth/email-already-in-use': 'This email is already registered', 'auth/weak-password': 'Password must be at least 6 characters', 'auth/invalid-email': 'Please enter a valid email', 'auth/network-request-failed': 'Network problem. Check your internet' }[e.code] || e.message);

// checkout sends people here with ?next=cart
const NEXT_URL = new URLSearchParams(location.search).get('next') === 'cart' ? 'index.html#cart' : '';
let ADDR = [], unsubOrders = null, REGISTERING = false;
const QS = new URLSearchParams(location.search);
let RATE = QS.get('rate') ? { id: QS.get('rate'), stars: Math.min(5, Math.max(0, +QS.get('stars') || 0)) } : null;

// ---------- login / register / logout ----------
function login() {
  const e = $('#le').value.trim(), p = $('#lp').value;
  if (!e || !p) return msg('lmsg', 'Enter your email and password', 0);
  msg('lmsg', '', 1); auth.signInWithEmailAndPassword(e, p).catch(x => msg('lmsg', fe(x), 0));
}
function reset() {
  const m = $('#le').value.trim(); if (!m) return msg('lmsg', 'Type your email in the Login box first', 0);
  auth.sendPasswordResetEmail(m).then(() => msg('lmsg', 'Reset link sent to your email', 1)).catch(x => msg('lmsg', fe(x), 0));
}
async function register() {
  const n = $('#rn').value.trim(), ph = $('#rph').value.trim(), e = $('#re').value.trim(), p = $('#rp').value;
  if (n.length < 2) return msg('rmsg', 'Please enter your full name', 0);
  if (!validPhone(ph)) return msg('rmsg', 'Please enter a valid phone number', 0);
  if (!/^\S+@\S+\.\S+$/.test(e)) return msg('rmsg', 'Please enter a valid email', 0);
  if (p.length < 6) return msg('rmsg', 'Password must be at least 6 characters', 0);
  REGISTERING = true;
  try {
    const c = await auth.createUserWithEmailAndPassword(e, p);
    await db.collection('customers').doc(c.user.uid).set({ name: n, phone: ph, email: e, address: '', addresses: [], date: new Date().toISOString() });
    REGISTERING = false;
    if (NEXT_URL) return location.replace(NEXT_URL);
    enter(c.user);
  } catch (x) { REGISTERING = false; msg('rmsg', fe(x), 0); }
}
function doLogout() { auth.signOut(); }
// back button: go to the page we came from, or the shop if there is none
function goBack() { if (history.length > 1 && document.referrer) history.back(); else location.href = 'index.html'; }

// ---------- tabs ----------
const TABS = ['profile', 'orders', 'wishlist', 'track', 'inbox', 'addresses'];
let curTab = 'profile';
function showTab(t) {
  if (!TABS.includes(t)) t = 'profile';
  curTab = t;
  TABS.forEach(k => $('#t-' + k).style.display = k === t ? '' : 'none');
  document.querySelectorAll('#atabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  history.replaceState(null, '', location.pathname + location.search + '#' + t);
  if (t === 'inbox') setTimeout(markRead, 1500);
}

// ---------- profile + addresses ----------
async function saveP() {
  const ph = $('#pph').value.trim(); if ($('#pn').value.trim().length < 2) return msg('pmsg', 'Please enter your name', 0);
  if (ph && !validPhone(ph)) return msg('pmsg', 'Please enter a valid phone number', 0);
  try {
    await db.collection('customers').doc(auth.currentUser.uid).set({ name: $('#pn').value.trim(), phone: ph, address: $('#pa').value.trim() }, { merge: true });
    $('#hn').textContent = $('#pn').value.trim(); $('#av').textContent = ($('#pn').value.trim()[0] || 'A').toUpperCase();
    msg('pmsg', 'Profile saved', 1);
  } catch (e) { msg('pmsg', e.message, 0); }
}
function drawAddr() {
  $('#alist').innerHTML = ADDR.length ? ADDR.map((a, k) => `<tr><td><b>${esc(a.label)}</b><br>${esc(a.text)}</td><td><button class="sm" onclick="defAddr(${k})">Use as default</button> <button class="sm btn-out" onclick="delAddr(${k})">Delete</button></td></tr>`).join('') : '<tr><td>No saved addresses yet</td></tr>';
}
async function saveAddr() { try { await db.collection('customers').doc(auth.currentUser.uid).set({ addresses: ADDR }, { merge: true }); drawAddr(); msg('amsg', 'Saved', 1); } catch (e) { msg('amsg', e.message, 0); } }
async function addAddr() { const l = $('#al').value.trim(), t = $('#at').value.trim(); if (t.length < 6) return msg('amsg', 'Please enter the full address', 0); ADDR.push({ label: l || 'Address', text: t }); $('#al').value = ''; $('#at').value = ''; await saveAddr(); }
async function delAddr(k) { ADDR.splice(k, 1); await saveAddr(); }
async function defAddr(k) { try { await db.collection('customers').doc(auth.currentUser.uid).set({ address: ADDR[k].text }, { merge: true }); $('#pa').value = ADDR[k].text; msg('amsg', 'Default delivery address updated', 1); } catch (e) { msg('amsg', e.message, 0); } }

// ---------- orders: status, tracking, cancel, return, reorder, rate ----------
const FV = firebase.firestore.FieldValue;
let RET_DAYS = 7, CUST = {}, ORD = [], MSGS = [], unsubMsgs = null;
const STEPS = ['Pending', 'Confirmed', 'Processing', 'Ready / Dispatched', 'Completed'];
const LEGACY = { 'In warehouse': 'Processing', 'Shipped': 'Ready / Dispatched', 'Ready for pickup': 'Ready / Dispatched', 'Delivered': 'Completed', 'Picked up': 'Completed' };
const stOf = x => LEGACY[x.status] || x.status;
const stepName = (s, x) => s === 'Ready / Dispatched' ? (x.method === 'Pickup' ? 'Ready for pickup' : 'Dispatched') : s === 'Completed' ? (x.method === 'Pickup' ? 'Collected' : 'Delivered') : s;
const dshort = d => d ? String(d).slice(0, 10) : '';
const dtime = d => String(d || '').slice(0, 16).replace('T', ' ');
const pillOf = s => `<span class="pill ${s === 'Completed' ? 'ok' : s === 'Cancelled' ? 'bad' : 'act'}">${esc(s)}</span>`;
const keyOf = i => String(i.id || i.name);
function when(x, s) {
  if (s === 'Pending') return dshort(x.date).slice(5);
  const h = (x.history || []).filter(h => (LEGACY[h.status] || h.status) === s).pop();
  return h ? dshort(h.date).slice(5) : '';
}
function doneAt(x) {
  const h = (x.history || []).filter(h => (LEGACY[h.status] || h.status) === 'Completed').pop();
  return h ? h.date : (x.completedAt || x.date);
}
const canCancel = x => ['Pending', 'Confirmed'].includes(stOf(x));
const retLeft = x => Math.ceil(RET_DAYS - (Date.now() - new Date(doneAt(x)).getTime()) / 864e5);
const canReturn = x => stOf(x) === 'Completed' && !x.returnRequest && RET_DAYS > 0 && retLeft(x) > 0;

function tracker(x) {
  const cur = stOf(x); if (cur === 'Cancelled') return '';
  const i = Math.max(0, STEPS.indexOf(cur)), fin = cur === 'Completed';
  return `<div class="trk">${STEPS.map((s, k) => `<div class="s ${k < i || (fin && k === i) ? 'done' : k === i ? 'now' : ''}"><i>${k < i || (fin && k === i) ? '✓' : k + 1}</i>${esc(stepName(s, x))}<small>${esc(when(x, s))}</small></div>`).join('')}</div>`;
}
const timeline = x => { const hist = (x.history || []).slice().reverse().map(h => `<li>${esc(h.status)} <span class="tag">${esc(dtime(h.date))}</span></li>`).join(''); return `<ul class="tl">${hist}<li>Order placed <span class="tag">${esc(dtime(x.date))}</span></li></ul>`; };
const itemsHtml = x => (x.items || []).map(i => `<div class="it">• ${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''} × ${esc(i.qty)}</div>`).join('');

function tog(k) { $('#od' + k).classList.toggle('on'); }
function orderCard(x, k) {
  const cur = stOf(x), rr = x.returnRequest, rv = x.reviewedItems || [];
  const unrated = (x.items || []).filter(i => !rv.includes(keyOf(i)));
  let acts = `<button class="sm dk" onclick="tog(${k})">Order details</button>`;
  if (canCancel(x)) acts += ` <button class="sm btn-out" onclick="openAct(${k},'cancel')">Cancel order</button>`;
  if (cur === 'Completed' && unrated.length) acts += ` <button class="sm" onclick="openAct(${k},'rate')">⭐ Rate items</button>`;
  if (canReturn(x)) acts += ` <button class="sm" onclick="openAct(${k},'return')">↩ Return</button>`;
  if (cur === 'Completed' || cur === 'Cancelled') acts += ` <button class="sm" onclick="reorder(${k})">🔁 Reorder</button>`;
  let info = '';
  if (cur === 'Completed') {
    if (rr) info = `<p class="rinfo"><span class="rtag ${rr.status === 'Approved' ? 'ok' : rr.status === 'Rejected' ? 'bad' : ''}">Return ${esc(rr.status.toLowerCase())}</span> ${esc(rr.reason || '')}${rr.reply ? '<br>Our reply: ' + esc(rr.reply) : ''}</p>`;
    else if (RET_DAYS > 0) info = canReturn(x) ? `<p class="rinfo">You can return this order within ${RET_DAYS} days of delivery. ${retLeft(x)} day(s) left.</p>` : `<p class="rinfo">The ${RET_DAYS}-day return window for this order has closed.</p>`;
  } else if (cur !== 'Cancelled' && !canCancel(x)) info = '<p class="rinfo">This order is already being prepared, so it can no longer be cancelled online. Please contact us if you need help.</p>';
  return `<div class="oc"><div class="oh"><div><span class="trkno">Order number</span><br><b>${esc(x.orderNo)}</b><br><span class="tag">${esc(dshort(x.date))}${x.method ? ' · ' + esc(x.method) : ''}</span></div><div style="text-align:right">${pillOf(cur)}<br><b>${money(x.total)}</b></div></div>
    ${cur === 'Cancelled' ? `<div class="cancelbar">❌ This order was cancelled${x.cancelledBy === 'Customer' ? ' by you' : ''}${x.cancelReason ? ' - ' + esc(x.cancelReason) : ''}</div>` : tracker(x)}
    ${itemsHtml(x)}${info}
    <div class="acts">${acts}</div><div id="act${k}"></div>
    <div class="more" id="od${k}"><p>Subtotal: ${money(x.subtotal ?? x.total)}<br>Discount: ${money(x.discount || 0)}${x.coupon ? ' (' + esc(x.coupon) + ')' : ''}${+x.delivery ? '<br>Delivery: ' + money(x.delivery) : ''}${+x.tax ? '<br>Tax: ' + money(x.tax) : ''}<br><b>Total: ${money(x.total)}</b></p>
    <p><b>${x.method === 'Pickup' ? 'Pickup' : 'Deliver to'}</b><br>${esc(x.address)}</p><p>Payment: ${esc(x.payment || '')}${x.payStatus ? ' (' + esc(x.payStatus) + ')' : ''}</p>${x.notes ? `<p>Notes: ${esc(x.notes)}</p>` : ''}
    <h4>Status history</h4>${timeline(x)}</div></div>`;
}
const trackCard = x => `<div class="oc"><div class="oh"><div><span class="trkno">Order number</span><br><b>${esc(x.orderNo)}</b><br><span class="tag">${esc(dshort(x.date))}${x.method ? ' · ' + esc(x.method) : ''}</span></div><div style="text-align:right">${pillOf(stOf(x))}<br><b>${money(x.total)}</b></div></div>
  ${stOf(x) === 'Cancelled' ? `<div class="cancelbar">❌ Cancelled${x.cancelReason ? ' - ' + esc(x.cancelReason) : ''}</div>` : tracker(x)}${itemsHtml(x)}<h4>Status history</h4>${timeline(x)}</div>`;

function drawOrders() {
  $('#retline').textContent = RET_DAYS > 0 ? `Returns are accepted within ${RET_DAYS} days after delivery.` : 'Returns are not accepted online. Please contact us.';
  $('#ords').innerHTML = ORD.length ? ORD.map(orderCard).join('') : '<div class="card" style="text-align:center">You have not placed any orders yet.<br><br><a class="btn" href="index.html#products">Start shopping</a></div>';
  const act = ORD.filter(x => !['Completed', 'Cancelled'].includes(stOf(x)));
  $('#trkactive').innerHTML = act.length ? act.map(trackCard).join('') : '<p class="tag">No orders in progress.</p>';
}
function trackNo() {
  const q = $('#tno').value.trim().toUpperCase().replace(/\s/g, ''), out = $('#trkres');
  if (!q) return out.innerHTML = '<p class="msg err">Type your order number first</p>';
  const x = ORD.find(o => String(o.orderNo).toUpperCase() === q);
  out.innerHTML = x ? trackCard(x) : '<p class="msg err">No order with this number was found on your account.</p>';
}

// ---- inline action forms ----
function openAct(k, type) {
  const x = ORD[k], box = $('#act' + k);
  if (box.dataset.t === type && box.innerHTML) { box.innerHTML = ''; box.dataset.t = ''; return; }
  box.dataset.t = type;
  if (type === 'cancel') box.innerHTML = `<div class="afrm"><b>Cancel order ${esc(x.orderNo)}?</b><select id="crs${k}"><option>Changed my mind</option><option>Ordered by mistake</option><option>Found a better price</option><option>Delivery will take too long</option><option>Other</option></select><textarea id="cr${k}" rows="2" placeholder="More details (required if you choose Other)"></textarea><button class="btn-out sm" onclick="doCancel(${k})">Yes, cancel this order</button> <button class="sm dk" onclick="openAct(${k},'cancel')">Keep my order</button><p class="msg" id="am${k}"></p></div>`;
  if (type === 'return') box.innerHTML = `<div class="afrm"><b>Return order ${esc(x.orderNo)}</b><p class="tag">Returns are accepted within ${RET_DAYS} days of delivery. Our team will review your request and reply in your Inbox.</p><select id="rrs${k}"><option>Item damaged</option><option>Wrong item received</option><option>Not as described</option><option>Quality problem</option><option>Other</option></select><textarea id="rr${k}" rows="3" placeholder="Please describe the problem (required)"></textarea><button class="sm" onclick="doReturn(${k})">Send return request</button> <button class="sm dk" onclick="openAct(${k},'return')">Close</button><p class="msg" id="am${k}"></p></div>`;
  if (type === 'rate') {
    const rv = x.reviewedItems || [], list = (x.items || []).filter(i => !rv.includes(keyOf(i)));
    const pre = RATE && RATE.id === x.id ? RATE.stars : 0;
    box.innerHTML = `<div class="afrm"><b>Rate what you bought</b>${list.map((i, j) => `<div class="rb" id="rb${k}_${j}"><div>${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''}</div><div class="stin" data-v="${pre}">${[1, 2, 3, 4, 5].map(n => `<span class="${n <= pre ? 'on' : ''}" onclick="setStar(${k},${j},${n})">★</span>`).join('')}</div><textarea id="rc${k}_${j}" rows="2" placeholder="Your review (at least 5 characters)"></textarea><button class="sm" onclick="doRate(${k},${j})">Submit review</button><p class="msg" id="rm${k}_${j}"></p></div>`).join('')}<p class="tag">Reviews appear on the website after the shop approves them.</p></div>`;
  }
}
function setStar(k, j, n) { const s = $(`#rb${k}_${j} .stin`); s.dataset.v = n; s.querySelectorAll('span').forEach((e, i) => e.classList.toggle('on', i < n)); }

async function doCancel(k) {
  const x = ORD[k], base = $('#crs' + k).value, more = $('#cr' + k).value.trim();
  if (base === 'Other' && more.length < 3) return msg('am' + k, 'Please tell us the reason', 0);
  if (!canCancel(x)) return msg('am' + k, 'This order can no longer be cancelled online', 0);
  const now = new Date().toISOString(), reason = base + (more ? ' - ' + more : '');
  try {
    await db.collection('orders').doc(x.id).update({ status: 'Cancelled', cancelReason: reason, cancelledBy: 'Customer', cancelledAt: now, history: FV.arrayUnion({ status: 'Cancelled', date: now, by: 'Customer' }) });
  } catch (e) { msg('am' + k, 'Could not cancel: ' + e.message, 0); }
}
async function doReturn(k) {
  const x = ORD[k], base = $('#rrs' + k).value, more = $('#rr' + k).value.trim();
  if (more.length < 5) return msg('am' + k, 'Please describe the problem', 0);
  if (!canReturn(x)) return msg('am' + k, 'The return window for this order has closed', 0);
  const now = new Date().toISOString();
  try {
    await db.collection('orders').doc(x.id).update({ returnRequest: { reason: base + ' - ' + more, date: now, status: 'Requested' }, history: FV.arrayUnion({ status: 'Return requested', date: now, by: 'Customer' }) });
  } catch (e) { msg('am' + k, 'Could not send request: ' + e.message, 0); }
}
async function doRate(k, j) {
  const x = ORD[k], rv = x.reviewedItems || [], i = (x.items || []).filter(i => !rv.includes(keyOf(i)))[j], id = `${k}_${j}`;
  if (!i) return;
  const stars = +$(`#rb${id} .stin`).dataset.v, c = $('#rc' + id).value.trim();
  if (!stars) return msg('rm' + id, 'Tap the stars to rate', 0);
  if (c.length < 5) return msg('rm' + id, 'Please write a short review', 0);
  try {
    await db.collection('reviews').add({ name: CUST.name || auth.currentUser.email, rating: stars, comment: c, approved: false, uid: auth.currentUser.uid, orderId: x.id, orderNo: x.orderNo, productId: String(i.id || ''), productName: i.name, date: new Date().toISOString() });
    await db.collection('orders').doc(x.id).update({ reviewedItems: FV.arrayUnion(keyOf(i)) });
    msg('rm' + id, 'Thank you! Your review will show after approval.', 1);
  } catch (e) { msg('rm' + id, e.message, 0); }
}
async function reorder(k) {
  const x = ORD[k]; let cart = []; try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) {}
  let added = 0; const skipped = [];
  for (const i of x.items || []) {
    try {
      const d = await db.collection('products').doc(String(i.id)).get(); if (!d.exists) { skipped.push(i.name); continue; }
      const p = d.data(), n = +p.price || 0, s = +p.salePrice, price = s > 0 && s < n ? s : n;
      if (p.stock === false || p.published === false || !price) { skipped.push(i.name); continue; }
      const f = cart.find(c => c.id === i.id && (c.variant || '') === (i.variant || ''));
      f ? f.qty += +i.qty || 1 : cart.push({ id: i.id, name: p.name, category: p.category || '', price, qty: +i.qty || 1, variant: i.variant || '' });
      added++;
    } catch (e) { skipped.push(i.name); }
  }
  if (!added) return alert('Sorry, these items are not available right now' + (skipped.length ? ': ' + skipped.join(', ') : ''));
  try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (e) {}
  if (skipped.length) alert('Added to your cart. Not available right now: ' + skipped.join(', ') + '. Prices are today\'s prices.');
  location.href = 'index.html#cart';
}

function watchOrders(u) {
  if (unsubOrders) unsubOrders();
  unsubOrders = db.collection('orders').where('uid', '==', u.uid).onSnapshot(s => {
    ORD = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    drawOrders();
    if (RATE) {
      const k = ORD.findIndex(o => o.id === RATE.id);
      if (k >= 0 && stOf(ORD[k]) === 'Completed' && (ORD[k].items || []).some(i => !(ORD[k].reviewedItems || []).includes(keyOf(i)))) { showTab('orders'); openAct(k, 'rate'); const b = $('#act' + k); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      RATE = null; history.replaceState(null, '', location.pathname + '#orders');
    }
  }, e => { $('#ords').innerHTML = `<p class="msg err">Could not load your orders: ${esc(e.message)}</p>`; });
}

// ---------- inbox ----------
async function markRead() {
  const un = MSGS.filter(m => m.read === false); if (!un.length || curTab !== 'inbox') return;
  try { const b = db.batch(); un.forEach(m => b.update(db.collection('messages').doc(m.id), { read: true })); await b.commit(); } catch (e) {}
}
function watchInbox(u) {
  if (unsubMsgs) unsubMsgs();
  unsubMsgs = db.collection('messages').where('uid', '==', u.uid).onSnapshot(s => {
    MSGS = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const un = MSGS.filter(m => m.read === false).length, nb = $('#nb'); nb.textContent = un; nb.style.display = un ? '' : 'none';
    $('#msgs').innerHTML = MSGS.length ? MSGS.map(m => `<div class="msgc ${m.read === false ? 'unread' : ''}"><div class="mt"><span>${esc(m.title)}</span>${m.read === false ? '<i></i>' : ''}</div><p>${esc(m.body)}</p><div class="md">${esc(dtime(m.date))}${m.orderNo ? ' · ' + esc(m.orderNo) : ''}</div></div>`).join('') : '<div class="card" style="text-align:center">No messages yet. We will tell you here whenever your order changes.</div>';
    if (curTab === 'inbox') setTimeout(markRead, 1500);
  }, e => { $('#msgs').innerHTML = `<p class="msg err">Could not load messages: ${esc(e.message)}</p>`; });
}

// ---------- wishlist (customers/<uid>.wishlist = product ids) ----------
let unsubWish = null, WISH = [], WPROD = {};
const effP = p => { const n = +p.price || 0, s = +p.salePrice; return s > 0 && s < n ? s : n; };
const wImg = p => [...(Array.isArray(p.images) ? p.images : String(p.images || '').split('\n')), ...String(p.image || '').split('\n')].map(x => String(x || '').trim()).find(x => /^(https?:\/\/|data:image\/)/i.test(x)) || '';
async function loadWish() {
  await Promise.all(WISH.filter(id => !(id in WPROD)).map(async id => {
    try { const d = await db.collection('products').doc(String(id)).get(); WPROD[id] = d.exists ? { id: d.id, ...d.data() } : null; } catch (e) { WPROD[id] = null; }
  }));
}
function drawWish() {
  $('#wlist').innerHTML = WISH.length ? WISH.map(id => {
    const p = WPROD[id];
    if (!p) return `<div class="oc"><b>This product is no longer available</b><div class="acts"><button class="sm btn-out" onclick="wDel('${esc(id)}')">Remove</button></div></div>`;
    const pr = effP(p), im = wImg(p), out = p.stock === false || p.published === false;
    return `<div class="oc"><div class="wlr"><div class="wth">${im ? `<img src="${esc(im)}" alt="">` : esc((p.name || '?')[0])}</div>
      <div><b>${esc(p.name)}</b><br><span class="tag">${esc(p.category || '')}</span><br><b>${pr ? money(pr) : 'Enquire for price'}</b> ${out ? '<span class="rtag bad">Out of stock</span>' : '<span class="rtag ok">In stock</span>'}</div></div>
      <div class="acts"><a class="btn sm" href="index.html#view/${esc(id)}">View</a>${out ? '' : ` <button class="sm" onclick="wAdd('${esc(id)}',this)">🛒 Add to cart</button>`} <button class="sm btn-out" onclick="wDel('${esc(id)}')">Remove</button></div></div>`;
  }).join('') : '<div class="card" style="text-align:center">Your wishlist is empty.<br>Tap the ♡ on any product to save it here.<br><br><a class="btn" href="index.html#products">Browse products</a></div>';
}
function watchWish(u) {
  if (unsubWish) unsubWish();
  unsubWish = db.collection('customers').doc(u.uid).onSnapshot(async s => { WISH = (s.data() || {}).wishlist || []; await loadWish(); drawWish(); }, e => { $('#wlist').innerHTML = `<p class="msg err">Could not load your wishlist: ${esc(e.message)}</p>`; });
}
async function wDel(id) { try { await db.collection('customers').doc(auth.currentUser.uid).set({ wishlist: FV.arrayRemove(id) }, { merge: true }); } catch (e) { alert('Could not remove: ' + e.message); } }
function wAdd(id, btn) {
  const p = WPROD[id]; if (!p) return;
  if (String(p.variants || '').trim() || !effP(p)) { location.href = 'index.html#view/' + id; return; }   // needs a size/option or a quote
  let cart = []; try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) {}
  const f = cart.find(c => c.id === id && !(c.variant || ''));
  f ? f.qty++ : cart.push({ id, name: p.name, category: p.category || '', price: effP(p), qty: 1, variant: '' });
  try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (e) {}
  btn.textContent = 'Added ✓'; setTimeout(() => { btn.textContent = '🛒 Add to cart'; }, 1600);
}

// ---------- enter / leave ----------
async function isStaffUser(u) {
  try { const d = await db.collection('staff').doc(u.uid).get(); return d.exists && d.data().active !== false; } catch (e) { return false; }
}
async function enter(u) {
  $('#boot').style.display = 'none'; $('#out').style.display = 'none'; $('#hOut').style.display = '';
  if (await isStaffUser(u)) {      // admin / staff accounts are not customers: never show customer orders
    $('#in').style.display = 'none'; $('#staffbox').style.display = 'block';
    $('#staffwho').textContent = u.email || ''; return;
  }
  $('#staffbox').style.display = 'none'; $('#in').style.display = 'block';
  $('#he').textContent = u.email || '';
  try {
    const x = (await db.collection('customers').doc(u.uid).get()).data() || {}; CUST = x;
    $('#pn').value = x.name || ''; $('#pph').value = x.phone || ''; $('#pa').value = x.address || '';
    ADDR = Array.isArray(x.addresses) ? x.addresses : []; drawAddr();
    $('#hn').textContent = x.name || u.email; $('#av').textContent = ((x.name || u.email || 'A')[0] || 'A').toUpperCase();
  } catch (e) { msg('pmsg', e.message, 0); }
  try { const s = (await db.collection('settings').doc('store').get()).data() || {}; if (s.returnDays !== undefined && s.returnDays !== '') RET_DAYS = Math.max(0, +s.returnDays || 0); } catch (e) {}
  watchOrders(u); watchInbox(u); watchWish(u);
  showTab(RATE ? 'orders' : (location.hash || '').slice(1) || 'profile');
}
auth.onAuthStateChanged(u => {
  if (u) {
    if (REGISTERING) return;
    if (NEXT_URL) return location.replace(NEXT_URL);
    return enter(u);
  }
  if (unsubOrders) { unsubOrders(); unsubOrders = null; }
  if (unsubMsgs) { unsubMsgs(); unsubMsgs = null; }
  if (unsubWish) { unsubWish(); unsubWish = null; }
  $('#boot').style.display = 'none'; $('#in').style.display = 'none'; $('#staffbox').style.display = 'none';
  $('#out').style.display = 'block'; $('#hOut').style.display = 'none';
  const want = (location.hash || '').slice(1), g = $('#gate');
  const why = { orders: 'view your orders', track: 'track your order', inbox: 'see your messages', wishlist: 'see your wishlist', addresses: 'see your addresses', profile: 'see your profile' };
  if (NEXT_URL) { g.textContent = '🔒 Please log in or create an account to place your order. Your cart is saved and will be waiting for you.'; g.style.display = ''; }
  else if (why[want]) { g.textContent = '🔒 Please log in to ' + why[want] + '. New here? Create an account below.'; g.style.display = ''; }
  else g.style.display = 'none';
});
