firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'Rs ' + Number(n || 0).toLocaleString();
const today = () => new Date().toISOString().slice(0, 10);
const safeUrl = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
const validPhone = v => /^[+()\d\s-]{7,20}$/.test(v) && v.replace(/\D/g, '').length >= 7;
let cart = []; try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) {}
let PRODUCTS = [], PACKAGES = [], OFFERS = [], CATS = [], coupon = null, READY = false, CUR = '';
const COLORS = ['#2a9d8f', '#1f3a5f', '#e9c46a', '#e76f51', '#6a4c93', '#457b9d'];

// Sample data shows until the admin adds real items (no real business facts invented)
const sp = (n, c, price) => ({ id: 'd' + n, name: 'Sample Product ' + n, category: c, price, stock: true, description: 'Sample item - admin can replace', image: '' });
const DEMO = {
  products: [sp(1, 'Featured', 350), sp(2, 'Featured', 500), sp(3, 'Featured', 750), sp(4, 'Popular', 1200), sp(5, 'Popular', 900), sp(6, 'New Arrivals', 1500), sp(7, 'New Arrivals', 2200), sp(8, 'Bundles', 2500)],
  packages: [{ id: 'p1', name: 'Starter Package', items: 'Sample Product 1 + 2', normal: 850, price: 700 }, { id: 'p2', name: 'Business Package', items: 'Sample Product 3 + 4 + 5', normal: 2850, price: 2400 }, { id: 'p3', name: 'Bulk Package', items: 'Sample Product 6 + 7 + 8', normal: 6200, price: 5300 }],
  offers: [{ id: 'o1', title: 'Welcome Offer', code: 'WELCOME10', type: 'percent', value: 10, min: 0, details: '10% off your order (sample)' }, { id: 'o2', title: 'Big Order Offer', code: 'SAVE200', type: 'fixed', value: 200, min: 2000, details: 'Rs 200 off orders above Rs 2000 (sample)' }]
};
async function load(c) {
  try { const s = await db.collection(c).get(); const r = s.docs.map(d => ({ id: d.id, ...d.data() })); return r.length ? r : (DEMO[c] || []); }
  catch (e) { return DEMO[c] || []; }
}

// ---------- small helpers ----------
let tt;
function toast(t) {
  let e = $('#toast'); if (!e) { e = document.createElement('div'); e.id = 'toast'; e.className = 'toast'; document.body.appendChild(e); }
  e.textContent = t; e.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('on'), 1800);
}
function fmsg(f, t, ok) {
  let m = f.querySelector('.msg'); if (!m) { m = document.createElement('p'); f.appendChild(m); }
  m.className = 'msg ' + (ok ? 'ok' : 'err'); m.textContent = t;
}
const eff = p => { const s = +p.salePrice, n = +p.price || 0; return s > 0 && s < n ? s : n; };
const images = p => [...new Set([p.image, ...(Array.isArray(p.images) ? p.images : String(p.images || '').split(','))].map(s => String(s || '').trim()).filter(Boolean))];
const variants = p => String(p.variants || '').split(',').map(s => s.trim()).filter(Boolean);
const short = t => { t = String(t || ''); return t.length > 90 ? t.slice(0, 90) + '…' : t; };
const status = p => p.stock === false ? '<span class="badge out">Out of Stock</span>' : eff(p) ? '<span class="badge">In Stock</span>' : '<span class="badge">Enquire for Price</span>';
const priceHtml = p => eff(p) ? (eff(p) < +p.price ? `<span class="old">${money(p.price)}</span>` : '') + `<span class="price">${money(eff(p))}</span>` : '<span class="price">Enquire for Price</span>';
const img = p => { const i = images(p)[0]; return i ? `<img src="${esc(i)}" alt="">` : `<div class="ph" style="background:${COLORS[(p.name || '').length % 6]}">${esc((p.name || '?')[0])}</div>`; };
const liveP = k => k.active !== false && (!k.validity || k.validity >= today());
const liveO = o => o.active !== false && (!o.start || o.start <= today()) && (!o.expiry || o.expiry >= today());
function sorted(list, mode) {
  const a = [...list];
  if (mode === 'lo') a.sort((x, y) => eff(x) - eff(y));
  else if (mode === 'hi') a.sort((x, y) => eff(y) - eff(x));
  else if (mode === 'new') a.sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  return a;
}

// ---------- cards ----------
const buyBtn = p => p.stock === false ? '<button disabled>Out of Stock</button>'
  : !eff(p) ? `<button onclick="quote('${esc(p.id)}')">Request a Quote</button>`
  : `<button onclick="addCart('${esc(p.id)}')">Add to Cart</button>`;
const pcard = p => `<div class="card"><a class="plain" href="#view/${esc(p.id)}">${img(p)}<h4>${esc(p.name)}</h4></a>
  <div class="tag">${esc(p.category || '')} · ${status(p)}</div><div>${priceHtml(p)}</div><p>${esc(short(p.description))}</p>
  <a class="btn" href="#view/${esc(p.id)}" style="background:var(--p)">Details</a> ${buyBtn(p)}</div>`;
const pkcard = k => `<div class="card"><h4>${esc(k.name)}</h4><p>${esc(k.items)}</p>
  <div>${+k.normal ? `<span class="old">${money(k.normal)}</span>` : ''}<span class="price">${money(k.price)}</span></div>
  ${+k.normal > +k.price ? `<p><span class="badge">Save ${money(k.normal - k.price)}</span></p>` : ''}
  ${k.validity ? `<p class="tag">Valid until ${esc(k.validity)}</p>` : ''}${k.conditions ? `<p class="tag">Conditions: ${esc(k.conditions)}</p>` : ''}${k.options ? `<p class="tag">Customisation: ${esc(k.options)}</p>` : ''}
  <button onclick="enquirePkg('${esc(k.id)}')">Enquire / Request Package</button></div>`;
const ocard = o => `<div class="card">${o.image ? `<img src="${esc(o.image)}" alt="">` : ''}<h4>${esc(o.title)}</h4><p>${esc(o.details || '')}</p>
  <p class="price">${o.type === 'percent' ? (+o.value || 0) + '% off' : money(o.value) + ' off'}</p>${+o.min ? `<p class="tag">Minimum order ${money(o.min)}</p>` : ''}
  <p class="tag">${o.start ? 'From ' + esc(o.start) + ' ' : ''}${o.expiry ? 'Until ' + esc(o.expiry) : ''}</p>
  ${o.code ? `<p><b>Code: ${esc(o.code)}</b></p><p class="tag">Enter this code in your cart to get the discount.</p>` : ''}</div>`;

// ---------- pages ----------
function show() {
  const raw = (location.hash || '#home').slice(1), i = raw.indexOf('/');
  const h = i < 0 ? raw : raw.slice(0, i); let arg = i < 0 ? '' : raw.slice(i + 1);
  try { arg = decodeURIComponent(arg); } catch (e) {}
  const el = document.getElementById(h), id = el && el.classList.contains('page') ? h : 'home';
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === id));
  if (id === 'view') drawDetail(arg);
  if (id === 'category') drawCategory(arg);
  if (id === 'confirm') drawConfirm(arg);
  scrollTo(0, 0);
}
addEventListener('hashchange', show);

function drawProducts() {
  const q = ($('#search').value || '').toLowerCase(), c = $('#cat').value;
  const l = sorted(PRODUCTS.filter(p => (!q || (p.name || '').toLowerCase().includes(q)) && (!c || p.category === c)), $('#sort').value);
  $('#plist').innerHTML = l.length ? l.map(pcard).join('') : '<p>No products match your search. Try another keyword or category.</p>';
}
function drawCategory(n) {
  CUR = n; const q = ($('#csearch').value || '').toLowerCase();
  $('#catTitle').textContent = n;
  const c = CATS.find(x => x.name === n); $('#catDesc').textContent = c && c.description ? c.description : '';
  const l = sorted(PRODUCTS.filter(p => p.category === n && (!q || (p.name || '').toLowerCase().includes(q))), $('#csort').value);
  $('#clistc').innerHTML = l.length ? l.map(pcard).join('') : '<p>No products in this category yet.</p>';
}
function gpick(el) {
  $('#gmain').src = el.src; document.querySelectorAll('.thumbs img').forEach(i => i.classList.toggle('sel', i === el));
}
function drawDetail(id) {
  const box = $('#detail');
  if (!READY) { box.innerHTML = '<p>Loading...</p>'; return; }
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) { box.innerHTML = '<p>Product not found. <a href="#products">Back to products</a></p>'; return; }
  const im = images(p), vs = variants(p);
  const rel = PRODUCTS.filter(x => x.id !== p.id && x.category === p.category).slice(0, 4);
  const pk = PACKAGES.filter(k => (k.items || '').toLowerCase().includes((p.name || '').toLowerCase()));
  box.innerHTML = `<p class="crumb"><a href="#products">Products</a> › ${p.category ? `<a href="#category/${encodeURIComponent(p.category)}">${esc(p.category)}</a> › ` : ''}${esc(p.name)}</p>
  <div class="two eq"><div class="gal">${im.length ? `<img class="main" id="gmain" src="${esc(im[0])}" alt="">` + (im.length > 1 ? `<div class="thumbs">${im.map((u, k) => `<img src="${esc(u)}" class="${k ? '' : 'sel'}" onclick="gpick(this)" alt="">`).join('')}</div>` : '') : `<div class="ph" style="height:260px;background:${COLORS[(p.name || '').length % 6]}">${esc((p.name || '?')[0])}</div>`}</div>
  <div class="card"><h2 style="margin-top:0">${esc(p.name)}</h2><p>${status(p)}</p><p>${priceHtml(p)}</p>
  <p style="white-space:pre-wrap">${esc(p.description || '')}</p>
  ${p.specs ? `<h4>Specifications</h4><p style="white-space:pre-wrap">${esc(p.specs)}</p>` : ''}${p.sku ? `<p class="tag">SKU: ${esc(p.sku)}</p>` : ''}
  ${vs.length ? `<label class="tag">Size / variant</label><select id="dvar">${vs.map(v => `<option>${esc(v)}</option>`).join('')}</select>` : ''}
  ${p.stock !== false && eff(p) ? `<label class="tag">Quantity</label><input id="dqty" type="number" min="1" value="1"><button onclick="addDetail('${esc(p.id)}')">Add to Cart</button> ` : ''}
  <button style="background:var(--p)" onclick="quote('${esc(p.id)}')">${eff(p) ? 'Request Information' : 'Request a Quote'}</button></div></div>
  ${pk.length ? `<h3>Included in packages</h3><div class="grid">${pk.map(pkcard).join('')}</div>` : ''}
  ${rel.length ? `<h3>Related products</h3><div class="grid">${rel.map(pcard).join('')}</div>` : ''}`;
}
function addDetail(id) {
  const v = $('#dvar') ? $('#dvar').value : undefined;
  addCart(id, v, $('#dqty') ? $('#dqty').value : 1);
}
function prefill(type, msg) {
  const f = $('#enqForm'); f.elements.type.value = type; f.elements.message.value = msg; location.hash = '#contact';
}
function quote(id) { const p = PRODUCTS.find(x => x.id === id); if (p) prefill(eff(p) ? 'Product Information' : 'Pricing', 'I would like information / a quote for: ' + p.name); }
function enquirePkg(id) { const k = PACKAGES.find(x => x.id === id); if (k) prefill('Package / Bulk Order', 'I am interested in the package: ' + k.name); }

// ---------- cart ----------
function saveCart() { try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (e) {} drawCart(); }
function addCart(id, variant, qty) {
  const p = PRODUCTS.find(x => x.id === id); if (!p) return;
  if (p.stock === false) return toast('Out of stock');
  if (variants(p).length && variant === undefined) { location.hash = '#view/' + id; return toast('Please choose a size / option'); }
  qty = Math.max(1, parseInt(qty) || 1);
  const i = cart.find(x => x.id === id && (x.variant || '') === (variant || ''));
  i ? i.qty += qty : cart.push({ id, name: p.name, price: eff(p), qty, variant: variant || '' });
  saveCart(); toast('Added to cart');
}
function setQty(k, v) { cart[k].qty = Math.max(1, parseInt(v) || 1); saveCart(); }
function rmItem(k) { cart.splice(k, 1); saveCart(); }
const sub = () => cart.reduce((s, i) => s + i.price * i.qty, 0);
function disc() {
  const t = sub();
  if (!coupon || t < (+coupon.min || 0)) return 0;
  return Math.min(t, coupon.type == 'percent' ? Math.round(t * coupon.value / 100) : +coupon.value);
}
function drawCart() {
  const t = sub(), d = disc();
  $('#cartn').textContent = cart.reduce((s, i) => s + i.qty, 0);
  const low = coupon && t < (+coupon.min || 0) ? ' - minimum spend ' + money(coupon.min) : '';
  $('#clist').innerHTML = cart.length ? '<tr><th>Item</th><th>Price</th><th>Qty</th><th></th></tr>' + cart.map((i, k) => `<tr><td>${esc(i.name)}${i.variant ? `<br><span class="tag">${esc(i.variant)}</span>` : ''}</td><td>${money(i.price)}</td>
   <td><input type="number" min="1" value="${i.qty}" style="width:64px;margin:0" onchange="setQty(${k},this.value)"></td><td><button onclick="rmItem(${k})">x</button></td></tr>`).join('') +
    `<tr><td colspan=4>Subtotal: ${money(t)}</td></tr><tr><td colspan=4>Discount${coupon ? ' (' + esc(coupon.code) + ')' : ''}: ${money(d)}${esc(low)}</td></tr><tr><th colspan=4>Total: ${money(t - d)}</th></tr>` : '<tr><td>Your cart is empty</td></tr>';
  $('#sum').innerHTML = cart.length ? `<h4>Order summary</h4>${cart.map(i => `<p><span>${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></p>`).join('')}<hr>
   <p><span>Subtotal</span><span>${money(t)}</span></p><p><span>Discount</span><span>- ${money(d)}</span></p><p><b>Total</b><b>${money(t - d)}</b></p>` : '';
}
async function applyCoupon() {
  const m = $('#cmsg'), say = (t, ok) => { m.className = 'msg ' + (ok ? 'ok' : 'err'); m.textContent = t; };
  const c = $('#cc').value.trim().toUpperCase();
  if (!c) return say('Type a coupon code first', 0);
  const o = (await load('offers')).find(x => x.type && (x.code || '').toUpperCase() === c);
  if (!o) return say('Invalid coupon code', 0);
  if (o.active === false) return say('This coupon is not active', 0);
  if (o.start && o.start > today()) return say('This coupon starts on ' + o.start, 0);
  if (o.expiry && o.expiry < today()) return say('This coupon has expired', 0);
  if (sub() < (+o.min || 0)) return say('Minimum spend is ' + money(o.min), 0);
  coupon = o; drawCart(); say('Coupon applied', 1);
}
async function checkout(e) {
  e.preventDefault(); const f = e.target, v = k => f.elements[k].value.trim();
  if (!cart.length) return fmsg(f, 'Your cart is empty', 0);
  if (v('name').length < 2) return fmsg(f, 'Please enter your full name', 0);
  if (!validPhone(v('phone'))) return fmsg(f, 'Please enter a valid phone number', 0);
  if (v('email') && !/^\S+@\S+\.\S+$/.test(v('email'))) return fmsg(f, 'Please enter a valid email or leave it empty', 0);
  if (v('address').length < 6) return fmsg(f, 'Please enter your full delivery address', 0);
  const b = f.querySelector('button'); b.disabled = true;
  const no = 'ORD' + Date.now().toString().slice(-7), d = disc(), s = sub();
  const o = { orderNo: no, name: v('name'), phone: v('phone'), email: v('email'), address: v('address'), notes: v('notes'), items: cart, subtotal: s, total: s - d, discount: d,
    coupon: coupon ? coupon.code : '', payment: 'Cash on delivery', status: 'Pending', uid: (firebase.auth().currentUser || {}).uid || '', date: new Date().toISOString() };
  try {
    await db.collection('orders').add(o);
    try { sessionStorage.setItem('lastOrder', JSON.stringify(o)); } catch (x) {}
    cart = []; coupon = null; saveCart(); f.reset(); fmsg(f, '', 1);
    location.hash = '#confirm/' + no;
  } catch (er) { fmsg(f, 'Could not send order: ' + er.message, 0); }
  b.disabled = false;
}
function drawConfirm(no) {
  let o = null; try { o = JSON.parse(sessionStorage.getItem('lastOrder') || 'null'); } catch (e) {}
  const b = $('#confBox');
  if (!o || o.orderNo !== no) { b.innerHTML = `<div class="card"><h2>Order ${esc(no)}</h2><p>You can follow this order in <a href="account.html">My Account</a>.</p><a class="btn" href="#products">Continue shopping</a></div>`; return; }
  b.innerHTML = `<div class="card sum"><h2 style="margin-top:0">✅ Thank you, ${esc(o.name)}!</h2><p>Your order has been placed. We will contact you on ${esc(o.phone)} to confirm.</p>
  <p><span>Order number</span><b>${esc(o.orderNo)}</b></p><p><span>Status</span><span>${esc(o.status)}</span></p><hr>
  ${o.items.map(i => `<p><span>${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''} × ${esc(i.qty)}</span><span>${money(i.price * i.qty)}</span></p>`).join('')}<hr>
  <p><span>Subtotal</span><span>${money(o.subtotal)}</span></p><p><span>Discount${o.coupon ? ' (' + esc(o.coupon) + ')' : ''}</span><span>- ${money(o.discount)}</span></p><p><b>Total</b><b>${money(o.total)}</b></p>
  <p><span>Payment</span><span>${esc(o.payment)}</span></p><p><span>Deliver to</span><span>${esc(o.address)}</span></p></div>
  <p><a class="btn" href="account.html">Track in My Account</a> <a class="btn" href="#products" style="background:var(--p)">Continue shopping</a></p>`;
}
async function sendEnquiry(e) {
  e.preventDefault(); const f = e.target, v = k => f.elements[k].value.trim();
  if (v('name').length < 2) return fmsg(f, 'Please enter your name', 0);
  if (!validPhone(v('phone'))) return fmsg(f, 'Please enter a valid phone number', 0);
  if (v('email') && !/^\S+@\S+\.\S+$/.test(v('email'))) return fmsg(f, 'Please enter a valid email or leave it empty', 0);
  if (v('message').length < 5) return fmsg(f, 'Please write a short message', 0);
  const b = f.querySelector('button'); b.disabled = true;
  try {
    await db.collection('enquiries').add({ name: v('name'), phone: v('phone'), email: v('email'), type: v('type'), message: v('message'), status: 'New', date: new Date().toISOString() });
    f.reset(); fmsg(f, 'Thank you! Your enquiry was sent. We will contact you soon.', 1);
  } catch (er) { fmsg(f, 'Could not send: ' + er.message, 0); }
  b.disabled = false;
}

// ---------- start ----------
firebase.auth().onAuthStateChanged(async u => {
  if (!u) return;
  try {
    const x = (await db.collection('customers').doc(u.uid).get()).data() || {}, f = $('#coForm').elements;
    if (!f['name'].value) f['name'].value = x.name || ''; if (!f.phone.value) f.phone.value = x.phone || '';
    if (!f.address.value) f.address.value = x.address || ''; if (!f.email.value) f.email.value = u.email || '';
  } catch (e) {}
});
(async () => {
  PRODUCTS = (await load('products')).filter(p => p.published !== false);
  PACKAGES = (await load('packages')).filter(liveP);
  OFFERS = (await load('offers')).filter(liveO);
  CATS = await load('categories'); READY = true;
  const cats = [...new Set(PRODUCTS.map(p => p.category).filter(Boolean))];
  $('#cat').innerHTML = '<option value="">All categories</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('');
  $('#homeCats').innerHTML = cats.map(c => `<a class="chip" href="#category/${encodeURIComponent(c)}">${esc(c)}</a>`).join('') || '<p>No categories yet.</p>';
  const fe = PRODUCTS.filter(p => p.featured);
  $('#feat').innerHTML = (fe.length ? fe.slice(0, 8) : PRODUCTS.slice(0, 4)).map(pcard).join('') || '<p>No products yet.</p>';
  $('#homeDeals').innerHTML = PACKAGES.slice(0, 2).map(pkcard).join('') + OFFERS.slice(0, 2).map(ocard).join('') || '<p>No packages or offers right now.</p>';
  drawProducts();
  $('#pk').innerHTML = PACKAGES.map(pkcard).join('') || '<p>No packages available right now.</p>';
  $('#of').innerHTML = OFFERS.map(ocard).join('') || '<p>No active offers right now.</p>';
  drawCart(); show();
})();