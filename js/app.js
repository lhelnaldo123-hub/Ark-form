firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let SYM = 'Rs', SET = {}, SITE = {};
const money = n => SYM + ' ' + Number(n || 0).toLocaleString();
const today = () => new Date().toISOString().slice(0, 10);
const safeUrl = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
const imgSrc = u => { u = String(u || '').trim(); return /^(https?:\/\/|data:image\/)/i.test(u) ? u : ''; };
const okLink = l => { l = String(l || '').trim(); return /^(#|https?:\/\/)/i.test(l) ? l : ''; };
const validPhone = v => /^[+()\d\s-]{7,20}$/.test(v) && v.replace(/\D/g, '').length >= 7;
const SITEP = db.collection('settings').doc('site').get().then(d => d.data() || {}).catch(() => ({}));
let cart = []; try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) {}
let PRODUCTS = [], PACKAGES = [], OFFERS = [], CATS = [], BANNERS = [], coupon = null, READY = false, CUR = '', CURP = null;
let GAL = [], SELVAR = '', DQ = 1;
const COLORS = ['#13294b', '#2b5c8a', '#9a6a14', '#7a2e3a', '#3d6b5a', '#5b4a86'];

// Sample data shows until the admin adds real items (no real business facts invented)
const sp = (n, c) => ({ id: 'd' + n, name: 'Sample Product ' + n, category: c, stock: true, description: 'Sample item - the admin will replace it with real products.', image: '' });
const DEMO = { products: [sp(1, 'Category 1'), sp(2, 'Category 1'), sp(3, 'Category 1'), sp(4, 'Category 2'), sp(5, 'Category 2'), sp(6, 'Category 3'), sp(7, 'Category 3'), sp(8, 'Category 3')], packages: [], offers: [] };
async function load(c) {
  try { const s = await db.collection(c).get(); const r = s.docs.map(d => ({ id: d.id, ...d.data() })); return r.length ? r : (DEMO[c] || []); }
  catch (e) { return DEMO[c] || []; }
}

// ---------- helpers ----------
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
const pct = p => eff(p) && eff(p) < +p.price ? Math.round((1 - eff(p) / p.price) * 100) : 0;
// photos: newline separated (also accepts old comma separated links and arrays)
const splitImgs = s => (Array.isArray(s) ? s : String(s || '').split('\n')).flatMap(x => { x = String(x || '').trim(); return x.startsWith('data:') ? [x] : x.split(','); }).map(x => x.trim()).filter(x => imgSrc(x));
const images = p => [...new Set([...splitImgs(p.image), ...splitImgs(p.images)])];
const variants = p => String(p.variants || '').split(',').map(s => s.trim()).filter(Boolean);
const status = p => p.stock === false ? '<span class="badge out">Out of Stock</span>' : eff(p) ? '<span class="badge">In Stock</span>' : '<span class="badge">Enquire for Price</span>';
const ph = (p, extra) => `<div class="ph" style="background:${COLORS[(p.name || '').length % 6]};${extra || ''}">${esc((p.name || '?')[0])}</div>`;
const img = p => { const i = images(p)[0]; return i ? `<img loading="lazy" src="${esc(i)}" alt="${esc(p.name)}">` : ph(p); };
const prc = p => eff(p) ? `<span class="pnow${pct(p) ? ' sale' : ''}">${money(eff(p))}</span>${pct(p) ? `<s>${money(p.price)}</s>` : ''}` : '<span class="pnow">Enquire for price</span>';
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
const pcard = p => `<div class="pc"><a class="pimg" href="#view/${esc(p.id)}">${img(p)}${pct(p) ? `<span class="off">-${pct(p)}%</span>` : ''}${p.stock === false ? '<span class="so">Sold out</span>' : ''}</a>
  <div class="pb"><a class="pn" href="#view/${esc(p.id)}">${esc(p.name)}</a><div class="pr">${prc(p)}</div><div class="pm">${esc(p.category || '')}</div>
  ${p.stock === false ? '' : `<button class="pcart" onclick="quickAdd('${esc(p.id)}')" aria-label="Add to cart">🛒</button>`}</div></div>`;
const pkcard = k => `<div class="dcard"><h4>${esc(k.name)}</h4><p>${esc(k.items)}</p>
  <div class="prow"><span class="pnow sale">${money(k.price)}</span>${+k.normal ? `<s>${money(k.normal)}</s>` : ''}</div>
  ${+k.normal > +k.price ? `<p><span class="badge">Save ${money(k.normal - k.price)}</span></p>` : ''}
  ${k.validity ? `<p class="tag">Valid until ${esc(k.validity)}</p>` : ''}${k.conditions ? `<p class="tag">Conditions: ${esc(k.conditions)}</p>` : ''}${k.options ? `<p class="tag">Customisation: ${esc(k.options)}</p>` : ''}
  <p><button onclick="enquirePkg('${esc(k.id)}')">Enquire / Request package</button></p></div>`;
const ocard = o => `<div class="dcard">${imgSrc(o.image) ? `<img class="bn" src="${esc(imgSrc(o.image))}" alt="">` : ''}<h4>${esc(o.title)}</h4><p>${esc(o.details || '')}</p>
  <p class="pnow sale">${o.type === 'percent' ? (+o.value || 0) + '% off' : money(o.value) + ' off'}</p>${+o.min ? `<p class="tag">Minimum order ${money(o.min)}</p>` : ''}
  ${o.eligible ? `<p class="tag">Applies to: ${esc(o.eligible)}</p>` : ''}
  <p class="tag">${o.start ? 'From ' + esc(o.start) + ' ' : ''}${o.expiry ? 'Until ' + esc(o.expiry) : ''}</p>
  ${o.code ? `<span class="code">${esc(o.code)}</span><p class="tag">Enter this code in your cart to get the discount.</p>` : ''}</div>`;

// ---------- menu ----------
function openMenu() { $('#dr').classList.add('on'); $('#ov').classList.add('on'); document.body.classList.add('nolock'); }
function closeMenu() { $('#dr').classList.remove('on'); $('#ov').classList.remove('on'); if (!$('#lb').classList.contains('on')) document.body.classList.remove('nolock'); }
$('#dr').addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
function goSearch(e) {
  e.preventDefault(); $('#search').value = $('#hs').value.trim(); $('#cat').value = ''; drawProducts();
  $('#hs').blur(); location.hash = '#products'; show();
}

// ---------- pages ----------
function show() {
  const raw = (location.hash || '#home').slice(1), i = raw.indexOf('/');
  const h = i < 0 ? raw : raw.slice(0, i); let arg = i < 0 ? '' : raw.slice(i + 1);
  try { arg = decodeURIComponent(arg); } catch (e) {}
  const el = document.getElementById(h), id = el && el.classList.contains('page') ? h : 'home';
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === id));
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.p === id));
  document.body.dataset.pg = id;
  const bb = $('#backbar'); if (bb) bb.style.display = id === 'home' ? 'none' : '';
  closeMenu(); lbClose();
  if (id === 'view') drawDetail(arg);
  if (id === 'category') drawCategory(arg);
  if (id === 'confirm') drawConfirm(arg);
  document.body.classList.toggle('has-bar', id === 'view' && !!$('#detail .buybar'));
  scrollTo(0, 0);
}
// back button: returns to the previous page; if the site was opened straight on this page, goes up one level
let NAVN = 0;
addEventListener('hashchange', () => { NAVN++; show(); });
function goBack() {
  if (NAVN > 0) { NAVN -= 2; history.back(); return; }
  const h = (location.hash || '#home').slice(1).split('/')[0];
  location.hash = h === 'view' || h === 'category' ? '#products' : h === 'confirm' ? '#home' : '#home';
}

function drawProducts() {
  const q = ($('#search').value || '').toLowerCase(), c = $('#cat').value;
  const l = sorted(PRODUCTS.filter(p => (!q || (p.name || '').toLowerCase().includes(q)) && (!c || p.category === c)), $('#sort').value);
  $('#plist').innerHTML = l.length ? l.map(pcard).join('') : '<p>No products match your search. Try another keyword or category.</p>';
}
function drawCategory(n) {
  CUR = n; const q = ($('#csearch').value || '').toLowerCase();
  $('#catTitle').textContent = n;
  const c = CATS.find(x => x.name === n);
  $('#catDesc').innerHTML = (c && imgSrc(c.image) ? `<img src="${esc(imgSrc(c.image))}" alt="" style="width:100%;height:130px;object-fit:cover;border-radius:12px;margin-bottom:8px"><br>` : '') + esc(c && c.description ? c.description : '');
  const l = sorted(PRODUCTS.filter(p => p.category === n && (!q || (p.name || '').toLowerCase().includes(q))), $('#csort').value);
  $('#clistc').innerHTML = l.length ? l.map(pcard).join('') : '<p>No products in this category yet.</p>';
}

// ---------- product detail ----------
function drawDetail(id) {
  const box = $('#detail');
  if (!READY) { box.innerHTML = '<div class="sk" style="aspect-ratio:1"></div>'; return; }
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) { box.innerHTML = '<p>Product not found. <a href="#products">Back to products</a></p>'; return; }
  CURP = p; GAL = images(p); SELVAR = ''; DQ = 1;
  const vs = variants(p), d = pct(p), can = p.stock !== false && eff(p);
  const rel = PRODUCTS.filter(x => x.id !== p.id && x.category === p.category).slice(0, 4);
  const pk = PACKAGES.filter(k => (k.items || '').toLowerCase().includes((p.name || '').toLowerCase()));
  box.innerHTML = `<p class="crumb"><a href="#products">Products</a> › ${p.category ? `<a href="#category/${encodeURIComponent(p.category)}">${esc(p.category)}</a> › ` : ''}${esc(p.name)}</p>
  <div class="two eq"><div>
   <div class="gal">${GAL.length ? `<div class="gtrack" id="gtrack" onscroll="gscroll()">${GAL.map((u, k) => `<div class="gs"><img src="${esc(u)}" alt="${esc(p.name)}" onclick="lbOpen(${k})"></div>`).join('')}</div>
     <span class="gcount" id="gcount">1 / ${GAL.length}</span><span class="ghint">🔍 Tap photo to zoom</span>
     ${GAL.length > 1 ? '<button class="gar gl" onclick="gstep(-1)">‹</button><button class="gar gr" onclick="gstep(1)">›</button>' : ''}` : `<div class="gs">${ph(p, 'font-size:80px')}</div>`}</div>
   ${GAL.length > 1 ? `<div class="thumbs" id="gthumbs">${GAL.map((u, k) => `<img src="${esc(u)}" class="${k ? '' : 'sel'}" onclick="gjump(${k})" alt="">`).join('')}</div>` : ''}
  </div>
  <div class="info"><h2 style="margin-top:0">${esc(p.name)}</h2>
   <div class="prow"><span class="big${d ? ' sale' : ''}">${eff(p) ? money(eff(p)) : 'Enquire for price'}</span>${d ? `<s>${money(p.price)}</s><span class="off2">-${d}%</span>` : ''}</div>
   <p>${status(p)} ${p.sku ? `<span class="tag">SKU: ${esc(p.sku)}</span>` : ''}</p>
   ${vs.length ? `<h4 style="margin-top:14px">Size / option</h4><div class="chips" id="vchips">${vs.map((v, k) => `<button type="button" class="chip" onclick="pickVar(${k})">${esc(v)}</button>`).join('')}</div>` : ''}
   ${can ? `<h4 style="margin-top:14px">Quantity</h4><div class="qs"><button type="button" onclick="dq(-1)">−</button><span id="dqty">1</span><button type="button" onclick="dq(1)">+</button></div>` : ''}
   ${p.description ? `<h4 style="margin-top:16px">Description</h4><p style="white-space:pre-wrap">${esc(p.description)}</p>` : ''}
   ${p.specs ? `<h4 style="margin-top:14px">Specifications</h4><p style="white-space:pre-wrap">${esc(p.specs)}</p>` : ''}
  </div></div>
  ${pk.length ? `<div class="sh"><h3>Included in packages</h3></div><div class="dg">${pk.map(pkcard).join('')}</div>` : ''}
  ${rel.length ? `<div class="sh"><h3>Related products</h3></div><div class="pg">${rel.map(pcard).join('')}</div>` : ''}
  <div class="buybar"><div><div class="bp"><b>${eff(p) ? money(eff(p)) : 'Enquire'}</b><span class="tag">${p.stock === false ? 'Out of stock' : ''}</span></div>
   ${can ? `<button onclick="addDetail('${esc(p.id)}')">🛒 Add to cart</button>` : p.stock === false ? '<button disabled>Out of stock</button>' : ''}
   <button class="dk" onclick="quote('${esc(p.id)}')">${eff(p) ? 'Enquire' : 'Get a quote'}</button></div></div>`;
}
function pickVar(k) { SELVAR = variants(CURP)[k]; document.querySelectorAll('#vchips .chip').forEach((c, i) => c.classList.toggle('on', i === k)); }
function dq(d) { DQ = Math.max(1, Math.min(99, DQ + d)); $('#dqty').textContent = DQ; }
function addDetail(id) {
  const p = PRODUCTS.find(x => x.id === id); if (!p) return;
  if (variants(p).length && !SELVAR) return toast('Please choose a size / option');
  addCart(id, SELVAR || undefined, DQ);
}
function gscroll() {
  const t = $('#gtrack'); if (!t || !t.clientWidth) return;
  const i = Math.round(t.scrollLeft / t.clientWidth);
  $('#gcount').textContent = (i + 1) + ' / ' + GAL.length;
  document.querySelectorAll('#gthumbs img').forEach((x, k) => x.classList.toggle('sel', k === i));
}
function gjump(k) { const t = $('#gtrack'); t.scrollTo({ left: k * t.clientWidth, behavior: 'smooth' }); }
function gstep(d) { const t = $('#gtrack'); gjump(Math.min(GAL.length - 1, Math.max(0, Math.round(t.scrollLeft / t.clientWidth) + d))); }

// ---------- photo viewer (swipe, pinch zoom, double-tap zoom) ----------
const LB = { i: 0, s: 1, x: 0, y: 0 }; let lbPtr = new Map(), lbStart = null, lbPinch = null, lbTap = 0;
const lbClamp = (v, a, b) => Math.min(b, Math.max(a, v));
function lbApply() { $('#lbi').style.transform = `translate(${LB.x}px,${LB.y}px) scale(${LB.s})`; $('#lbs').style.cursor = LB.s > 1 ? 'grab' : 'zoom-in'; }
function lbPan() { const m = $('#lbi'), mx = (LB.s - 1) * m.clientWidth / 2, my = (LB.s - 1) * m.clientHeight / 2; LB.x = lbClamp(LB.x, -mx, mx); LB.y = lbClamp(LB.y, -my, my); }
function lbReset() { LB.s = 1; LB.x = 0; LB.y = 0; lbApply(); }
function lbShow() { $('#lbi').src = GAL[LB.i] || ''; $('#lbc').textContent = (LB.i + 1) + ' / ' + GAL.length; $('#lb').classList.toggle('one', GAL.length < 2); lbReset(); }
function lbOpen(k) { if (!GAL.length) return; LB.i = k; lbShow(); $('#lb').classList.add('on'); document.body.classList.add('nolock'); }
function lbClose() { const l = $('#lb'); if (!l || !l.classList.contains('on')) return; l.classList.remove('on'); document.body.classList.remove('nolock'); $('#lbi').removeAttribute('src'); }
function lbGo(d) { if (GAL.length < 2) return; LB.i = (LB.i + d + GAL.length) % GAL.length; lbShow(); }
function lbZoomAt(px, py) {
  if (LB.s > 1) return lbReset();
  const r = $('#lbs').getBoundingClientRect(); LB.s = 2.5;
  LB.x = (px - (r.left + r.width / 2)) * (1 - LB.s); LB.y = (py - (r.top + r.height / 2)) * (1 - LB.s);
  lbPan(); lbApply();
}
(function () {
  const st = $('#lbs'), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  st.addEventListener('pointerdown', e => {
    try { st.setPointerCapture(e.pointerId); } catch (x) {}
    lbPtr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (lbPtr.size === 2) { const [a, b] = [...lbPtr.values()]; lbPinch = { d: dist(a, b) || 1, s: LB.s }; lbStart = null; }
    else if (lbPtr.size === 1) lbStart = { x: e.clientX, y: e.clientY, ox: LB.x, oy: LB.y, moved: false };
  });
  st.addEventListener('pointermove', e => {
    if (!lbPtr.has(e.pointerId)) return;
    lbPtr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (lbPtr.size === 2 && lbPinch) { const [a, b] = [...lbPtr.values()]; LB.s = lbClamp(lbPinch.s * dist(a, b) / lbPinch.d, 1, 5); lbPan(); lbApply(); }
    else if (lbPtr.size === 1 && lbStart) {
      const dx = e.clientX - lbStart.x, dy = e.clientY - lbStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) lbStart.moved = true;
      if (LB.s > 1) { LB.x = lbStart.ox + dx; LB.y = lbStart.oy + dy; lbPan(); lbApply(); }
    }
  });
  const up = e => {
    if (!lbPtr.has(e.pointerId)) return; lbPtr.delete(e.pointerId);
    if (lbPinch) { if (lbPtr.size < 2) { lbPinch = null; lbStart = null; if (LB.s < 1.08) lbReset(); } return; }
    if (lbStart && lbPtr.size === 0) {
      const dx = e.clientX - lbStart.x, dy = e.clientY - lbStart.y;
      if (e.type === 'pointerup') {
        if (LB.s === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) lbGo(dx < 0 ? 1 : -1);
        else if (LB.s === 1 && dy > 90 && dy > Math.abs(dx) * 1.3) lbClose();
        else if (!lbStart.moved) { const n = Date.now(); if (n - lbTap < 320) { lbTap = 0; lbZoomAt(e.clientX, e.clientY); } else lbTap = n; }
      }
      lbStart = null;
    }
  };
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  st.addEventListener('wheel', e => { e.preventDefault(); LB.s = lbClamp(LB.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 5); if (LB.s === 1) { LB.x = 0; LB.y = 0; } lbPan(); lbApply(); }, { passive: false });
  addEventListener('keydown', e => {
    if (!$('#lb').classList.contains('on')) return;
    if (e.key === 'Escape') lbClose(); if (e.key === 'ArrowRight') lbGo(1); if (e.key === 'ArrowLeft') lbGo(-1);
  });
})();

// ---------- promo slider ----------
let HI = 0, HN = 1, HT = null, HP = false, HS = false;
function heroGo(i) {
  HN = document.querySelectorAll('#htrack .slide').length || 1; HI = ((i % HN) + HN) % HN;
  $('#htrack').style.transform = 'translateX(-' + HI * 100 + '%)';
  document.querySelectorAll('#dots i').forEach((d, k) => d.classList.toggle('on', k === HI));
}
function heroStart() {
  clearInterval(HT);
  if (document.querySelectorAll('#htrack .slide').length > 1) HT = setInterval(() => { if (!HP && !document.hidden) heroGo(HI + 1); }, 4000);
}
function buildSlides() {
  const S = [];
  BANNERS.filter(b => b.active !== false).sort((a, b) => (+a.order || 0) - (+b.order || 0)).forEach((b, i) => S.push({ img: imgSrc(b.image), title: b.title || '', sub: b.subtitle || '', link: okLink(b.link), btn: b.btn, theme: i }));
  if (!S.length) {
    S.push({ img: imgSrc(SITE.banner), title: SITE.heroTitle || 'Welcome to ARK Form Center', sub: SITE.heroText || 'Browse products, packages and offers, or send us an enquiry.', link: '#products', btn: 'Shop now', theme: 0 });
    OFFERS.slice(0, 3).forEach((o, i) => S.push({ img: imgSrc(o.image), title: o.title, sub: (o.details || '') + (o.code ? ' · Code: ' + o.code : ''), link: '#offers', btn: 'View offer', theme: i + 1 }));
    PACKAGES.slice(0, 2).forEach((k, i) => S.push({ title: k.name, sub: 'Now ' + money(k.price) + (+k.normal > +k.price ? ' (save ' + money(k.normal - k.price) + ')' : ''), link: '#packages', btn: 'See package', theme: i + 3 }));
  }
  return S;
}
function heroBuild(S) {
  $('#htrack').innerHTML = S.map(s => `<div class="slide ${s.img ? '' : 'th' + (s.theme % 5)}">${s.img ? `<img class="sbg" src="${esc(s.img)}" alt="">` : ''}<div class="stxt">${s.title ? `<h2>${esc(s.title)}</h2>` : ''}${s.sub ? `<p>${esc(s.sub)}</p>` : ''}${s.link ? `<a class="btn" href="${esc(s.link)}">${esc(s.btn || 'Shop now')}</a>` : ''}</div></div>`).join('');
  $('#dots').innerHTML = S.length > 1 ? S.map((_, k) => `<i onclick="heroGo(${k});heroStart()"></i>`).join('') : '';
  $('#hero').classList.toggle('single', S.length < 2);
  HI = 0; heroGo(0); heroStart();
}
(function () {
  const h = $('#hero'); let x0 = null;
  h.addEventListener('pointerdown', e => { x0 = e.clientX; HP = true; HS = false; });
  h.addEventListener('pointerup', e => { if (x0 !== null) { const dx = e.clientX - x0; if (Math.abs(dx) > 40) { HS = true; heroGo(HI + (dx < 0 ? 1 : -1)); } } x0 = null; HP = false; heroStart(); });
  h.addEventListener('pointercancel', () => { x0 = null; HP = false; });
  h.addEventListener('click', e => { if (HS) { e.preventDefault(); e.stopPropagation(); HS = false; } }, true);
})();

function prefill(type, msg) {
  const f = $('#enqForm'); f.elements.type.value = type; f.elements.message.value = msg; location.hash = '#contact';
}
let ENQREF = null;
function quote(id) { const p = PRODUCTS.find(x => x.id === id); if (!p) return; ENQREF = { productId: p.id, productName: p.name }; prefill(eff(p) ? 'Product Information' : 'Pricing', 'I would like information / a quote for: ' + p.name); }
function enquirePkg(id) { const k = PACKAGES.find(x => x.id === id); if (!k) return; ENQREF = { packageId: k.id, packageName: k.name }; prefill('Package / Bulk Order', 'I am interested in the package: ' + k.name); }

// ---------- cart ----------
function saveCart() { try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (e) {} drawCart(); }
function quickAdd(id) {
  const p = PRODUCTS.find(x => x.id === id); if (!p) return;
  if (p.stock === false) return toast('Out of stock');
  if (!eff(p)) return quote(id);
  if (variants(p).length) { location.hash = '#view/' + id; return toast('Choose a size / option'); }
  addCart(id);
}
function addCart(id, variant, qty) {
  const p = PRODUCTS.find(x => x.id === id); if (!p) return;
  if (p.stock === false) return toast('Out of stock');
  if (variants(p).length && variant === undefined) { location.hash = '#view/' + id; return toast('Please choose a size / option'); }
  qty = Math.max(1, parseInt(qty) || 1);
  const i = cart.find(x => x.id === id && (x.variant || '') === (variant || ''));
  i ? i.qty += qty : cart.push({ id, name: p.name, category: p.category || '', price: eff(p), qty, variant: variant || '' });
  saveCart(); toast('Added to cart');
}
function setQty(k, v) { cart[k].qty = Math.max(1, parseInt(v) || 1); saveCart(); }
function rmItem(k) { cart.splice(k, 1); saveCart(); }
const sub = () => cart.reduce((s, i) => s + i.price * i.qty, 0);
// does a cart item qualify for the coupon? (empty "eligible" = everything)
const matches = (i, o) => {
  const e = String(o.eligible || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  return !e.length || e.includes((i.category || '').toLowerCase()) || e.includes((i.name || '').toLowerCase());
};
function disc() {
  if (!coupon) return 0;
  const t = sub();
  if (t < (+coupon.min || 0)) return 0;
  const base = cart.filter(i => matches(i, coupon)).reduce((s, i) => s + i.price * i.qty, 0);
  return Math.min(base, coupon.type == 'percent' ? Math.round(base * coupon.value / 100) : +coupon.value);
}
function fees() {
  const net = sub() - disc(), fee = +SET.deliveryFee || 0, free = +SET.freeAbove || 0;
  const delivery = cart.length && fee > 0 && !(free > 0 && net >= free) ? fee : 0;
  const tax = Math.round(net * (+SET.tax || 0) / 100);
  return { net, delivery, tax, total: net + delivery + tax };
}
function drawCart() {
  const t = sub(), d = disc(), fe = fees(), n = cart.reduce((s, i) => s + i.qty, 0);
  const cn = $('#cartn'); cn.textContent = n; cn.style.display = n ? '' : 'none';
  $('#clist').innerHTML = cart.length ? cart.map((i, k) => {
    const p = PRODUCTS.find(x => x.id === i.id), im = p && images(p)[0];
    return `<div class="crow"><div class="cth">${im ? `<img src="${esc(im)}" alt="">` : ph({ name: i.name })}</div>
    <div class="ci"><b>${esc(i.name)}</b>${i.variant ? `<span class="tag">${esc(i.variant)}</span>` : ''}<span class="price">${money(i.price)}</span></div>
    <div class="qs sm2"><button onclick="setQty(${k},${i.qty - 1})">−</button><span>${i.qty}</span><button onclick="setQty(${k},${i.qty + 1})">+</button></div>
    <button class="rm" onclick="rmItem(${k})" aria-label="Remove">✕</button></div>`;
  }).join('') : '<div class="card" style="text-align:center">Your cart is empty<br><br><a class="btn" href="#products">Start shopping</a></div>';
  const low = coupon && t < (+coupon.min || 0) ? `<p class="tag">Coupon needs a minimum spend of ${money(coupon.min)}</p>` : '';
  $('#sum').innerHTML = cart.length ? `<h4>Order summary</h4>${cart.map(i => `<p><span>${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></p>`).join('')}<hr>
   <p><span>Subtotal</span><span>${money(t)}</span></p><p><span>Discount${coupon ? ' (' + esc(coupon.code) + ')' : ''}</span><span>- ${money(d)}</span></p>${low}
   ${+SET.deliveryFee ? `<p><span>Delivery</span><span>${fe.delivery ? money(fe.delivery) : 'Free'}</span></p>` : ''}${+SET.tax ? `<p><span>Tax (${+SET.tax}%)</span><span>${money(fe.tax)}</span></p>` : ''}
   <p><b>Total</b><b>${money(fe.total)}</b></p>` : '';
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
  if (+o.limit && (+o.used || 0) >= +o.limit) return say('This coupon has reached its usage limit', 0);
  if (sub() < (+o.min || 0)) return say('Minimum spend is ' + money(o.min), 0);
  if (!cart.some(i => matches(i, o))) return say('This coupon does not apply to the items in your cart', 0);
  coupon = o; drawCart(); say('Coupon applied', 1);
}
async function checkout(e) {
  e.preventDefault(); const f = e.target, v = k => f.elements[k].value.trim(), au = firebase.auth().currentUser;
  if (!au) {
    try { sessionStorage.setItem('coDraft', JSON.stringify(Object.fromEntries(new FormData(f)))); } catch (x) {}
    fmsg(f, 'Please log in or register to place your order. Taking you there...', 0);
    setTimeout(() => { location.href = 'account.html?next=cart'; }, 900);
    return;
  }
  if (!cart.length) return fmsg(f, 'Your cart is empty', 0);
  if (v('name').length < 2) return fmsg(f, 'Please enter your full name', 0);
  if (!validPhone(v('phone'))) return fmsg(f, 'Please enter a valid phone number', 0);
  if (v('email') && !/^\S+@\S+\.\S+$/.test(v('email'))) return fmsg(f, 'Please enter a valid email or leave it empty', 0);
  if (v('address').length < 6) return fmsg(f, 'Please enter your full delivery address', 0);
  const b = f.querySelector('button:not([type=button])'); b.disabled = true;
  const no = 'ORD' + Date.now().toString().slice(-7), d = disc(), s = sub(), fe = fees();
  const o = { orderNo: no, name: v('name'), phone: v('phone'), email: v('email'), address: v('address'), notes: v('notes'), items: cart, subtotal: s, discount: d, delivery: fe.delivery, tax: fe.tax, total: fe.total,
    coupon: coupon ? coupon.code : '', payment: (f.elements.payment && f.elements.payment.value) || 'To be confirmed by the shop', payStatus: 'Unpaid', status: 'Pending', uid: au.uid, date: new Date().toISOString() };
  try {
    await db.collection('orders').add(o);
    if (coupon && coupon.id) { try { await db.collection('offers').doc(coupon.id).update({ used: firebase.firestore.FieldValue.increment(1) }); } catch (x) {} }
    try { sessionStorage.setItem('lastOrder', JSON.stringify(o)); } catch (x) {}
    cart = []; coupon = null; saveCart(); f.reset(); fmsg(f, '', 1);
    location.hash = '#confirm/' + no;
  } catch (er) { fmsg(f, 'Could not send order: ' + er.message, 0); }
  b.disabled = false;
}
function drawConfirm(no) {
  let o = null; try { o = JSON.parse(sessionStorage.getItem('lastOrder') || 'null'); } catch (e) {}
  const b = $('#confBox');
  if (!o || o.orderNo !== no) { b.innerHTML = `<div class="card"><h2>Order ${esc(no)}</h2><p>You can see this order in <a href="account.html#orders">My Orders</a>.</p><a class="btn" href="#products">Continue shopping</a></div>`; return; }
  b.innerHTML = `<div class="card sum"><h2 style="margin-top:0">✅ Thank you, ${esc(o.name)}!</h2><p>Your order has been received. We will contact you on ${esc(o.phone)} to confirm.</p>
  <p><span>Order number</span><b>${esc(o.orderNo)}</b></p><p><span>Status</span><span>${esc(o.status)}</span></p><hr>
  ${o.items.map(i => `<p><span>${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''} × ${esc(i.qty)}</span><span>${money(i.price * i.qty)}</span></p>`).join('')}<hr>
  <p><span>Subtotal</span><span>${money(o.subtotal)}</span></p><p><span>Discount${o.coupon ? ' (' + esc(o.coupon) + ')' : ''}</span><span>- ${money(o.discount)}</span></p>
  ${+o.delivery ? `<p><span>Delivery</span><span>${money(o.delivery)}</span></p>` : ''}${+o.tax ? `<p><span>Tax</span><span>${money(o.tax)}</span></p>` : ''}
  <p><b>Total</b><b>${money(o.total)}</b></p>
  <p><span>Payment</span><span>${esc(o.payment)}</span></p><p><span>Deliver to</span><span>${esc(o.address)}</span></p></div>
  <p><a class="btn" href="account.html#orders">View my orders</a> <a class="btn dk" href="#products">Continue shopping</a></p>`;
}
async function sendEnquiry(e) {
  e.preventDefault(); const f = e.target, v = k => f.elements[k].value.trim();
  if (v('name').length < 2) return fmsg(f, 'Please enter your name', 0);
  if (!validPhone(v('phone'))) return fmsg(f, 'Please enter a valid phone number', 0);
  if (v('email') && !/^\S+@\S+\.\S+$/.test(v('email'))) return fmsg(f, 'Please enter a valid email or leave it empty', 0);
  if (v('message').length < 5) return fmsg(f, 'Please write a short message', 0);
  const b = f.querySelector('button'); b.disabled = true;
  try {
    await db.collection('enquiries').add({ name: v('name'), phone: v('phone'), email: v('email'), type: v('type'), message: v('message'), status: 'New', date: new Date().toISOString(), ...(ENQREF || {}) });
    ENQREF = null; f.reset(); fmsg(f, 'Thank you! Your enquiry was sent. We will contact you soon.', 1);
  } catch (er) { fmsg(f, 'Could not send: ' + er.message, 0); }
  b.disabled = false;
}

// ---------- start ----------
// staff / admin accounts only PREVIEW the shop: they are never treated as customers
const _staffC = {};
const isStaff = u => u ? (_staffC[u.uid] = _staffC[u.uid] || db.collection('staff').doc(u.uid).get().then(d => d.exists && d.data().active !== false).catch(() => false)) : Promise.resolve(false);
firebase.auth().onAuthStateChanged(async u => {
  if (u && await isStaff(u)) return;
  const fm0 = $('#coForm'), b0 = fm0.querySelector('button:not([type=button])'), n0 = $('#loginNote');
  if (b0) b0.textContent = u ? 'Place Order' : 'Log in to place order';
  if (n0) n0.style.display = u ? 'none' : '';
  const box = $('#dAuth');
  if (box) box.innerHTML = u ? `<b>👋 ${esc(u.displayName || u.email)}</b><a class="btn sm" href="account.html">My account</a><a class="btn dk sm" href="account.html#orders" style="margin-top:6px">My orders</a><br><br><button class="btn-out sm" onclick="firebase.auth().signOut().then(() => toast('You are logged out'))">Log out</button>` : `<a class="btn sm" href="account.html">Login / Register</a>`;
  if (!u) return;
  try {
    const x = (await db.collection('customers').doc(u.uid).get()).data() || {}, f = $('#coForm').elements;
    if (!f['name'].value) f['name'].value = x.name || ''; if (!f.phone.value) f.phone.value = x.phone || '';
    if (!f.address.value) f.address.value = x.address || ''; if (!f.email.value) f.email.value = u.email || '';
  } catch (e) {}
});
(async () => {
  try { SET = (await db.collection('settings').doc('store').get()).data() || {}; } catch (e) {}
  if (SET.currency) SYM = SET.currency;
  const br = $('#brand');
  if (SET.businessName) { br.textContent = SET.businessName; document.title = SET.businessName; }
  if (imgSrc(SET.logo)) br.insertAdjacentHTML('afterbegin', `<img class="logo" src="${esc(imgSrc(SET.logo))}" alt="">`);
  const [cats, prods, pks, ofs, bns] = await Promise.all([load('categories'), load('products'), load('packages'), load('offers'), load('banners')]);
  CATS = cats; BANNERS = bns; SITE = await SITEP;
  const off = new Set(CATS.filter(c => c.active === false).map(c => c.name));
  PRODUCTS = prods.filter(p => p.published !== false && !off.has(p.category));
  PACKAGES = pks.filter(liveP).sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); OFFERS = ofs.filter(liveO);
  const pm = String(SET.paymentMethods || '').split(',').map(x => x.trim()).filter(Boolean), ps = $('#paySel');
  if (pm.length) { ps.innerHTML = pm.map(x => `<option>${esc(x)}</option>`).join(''); $('#payNote').textContent = ''; }
  else { ps.style.display = 'none'; $('#payLbl').style.display = 'none'; $('#payNote').textContent = 'Payment method will be confirmed by the shop after you place the order.'; }
  try { const d = JSON.parse(sessionStorage.getItem('coDraft') || 'null'); if (d) { const fe2 = $('#coForm').elements; ['name', 'phone', 'email', 'address', 'notes'].forEach(k => { if (d[k] && fe2[k]) fe2[k].value = d[k]; }); sessionStorage.removeItem('coDraft'); } } catch (x) {}
  READY = true;
  const enabled = CATS.filter(c => c.active !== false).sort((a, b) => (+a.order || 0) - (+b.order || 0)).map(c => c.name);
  const names = [...new Set([...enabled, ...PRODUCTS.map(p => p.category).filter(Boolean)])];
  const thumb = n => { const c = CATS.find(x => x.name === n), i = imgSrc(c && c.image) || images(PRODUCTS.find(p => p.category === n) || {})[0]; return i ? `<img src="${esc(i)}" alt="">` : esc((n[0] || '?').toUpperCase()); };
  $('#cat').innerHTML = '<option value="">All categories</option>' + names.map(c => `<option>${esc(c)}</option>`).join('');
  $('#homeCats').innerHTML = `<a class="ct" href="#products"><div class="cc" style="background:var(--p)">All</div>All</a>` + names.map((c, k) => `<a class="ct" href="#category/${encodeURIComponent(c)}"><div class="cc" style="background:${COLORS[k % 6]}">${thumb(c)}</div>${esc(c)}</a>`).join('');
  $('#drCats').innerHTML = names.map(c => `<a href="#category/${encodeURIComponent(c)}">${esc(c)}</a>`).join('') || '<a href="#products">All products</a>';
  const fe = PRODUCTS.filter(p => p.featured);
  $('#feat').innerHTML = (fe.length ? fe.slice(0, 8) : PRODUCTS.slice(0, 8)).map(pcard).join('') || '<p>No products yet.</p>';
  $('#homeDeals').innerHTML = PACKAGES.slice(0, 2).map(pkcard).join('') + OFFERS.slice(0, 2).map(ocard).join('') || '<p>No packages or offers right now.</p>';
  drawProducts();
  $('#pk').innerHTML = PACKAGES.map(pkcard).join('') || '<p>No packages available right now.</p>';
  $('#of').innerHTML = OFFERS.map(ocard).join('') || '<p>No active offers right now.</p>';
  heroBuild(buildSlides());
  drawCart(); show();
})();
// a broken photo link becomes a neat blank instead of a broken icon
addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && !t.dataset.bad) { t.dataset.bad = 1; t.style.visibility = 'hidden'; } }, true);
