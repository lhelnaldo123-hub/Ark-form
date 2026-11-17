firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const $ = s => document.querySelector(s);
const money = n => 'Rs ' + Number(n || 0).toLocaleString();
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let PRODUCTS = [], coupon = null;
const today = () => new Date().toISOString().slice(0, 10);
const COLORS = ['#2a9d8f', '#1f3a5f', '#e9c46a', '#e76f51', '#6a4c93', '#457b9d'];
// Sample data shows until the admin adds real items (no real business facts invented)
const sp = (n, c, price) => ({ id: 'd' + n, name: 'Sample Product ' + n, category: c, price, stock: true, description: 'Sample item - admin can replace', image: '' });
const DEMO = {
  products: [sp(1, 'Featured', 350), sp(2, 'Featured', 500), sp(3, 'Featured', 750), sp(4, 'Popular', 1200), sp(5, 'Popular', 900), sp(6, 'New Arrivals', 1500), sp(7, 'New Arrivals', 2200), sp(8, 'Bundles', 2500)],
  packages: [{ id: 'p1', name: 'Starter Package', items: 'Sample Product 1 + 2', normal: 850, price: 700 }, { id: 'p2', name: 'Business Package', items: 'Sample Product 3 + 4 + 5', normal: 2850, price: 2400 }, { id: 'p3', name: 'Bulk Package', items: 'Sample Product 6 + 7 + 8', normal: 6200, price: 5300 }],
  offers: [{ id: 'o1', title: 'Welcome Offer', code: 'WELCOME10', type: 'percent', value: 10, min: 0, details: '10% off your order (sample)' }, { id: 'o2', title: 'Big Order Offer', code: 'SAVE200', type: 'fixed', value: 200, min: 2000, details: 'Rs 200 off orders above Rs 2000 (sample)' }]
};
async function load(c) {
  try { const s = await db.collection(c).get(); const r = s.docs.map(d => ({ id: d.id, ...d.data() })); return r.length ? r : DEMO[c]; }
  catch (e) { return DEMO[c]; }
}
function show() {
  const h = (location.hash || '#home').slice(1);
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === h));
  scrollTo(0, 0);
}
addEventListener('hashchange', show);
const img = p => p.image ? `<img src="${p.image}" alt="">` : `<div class="ph" style="background:${COLORS[(p.name || '').length % 6]}">${(p.name || '?')[0]}</div>`;
const pcard = p => `<div class="card">${img(p)}<h4>${p.name}</h4>
  <div class="tag">${p.category || ''} · ${p.stock === false ? 'Out of Stock' : 'In Stock'}</div>
  <div class="price">${money(p.price)}</div><p>${p.description || ''}</p>
  <button onclick="addCart('${p.id}')">Add to Cart</button></div>`;
function drawProducts() {
  const q = ($('#search').value || '').toLowerCase(), cat = $('#cat').value;
  const list = PRODUCTS.filter(p => (!q || p.name.toLowerCase().includes(q)) && (!cat || p.category === cat));
  $('#plist').innerHTML = list.length ? list.map(pcard).join('') : '<p>No products match.</p>';
}
function addCart(id) {
  const p = PRODUCTS.find(x => x.id === id), i = cart.find(x => x.id === id);
  i ? i.qty++ : cart.push({ id, name: p.name, price: p.price, qty: 1 });
  saveCart(); alert('Added to cart');
}
function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); drawCart(); }
function disc() {
  const t = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (!coupon || t < (+coupon.min || 0)) return 0;
  return Math.min(t, coupon.type == 'percent' ? Math.round(t * coupon.value / 100) : +coupon.value);
}
function drawCart() {
  const t = cart.reduce((s, i) => s + i.price * i.qty, 0);
  $('#cartn').textContent = cart.length;
  $('#clist').innerHTML = cart.length ? '<tr><th>Item</th><th>Price</th><th>Qty</th><th></th></tr>' + cart.map((i, k) => `<tr><td>${i.name}</td><td>${money(i.price)}</td>
   <td><input type="number" min="1" value="${i.qty}" style="width:64px;margin:0" onchange="cart[${k}].qty=Math.max(1,+this.value);saveCart()"></td>
   <td><button onclick="cart.splice(${k},1);saveCart()">x</button></td></tr>`).join('') +
   `<tr><td colspan=4>Discount: ${money(disc())}</td></tr><tr><th colspan=4>Total: ${money(t - disc())}</th></tr>` : '<tr><td>Your cart is empty</td></tr>';
}
async function applyCoupon() {
  const c = $('#cc').value.trim().toUpperCase();
  const o = (await load('offers')).find(x => x.type && (x.code || '').toUpperCase() === c);
  if (!o) return alert('Invalid coupon code');
  if (o.expiry && o.expiry < today()) return alert('This coupon has expired');
  const t = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (t < (+o.min || 0)) return alert('Minimum spend is ' + money(o.min));
  coupon = o; drawCart(); alert('Coupon applied');
}
async function checkout(e) {
  e.preventDefault();
  if (!cart.length) return alert('Cart is empty');
  const f = e.target, no = 'ORD' + Date.now().toString().slice(-7);
  try {
    await db.collection('orders').add({ orderNo: no, name: f.name.value, phone: f.phone.value, address: f.address.value,
      notes: f.notes.value, items: cart, total: cart.reduce((s, i) => s + i.price * i.qty, 0) - disc(), discount: disc(), coupon: coupon ? coupon.code : '',
      payment: 'Cash on delivery', status: 'Pending', uid: (firebase.auth().currentUser || {}).uid || '', date: new Date().toISOString() });
    cart = []; coupon = null; saveCart(); f.reset(); alert('Order placed! Your order number: ' + no);
  } catch (er) { alert('Could not send order: ' + er.message); }
}
async function sendEnquiry(e) {
  e.preventDefault(); const f = e.target;
  try {
    await db.collection('enquiries').add({ name: f.name.value, phone: f.phone.value, email: f.email.value, type: f.type.value,
      message: f.message.value, status: 'New', date: new Date().toISOString() });
    f.reset(); alert('Thank you! We will contact you.');
  } catch (er) { alert('Error: ' + er.message); }
}
(async () => {
  PRODUCTS = await load('products');
  $('#cat').innerHTML = '<option value="">All categories</option>' + [...new Set(PRODUCTS.map(p => p.category))].map(c => `<option>${c}</option>`).join('');
  drawProducts(); $('#feat').innerHTML = PRODUCTS.slice(0, 4).map(pcard).join('');
  $('#pk').innerHTML = (await load('packages')).map(p => `<div class="card"><h4>${p.name}</h4><p>${p.items}</p>
   <s>${money(p.normal)}</s> <span class="price">${money(p.price)}</span><br><br><a class="btn" href="#contact">Enquire</a></div>`).join('');
  $('#of').innerHTML = (await load('offers')).filter(o => !o.expiry || o.expiry >= today()).map(o => `<div class="card"><h4>${o.title}</h4><p>${o.details}</p><b>Code: ${o.code || '-'}</b></div>`).join('');
  drawCart(); show();
})();
