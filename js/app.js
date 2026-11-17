firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const $ = s => document.querySelector(s);
const money = n => 'Rs ' + Number(n || 0).toLocaleString();
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
// Sample data shows until the admin adds real items (no invented business facts)
const DEMO = {
  products: [{ id: 'd1', name: 'Sample Product', category: 'Sample', price: 500, stock: true, description: 'Placeholder - admin can edit', image: '' }],
  packages: [{ id: 'p1', name: 'Sample Package', items: 'Item A + Item B', normal: 1000, price: 800 }],
  offers: [{ id: 'o1', title: 'Sample Offer', code: 'SAMPLE10', details: '10% off - placeholder' }]
};
async function load(c) {
  try { const s = await db.collection(c).get(); const r = s.docs.map(d => ({ id: d.id, ...d.data() })); return r.length ? r : DEMO[c]; }
  catch (e) { return DEMO[c]; }
}
function show() {
  const h = (location.hash || '#home').slice(1);
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === h));
}
addEventListener('hashchange', show);
const img = p => `<img src="${p.image || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E'}" alt="">`;
let PRODUCTS = [];
function drawProducts() {
  const q = ($('#search').value || '').toLowerCase(), cat = $('#cat').value;
  const list = PRODUCTS.filter(p => (!q || p.name.toLowerCase().includes(q)) && (!cat || p.category === cat));
  $('#plist').innerHTML = list.length ? list.map(p => `<div class="card">${img(p)}<h4>${p.name}</h4>
   <div class="tag">${p.category || ''} · ${p.stock === false ? 'Out of Stock' : 'In Stock'}</div>
   <div class="price">${money(p.price)}</div><p>${p.description || ''}</p>
   <button onclick="addCart('${p.id}')">Add to Cart</button></div>`).join('') : '<p>No products match.</p>';
}
function addCart(id) {
  const p = PRODUCTS.find(x => x.id === id), i = cart.find(x => x.id === id);
  i ? i.qty++ : cart.push({ id, name: p.name, price: p.price, qty: 1 });
  saveCart(); alert('Added to cart');
}
function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); drawCart(); }
function drawCart() {
  const t = cart.reduce((s, i) => s + i.price * i.qty, 0);
  $('#cartn').textContent = cart.length;
  $('#clist').innerHTML = cart.length ? cart.map((i, k) => `<tr><td>${i.name}</td><td>${money(i.price)}</td>
   <td><input type="number" min="1" value="${i.qty}" style="width:70px" onchange="cart[${k}].qty=+this.value;saveCart()"></td>
   <td><button onclick="cart.splice(${k},1);saveCart()">x</button></td></tr>`).join('') + `<tr><th colspan=4>Total: ${money(t)}</th></tr>` : '<tr><td>Cart is empty</td></tr>';
}
async function checkout(e) {
  e.preventDefault();
  if (!cart.length) return alert('Cart is empty');
  const f = e.target, no = 'ORD' + Date.now().toString().slice(-7);
  try {
    await db.collection('orders').add({ orderNo: no, name: f.name.value, phone: f.phone.value, address: f.address.value,
      notes: f.notes.value, items: cart, total: cart.reduce((s, i) => s + i.price * i.qty, 0), payment: 'Cash on delivery', status: 'Pending', uid: (firebase.auth().currentUser || {}).uid || '', date: new Date().toISOString() });
    cart = []; saveCart(); f.reset(); alert('Order placed! Your order number: ' + no);
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
  drawProducts();
  $('#pk').innerHTML = (await load('packages')).map(p => `<div class="card"><h4>${p.name}</h4><p>${p.items}</p>
   <s>${money(p.normal)}</s> <span class="price">${money(p.price)}</span><br><br><a class="btn" href="#contact">Enquire</a></div>`).join('');
  $('#of').innerHTML = (await load('offers')).map(o => `<div class="card"><h4>${o.title}</h4><p>${o.details}</p><b>Code: ${o.code || '-'}</b></div>`).join('');
  drawCart(); show();
})();
