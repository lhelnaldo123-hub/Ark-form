// ARK Form Center - customer account: register, login, profile, address book, order history
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
  const TABS = ['profile', 'orders', 'addresses'];
  if (!TABS.includes(t)) t = 'profile';
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

// ---------- order history + order details / status ----------
const dshort = d => d ? String(d).slice(0, 10) : '';
const pillOf = s => `<span class="pill ${s === 'Completed' ? 'ok' : s === 'Cancelled' ? 'bad' : 'act'}">${esc(s)}</span>`;
function tog(k) { $('#od' + k).classList.toggle('on'); }
function orderCard(x, k) {
  const hist = (x.history || []).slice().reverse().map(h => `<li>${esc(h.status)} <span class="tag">${esc(String(h.date || '').slice(0, 16).replace('T', ' '))}</span></li>`).join('');
  return `<div class="oc"><div class="oh"><div><b>${esc(x.orderNo)}</b><br><span class="tag">${esc(dshort(x.date))}</span></div><div style="text-align:right">${pillOf(x.status)}<br><b>${money(x.total)}</b></div></div>
    ${x.status === 'Cancelled' ? `<div class="cancelbar">❌ This order was cancelled${x.cancelReason ? ' - ' + esc(x.cancelReason) : ''}</div>` : ''}
    ${(x.items || []).map(i => `<div class="it">• ${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''} × ${esc(i.qty)}</div>`).join('')}
    <div class="acts"><button class="sm dk" onclick="tog(${k})">Order details</button></div>
    <div class="more" id="od${k}"><p>Subtotal: ${money(x.subtotal ?? x.total)}<br>Discount: ${money(x.discount || 0)}${x.coupon ? ' (' + esc(x.coupon) + ')' : ''}${+x.delivery ? '<br>Delivery: ' + money(x.delivery) : ''}${+x.tax ? '<br>Tax: ' + money(x.tax) : ''}<br><b>Total: ${money(x.total)}</b></p>
    <p><b>Deliver to</b><br>${esc(x.address)}</p><p>Payment: ${esc(x.payment || '')}${x.payStatus ? ' (' + esc(x.payStatus) + ')' : ''}</p>${x.notes ? `<p>Notes: ${esc(x.notes)}</p>` : ''}
    ${hist ? `<h4>Status history</h4><ul class="tl">${hist}<li>Order placed <span class="tag">${esc(String(x.date || '').slice(0, 16).replace('T', ' '))}</span></li></ul>` : ''}</div></div>`;
}
function watchOrders(u) {
  if (unsubOrders) unsubOrders();
  unsubOrders = db.collection('orders').where('uid', '==', u.uid).onSnapshot(s => {
    const list = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('#ords').innerHTML = list.length ? list.map(orderCard).join('') : '<div class="card" style="text-align:center">You have not placed any orders yet.<br><br><a class="btn" href="index.html#products">Start shopping</a></div>';
  }, e => { $('#ords').innerHTML = `<p class="msg err">Could not load your orders: ${esc(e.message)}</p>`; });
}

// ---------- enter / leave ----------
async function enter(u) {
  $('#out').style.display = 'none'; $('#in').style.display = 'block'; $('#hOut').style.display = '';
  $('#he').textContent = u.email || '';
  try {
    const x = (await db.collection('customers').doc(u.uid).get()).data() || {};
    $('#pn').value = x.name || ''; $('#pph').value = x.phone || ''; $('#pa').value = x.address || '';
    ADDR = Array.isArray(x.addresses) ? x.addresses : []; drawAddr();
    $('#hn').textContent = x.name || u.email; $('#av').textContent = ((x.name || u.email || 'A')[0] || 'A').toUpperCase();
  } catch (e) { msg('pmsg', e.message, 0); }
  watchOrders(u);
  showTab((location.hash || '').slice(1) || 'profile');
}
auth.onAuthStateChanged(u => {
  if (u) {
    if (REGISTERING) return;
    if (NEXT_URL) return location.replace(NEXT_URL);
    return enter(u);
  }
  if (unsubOrders) { unsubOrders(); unsubOrders = null; }
  $('#in').style.display = 'none'; $('#out').style.display = 'block'; $('#hOut').style.display = 'none';
  $('#gate').style.display = NEXT_URL ? '' : 'none';
});
