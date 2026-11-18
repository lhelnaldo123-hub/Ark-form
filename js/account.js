// ARK Form Center - account page logic (Part 1): login, profile, logout, orders + live tracking
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore(), auth = firebase.auth(), $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const validPhone = v => /^[+()\d\s-]{7,20}$/.test(v) && v.replace(/\D/g, '').length >= 7;
const money = n => 'Rs ' + Number(n || 0).toLocaleString();
function msg(id, t, ok) { const m = $('#' + id); m.className = 'msg ' + (ok ? 'ok' : 'err'); m.textContent = t; }
const fe = e => ({ 'auth/invalid-credential': 'Incorrect email or password', 'auth/wrong-password': 'Incorrect email or password', 'auth/user-not-found': 'No account found with this email', 'auth/email-already-in-use': 'This email is already registered', 'auth/weak-password': 'Password must be at least 6 characters', 'auth/invalid-email': 'Please enter a valid email', 'auth/network-request-failed': 'Network problem. Check your internet' }[e.code] || e.message);

// where to go after login (checkout sends people here with ?next=cart)
const QS = new URLSearchParams(location.search), NEXT = QS.get('next'), RATE = QS.get('rate'), STARS = QS.get('stars');
let rateDone = false;
const NEXT_URL = NEXT === 'cart' ? 'index.html#cart' : '';
let CURTAB = 'profile', unsubInbox = null, INBOX = [], REGISTERING = false, ADDR = [], unsubOrders = null, SET = {}, CUST = {}, OL = [];

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

// ---------- tabs ----------
function showTab(t) {
  const TABS = ['profile', 'track', 'orders', 'inbox', 'addresses'];
  if (!TABS.includes(t)) t = 'profile';
  CURTAB = t; if (t === 'inbox') setTimeout(markRead, 1500);
  TABS.forEach(k => $('#t-' + k).style.display = k === t ? '' : 'none');
  document.querySelectorAll('#atabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  history.replaceState(null, '', location.pathname + location.search + '#' + t);
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

// ---------- order tracking (Delivery and Pickup have their own steps) ----------
const FLOW_D = [['Pending', 'Placed'], ['Confirmed', 'Confirmed'], ['Processing', 'Packing'], ['In warehouse', 'In warehouse'], ['Shipped', 'On the way'], ['Delivered', 'Delivered']];
const FLOW_P = [['Pending', 'Placed'], ['Confirmed', 'Confirmed'], ['Processing', 'Packing'], ['In warehouse', 'In warehouse'], ['Ready for pickup', 'Ready for pickup'], ['Picked up', 'Picked up']];
const flowOf = o => o.method === 'Pickup' ? FLOW_P : FLOW_D;
// older orders used 'Completed' (= finished) and 'Ready / Dispatched' (= step 5)
const stepIndex = o => o.status === 'Completed' ? 5 : o.status === 'Ready / Dispatched' ? 4 : flowOf(o).findIndex(x => x[0] === o.status);
const dshort = d => d ? String(d).slice(0, 10) : '';
function stepDate(o, k) {
  if (k === 0) return dshort(o.date);
  const n = flowOf(o)[k][0];
  const h = (o.history || []).slice().reverse().find(x => x.status === n || (k === 5 && x.status === 'Completed') || (k === 4 && x.status === 'Ready / Dispatched'));
  return h ? dshort(h.date) : '';
}
function tracker(o) {
  if (o.status === 'Cancelled') return `<div class="cancelbar">❌ This order was cancelled${o.cancelReason ? ' - ' + esc(o.cancelReason) : ''}</div>`;
  const i = stepIndex(o);
  return '<div class="trk">' + flowOf(o).map((s, k) => {
    const cls = k < i || i === 5 ? 'done' : k === i ? 'now' : '';
    return `<div class="s ${cls}"><i>${cls === 'done' ? '✓' : k + 1}</i>${s[1]}<small>${esc(stepDate(o, k))}</small></div>`;
  }).join('') + '</div>';
}
function pillOf(o) {
  const s = o.status === 'Completed' ? 'Delivered' : o.status === 'Ready / Dispatched' ? (o.method === 'Pickup' ? 'Ready for pickup' : 'Shipped') : o.status;
  return `<span class="pill ${s === 'Delivered' || s === 'Picked up' ? 'ok' : s === 'Cancelled' ? 'bad' : 'act'}">${esc(s)}</span>`;
}

// ---------- rules the admin controls (Admin > Settings) ----------
const isDel = o => ['Delivered', 'Picked up', 'Completed'].includes(o.status);
const returnDays = () => (SET.returnDays === undefined || SET.returnDays === '' ? 7 : +SET.returnDays);
const canCancel = o => o.status === 'Pending' || (o.status === 'Confirmed' && (SET.cancelUntil || 'Confirmed') === 'Confirmed');
function deliveredOn(o) { const h = (o.history || []).slice().reverse().find(x => x.status === 'Delivered' || x.status === 'Completed'); return o.deliveredAt || (h && h.date) || o.date; }
const daysLeft = o => returnDays() - Math.floor((Date.now() - new Date(deliveredOn(o)).getTime()) / 864e5);
const canReturn = o => isDel(o) && !o.returnStatus && returnDays() > 0 && daysLeft(o) > 0;
const CANCEL_WHY = ['Ordered by mistake', 'Found a better price', 'Delivery takes too long', 'Want to change the items', 'Other'];
const RETURN_WHY = ['Damaged / defective', 'Wrong item received', 'Not as described', 'Size / fit problem', 'Changed my mind', 'Other'];
const opts = a => a.map(x => `<option>${x}</option>`).join('');
const itemKey = i => String(i.id || i.name);
const closeF = k => { $('#f' + k).innerHTML = ''; };
const fm = (k, t, ok) => { const m = $('#fm' + k); if (m) { m.className = 'msg ' + (ok ? 'ok' : 'err'); m.textContent = t; } };

function tog(k) { $('#od' + k).classList.toggle('on'); }
function returnInfo(o) {
  if (!o.returnStatus) return '';
  const c = o.returnStatus === 'Rejected' ? 'bad' : o.returnStatus === 'Requested' ? 'act' : 'ok';
  return `<div class="oc" style="background:#faf6ea;margin:10px 0 0;box-shadow:none"><b>Return: <span class="pill ${c}">${esc(o.returnStatus)}</span></b><p class="tag">Reason: ${esc(o.returnReason || '')}</p>${o.returnNote ? `<p class="tag">Message from the shop: ${esc(o.returnNote)}</p>` : ''}</div>`;
}
const STXT = { Pending: 'We have received your order and will confirm it shortly.', Confirmed: 'Your order is confirmed. We are getting it ready.', Processing: 'We are packing your items.', 'In warehouse': 'Your order is in our warehouse.', Shipped: 'Your order is on its way to you.', 'Ready for pickup': 'Ready! Please come and collect it at the shop.' };
const nowStatus = o => o.status === 'Ready / Dispatched' ? (o.method === 'Pickup' ? 'Ready for pickup' : 'Shipped') : o.status;
const itemsHtml = (x, k, reviewBtn) => (x.items || []).map((i, n) => `<div class="it">• ${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''} × ${esc(i.qty)}${reviewBtn ? ((x.reviewedItems || []).includes(itemKey(i)) ? ' <span class="pill ok">Reviewed ✓</span>' : ` <button class="sm" style="padding:3px 10px" onclick="openReview(${k},${n})">⭐ Review</button>`) : ''}</div>`).join('');
const moreHtml = x => `<p>Discount: ${money(x.discount || 0)}${x.coupon ? ' (' + esc(x.coupon) + ')' : ''}${+x.delivery ? '<br>Delivery: ' + money(x.delivery) : ''}${+x.tax ? '<br>Tax: ' + money(x.tax) : ''}<br><b>Total: ${money(x.total)}</b></p>
  <p><b>${x.method === 'Pickup' ? 'Pickup' : 'Deliver to'}</b><br>${esc(x.address)}</p><p>Payment: ${esc(x.payment || '')}</p>${x.notes ? `<p>Notes: ${esc(x.notes)}</p>` : ''}`;
// an order that is still on its way: big tracker, status sentence, timeline
function activeCard(x, k) {
  const st = nowStatus(x), hist = (x.history || []).slice().reverse().map(h => `<li>${esc(h.status)} <span class="tag">${esc(String(h.date || '').slice(0, 16).replace('T', ' '))}</span></li>`).join('');
  return `<div class="oc" style="border-top:4px solid var(--gold)"><div class="oh"><div><div class="trkno">Tracking number</div><b style="font-size:20px">${esc(x.orderNo)}</b><br><span class="tag">Placed ${esc(dshort(x.date))}</span></div>
    <div style="text-align:right"><span class="mb" style="${x.method === 'Pickup' ? 'background:#fff0d9;color:#8a4b00' : ''}">${x.method === 'Pickup' ? '🏬 Pickup' : '🚚 Delivery'}</span><br><b>${money(x.total)}</b></div></div>
    ${tracker(x)}<p style="text-align:center;font-weight:600;color:var(--p)">${esc(STXT[st] || 'Your order is being processed.')}</p>
    ${hist ? `<ul class="tl">${hist}<li>Order placed <span class="tag">${esc(String(x.date || '').slice(0, 16).replace('T', ' '))}</span></li></ul>` : ''}${itemsHtml(x, k, false)}
    <div class="acts"><button class="sm dk" onclick="tog(${k})">View details</button>${canCancel(x) ? `<button class="sm btn-out" onclick="openCancel(${k})">Cancel order</button>` : ''}</div><div id="f${k}"></div><div class="more" id="od${k}">${moreHtml(x)}</div></div>`;
}
// a finished order: compact, with review / return / reorder
function pastCard(x, k) {
  const del = isDel(x); let acts = '';
  if (canReturn(x)) acts += `<button class="sm btn-out" onclick="openReturn(${k})">Return an item</button>`;
  if (x.status !== 'Cancelled') acts += `<button class="sm" onclick="doReorder(${k})">🔁 Reorder</button>`;
  let note = '';
  if (del && !x.returnStatus) note = canReturn(x) ? `<p class="tag">↩ You can return this order within ${returnDays()} days of delivery - ${daysLeft(x)} day(s) left. <a href="index.html#returns">Return policy</a></p>` : returnDays() > 0 ? `<p class="tag">The ${returnDays()}-day return period for this order has ended. <a href="index.html#returns">Return policy</a></p>` : '';
  return `<div class="oc"><div class="oh"><div><b>${esc(x.orderNo)}</b><br><span class="tag">${esc(dshort(x.date))}</span></div><div style="text-align:right">${pillOf(x)}<br><b>${money(x.total)}</b></div></div>
    ${x.status === 'Cancelled' ? tracker(x) : ''}${itemsHtml(x, k, del)}${returnInfo(x)}${note}
    <div class="acts"><button class="sm dk" onclick="tog(${k})">View details</button>${acts}</div><div id="f${k}"></div><div class="more" id="od${k}">${moreHtml(x)}</div></div>`;
}
function drawOrders(list) {
  OL = list;
  const pairs = list.map((x, k) => [x, k]), isAct = o => !isDel(o) && o.status !== 'Cancelled';
  const act = pairs.filter(p => isAct(p[0])), past = pairs.filter(p => !isAct(p[0]));
  $('#trackList').innerHTML = act.length ? act.map(p => activeCard(p[0], p[1])).join('') : '<div class="card" style="text-align:center">📭 No orders on the way right now.<br><br><a class="btn" href="index.html#products">Shop now</a></div>';
  $('#ords').innerHTML = past.length ? past.map(p => pastCard(p[0], p[1])).join('') : '<div class="card" style="text-align:center">Your delivered and cancelled orders will show here.</div>';
  if (RATE && !rateDone) {          // came from the "rate your purchase" pop-up
    const k = list.findIndex(o => o.id === RATE); rateDone = true;
    if (k >= 0) { const o = list[k], n = (o.items || []).findIndex(i => !(o.reviewedItems || []).includes(itemKey(i))); showTab('orders'); if (n >= 0) { openReview(k, n); if (STARS) $('#vr' + k).value = STARS; } }
  }
}

// ---------- cancel ----------
function openCancel(k) {
  $('#f' + k).innerHTML = `<div class="card" style="margin-top:10px"><h4>Cancel this order</h4><select id="cw${k}">${opts(CANCEL_WHY)}</select><textarea id="cn${k}" rows="2" placeholder="Tell us more (optional)"></textarea>
  <button class="sm btn-out" onclick="doCancel(${k})">Confirm cancel</button> <button class="sm dk" onclick="closeF(${k})">Keep my order</button><p class="msg" id="fm${k}"></p></div>`;
}
async function doCancel(k) {
  const o = OL[k]; if (!canCancel(o)) return fm(k, 'This order can no longer be cancelled. Please contact us.', 0);
  const why = $('#cw' + k).value, more = $('#cn' + k).value.trim(), now = new Date().toISOString();
  try {
    await db.collection('orders').doc(o.id).update({ status: 'Cancelled', cancelReason: why + (more ? ': ' + more : ''), cancelledBy: 'Customer', cancelledAt: now, history: firebase.firestore.FieldValue.arrayUnion({ status: 'Cancelled', date: now, by: 'Customer' }) });
  } catch (e) { fm(k, 'Could not cancel: ' + e.message, 0); }
}

// ---------- return ----------
function openReturn(k) {
  $('#f' + k).innerHTML = `<div class="card" style="margin-top:10px"><h4>Request a return</h4><select id="rw${k}">${opts(RETURN_WHY)}</select><textarea id="rn${k}" rows="3" placeholder="Which item and what is the problem?" required></textarea>
  <button class="sm" onclick="doReturn(${k})">Send return request</button> <button class="sm dk" onclick="closeF(${k})">Close</button><p class="msg" id="fm${k}"></p></div>`;
}
async function doReturn(k) {
  const o = OL[k]; if (!canReturn(o)) return fm(k, 'The return period for this order has ended.', 0);
  const more = $('#rn' + k).value.trim(); if (more.length < 5) return fm(k, 'Please describe the problem briefly', 0);
  try { await db.collection('orders').doc(o.id).update({ returnStatus: 'Requested', returnReason: $('#rw' + k).value + ': ' + more, returnRequestedAt: new Date().toISOString() }); }
  catch (e) { fm(k, 'Could not send: ' + e.message, 0); }
}

// ---------- review (after delivery) ----------
function openReview(k, n) {
  const i = OL[k].items[n];
  $('#f' + k).innerHTML = `<div class="card" style="margin-top:10px"><h4>Review: ${esc(i.name)}</h4><select id="vr${k}"><option value="5">★★★★★ Excellent</option><option value="4">★★★★ Good</option><option value="3">★★★ Okay</option><option value="2">★★ Poor</option><option value="1">★ Bad</option></select>
  <textarea id="vc${k}" rows="3" placeholder="Write your review"></textarea><button class="sm" onclick="doReview(${k},${n})">Submit review</button> <button class="sm dk" onclick="closeF(${k})">Close</button><p class="msg" id="fm${k}"></p></div>`;
}
async function doReview(k, n) {
  const o = OL[k], i = o.items[n], c = $('#vc' + k).value.trim(); if (c.length < 5) return fm(k, 'Please write a short review', 0);
  try {
    await db.collection('reviews').add({ name: CUST.name || auth.currentUser.email, rating: +$('#vr' + k).value, comment: c, approved: false, uid: auth.currentUser.uid, productId: i.id || '', productName: i.name, orderNo: o.orderNo, date: new Date().toISOString() });
    try { await db.collection('orders').doc(o.id).update({ reviewedItems: firebase.firestore.FieldValue.arrayUnion(itemKey(i)) }); } catch (e) {}
    alert('Thanks! Your review will show once the shop approves it.');
  } catch (e) { fm(k, 'Could not send: ' + e.message, 0); }
}

// ---------- reorder ----------
async function doReorder(k) {
  const o = OL[k]; let prods = [];
  try { prods = (await db.collection('products').get()).docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { return alert('Could not load products: ' + e.message); }
  let cart = []; try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) {}
  let added = 0, skipped = [];
  (o.items || []).forEach(i => {
    const p = prods.find(x => x.id === i.id), vs = p ? String(p.variants || '').split(',').map(v => v.trim()).filter(Boolean) : [];
    const price = p ? (+p.salePrice > 0 && +p.salePrice < +p.price ? +p.salePrice : +p.price || 0) : 0;
    if (!p || p.published === false || p.stock === false || !price || (vs.length && !vs.includes(i.variant))) return skipped.push(i.name);
    const ex = cart.find(x => x.id === i.id && (x.variant || '') === (i.variant || ''));
    ex ? ex.qty += +i.qty || 1 : cart.push({ id: i.id, name: p.name, category: p.category || '', price, qty: +i.qty || 1, variant: i.variant || '' });
    added++;
  });
  if (!added) return alert('Sorry, none of these items are available right now.');
  try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (e) {}
  if (skipped.length) alert('Not available any more, so not added:\n' + skipped.join('\n'));
  location.href = 'index.html#cart';
}
function watchOrders(u) {
  if (unsubOrders) unsubOrders();
  // live: when the admin changes the status, the tracker updates by itself
  unsubOrders = db.collection('orders').where('uid', '==', u.uid).onSnapshot(s => {
    drawOrders(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || '')));
  }, e => { $('#ords').innerHTML = `<p class="msg err">Could not load your orders: ${esc(e.message)}</p>`; });
}

// ---------- inbox (messages from the shop) ----------
function watchInbox(u) {
  if (unsubInbox) unsubInbox();
  unsubInbox = db.collection('messages').where('uid', '==', u.uid).onSnapshot(s => {
    INBOX = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    drawInbox();
  }, e => { $('#inboxList').innerHTML = `<p class="msg err">Could not load messages: ${esc(e.message)}</p>`; });
}
function drawInbox() {
  const un = INBOX.filter(m => !m.read).length, nb = document.querySelector('#atabs [data-t="inbox"] .nb');
  if (nb) { nb.textContent = un; nb.style.display = un ? '' : 'none'; }
  $('#inboxList').innerHTML = INBOX.length ? INBOX.map(m => `<div class="msgc ${m.read ? '' : 'unread'}"><div class="mt"><span>${esc(m.title)}</span>${m.read ? '' : '<i></i>'}</div><p>${esc(m.body)}</p>
    <div class="md">${esc(String(m.date || '').slice(0, 16).replace('T', ' '))}${m.orderNo ? ' · Order ' + esc(m.orderNo) : ''}${m.orderNo ? ` · <a href="#" onclick="showTab('track');return false">Track it</a>` : ''}</div></div>`).join('')
    : '<div class="card" style="text-align:center">No messages yet. We will tell you here when your order moves.</div>';
  if (CURTAB === 'inbox' && un) setTimeout(markRead, 1500);
}
async function markRead() {
  const un = INBOX.filter(m => !m.read); if (!un.length || CURTAB !== 'inbox') return;
  const b = db.batch(); un.forEach(m => b.update(db.collection('messages').doc(m.id), { read: true }));
  try { await b.commit(); } catch (e) {}
}

// ---------- enter / leave ----------
async function enter(u) {
  $('#out').style.display = 'none'; $('#in').style.display = 'block'; $('#hOut').style.display = '';
  $('#he').textContent = u.email || '';
  try {
    const x = (await db.collection('customers').doc(u.uid).get()).data() || {};
    $('#pn').value = x.name || ''; $('#pph').value = x.phone || ''; $('#pa').value = x.address || '';
    ADDR = Array.isArray(x.addresses) ? x.addresses : []; drawAddr(); CUST = x;
    $('#hn').textContent = x.name || u.email; $('#av').textContent = ((x.name || u.email || 'A')[0] || 'A').toUpperCase();
  } catch (e) { msg('pmsg', e.message, 0); }
  try { SET = (await db.collection('settings').doc('store').get()).data() || {}; } catch (e) {}
  watchOrders(u); watchInbox(u);
  showTab((location.hash || '').slice(1) || 'profile');
}
auth.onAuthStateChanged(u => {
  if (u) {
    if (REGISTERING) return;                 // register() finishes saving the profile, then continues
    if (NEXT_URL) return location.replace(NEXT_URL); // came from checkout: go back to the saved cart
    return enter(u);
  }
  if (unsubOrders) { unsubOrders(); unsubOrders = null; }
  if (unsubInbox) { unsubInbox(); unsubInbox = null; }
  $('#in').style.display = 'none'; $('#out').style.display = 'block'; $('#hOut').style.display = 'none';
  $('#gate').style.display = NEXT_URL ? '' : 'none';
});