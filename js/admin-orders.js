// ARK Admin - messages to customers on order updates, customer cancellations, return requests, return window setting.
// Load AFTER admin-extra.js and admin-manage.js (see the last script tags in admin.html).
(function () {
  const FV = firebase.firestore.FieldValue;
  const retDays = () => (SETS && SETS.returnDays !== undefined && SETS.returnDays !== '') ? Math.max(0, +SETS.returnDays || 0) : 7;

  // ---- write a message into the customer's Inbox ----
  async function tell(x, title, body, kind) {
    if (!x || !x.uid) return;
    try { await db.collection('messages').add({ uid: x.uid, orderId: x.id, orderNo: x.orderNo, title, body, kind: kind || 'status', date: new Date().toISOString(), read: false, by: ME.name }); } catch (e) { console.error('message failed', e); }
  }
  function statusText(x, st) {
    const pick = x.method === 'Pickup', no = x.orderNo;
    return ({
      'Pending': ['Order pending', 'Your order ' + no + ' is waiting for review.'],
      'Confirmed': ['Order confirmed ✅', 'We have accepted your order ' + no + '.'],
      'Processing': ['Order being prepared 📦', 'We are preparing your order ' + no + '.'],
      'Ready / Dispatched': pick ? ['Ready for pickup 🏬', 'Your order ' + no + ' is ready. Please collect it from the shop.'] : ['Order on its way 🚚', 'Your order ' + no + ' has been dispatched for delivery.'],
      'Completed': [pick ? 'Order collected ✅' : 'Order delivered 🎉', 'Thank you! Order ' + no + ' is complete. Please rate your items in My Orders.' + (retDays() > 0 ? ' If something is wrong you can request a return within ' + retDays() + ' days.' : '')]
    })[st];
  }

  // ---- save status / payment (same as before + customer message) ----
  saveOrder = async function (id) {
    const x = DATA.orders.find(o => o.id === id), st = $('#ost').value, pay = $('#opay').value, u = {};
    if (st !== normSt(x)) { u.status = st; u.history = FV.arrayUnion({ status: st, date: new Date().toISOString(), by: ME.name }); if (st === 'Completed') u.completedAt = new Date().toISOString(); }
    if (pay !== (x.payStatus || 'Unpaid')) u.payStatus = pay;
    if (!Object.keys(u).length) return alert('Nothing changed');
    try {
      await db.collection('orders').doc(id).update(u);
      logAct('Order ' + x.orderNo, [u.status && 'Status ' + u.status, u.payStatus && 'Payment ' + u.payStatus].filter(Boolean).join(', '));
      if (u.status) { const t = statusText(x, st); if (t) await tell(x, t[0], t[1]); }
      if (u.payStatus === 'Refunded') await tell(x, 'Refund recorded 💸', 'A refund has been recorded for order ' + x.orderNo + '.');
      await refresh(); openOrder(id);
    } catch (e) { alert(e.message); }
  };

  // ---- staff cancel (same as before + customer message) ----
  cancelOrder = async function (id) {
    const r = $('#ocr').value.trim(); if (r.length < 3) return alert('Please type a reason for cancelling');
    if (!confirm('Cancel this order? The record is kept.')) return;
    const x = DATA.orders.find(o => o.id === id), now = new Date().toISOString();
    try {
      await db.collection('orders').doc(id).update({ status: 'Cancelled', cancelReason: r, cancelledBy: ME.name, cancelledAt: now, history: FV.arrayUnion({ status: 'Cancelled', date: now, by: ME.name }) });
      logAct('Cancelled order ' + x.orderNo, r);
      await tell(x, 'Order cancelled', 'Your order ' + x.orderNo + ' was cancelled by the shop. Reason: ' + r);
      await refresh(); openOrder(id);
    } catch (e) { alert(e.message); }
  };

  // ---- return requests ----
  window.returnAct = async function (id, ok) {
    const x = DATA.orders.find(o => o.id === id), el = $('#rrn'), note = el ? el.value.trim() : '';
    if (!ok && note.length < 3) return alert('Please type a short reason for rejecting the return');
    const now = new Date().toISOString(), s = ok ? 'Approved' : 'Rejected';
    try {
      await db.collection('orders').doc(id).update({ 'returnRequest.status': s, 'returnRequest.reply': note, 'returnRequest.decidedBy': ME.name, 'returnRequest.decidedAt': now, history: FV.arrayUnion({ status: 'Return ' + s.toLowerCase(), date: now, by: ME.name }) });
      logAct('Return ' + s.toLowerCase() + ' ' + x.orderNo, note);
      await tell(x, ok ? 'Return approved ✅' : 'Return not approved', ok ? 'Your return for order ' + x.orderNo + ' was approved.' + (note ? ' ' + note : ' We will contact you about the next step.') : 'Your return request for order ' + x.orderNo + ' was not approved. Reason: ' + note, 'return');
      await refresh(); openOrder(id);
    } catch (e) { alert(e.message); }
  };
  const _open = openOrder;
  openOrder = function (id) {
    _open(id);
    const x = DATA.orders.find(o => o.id === id), r = x && x.returnRequest, h = $('#dlg h3'); if (!r || !h) return;
    h.insertAdjacentHTML('afterend', `<div class="mbox"><b>↩ Return request: ${esc(r.status)}</b><br><span class="tag">${esc(fdate(r.date))}</span><p style="margin:6px 0;white-space:pre-wrap">${esc(r.reason)}</p>
      ${r.status === 'Requested' ? `<textarea id="rrn" rows="2" placeholder="Reply to the customer (required if rejecting)"></textarea><button onclick="returnAct('${esc(x.id)}',true)">Approve return</button> <button style="background:#b00020" onclick="returnAct('${esc(x.id)}',false)">Reject return</button>` : `<span class="tag">${esc(r.status)} by ${esc(r.decidedBy || '')}${r.reply ? ' · ' + esc(r.reply) : ''}</span>`}</div>`);
  };

  // ---- store settings: keep the return window ----
  saveStore = async function (e) {
    e.preventDefault(); if (!can('settings')) return alert('You do not have permission');
    const f = e.target.elements, rd = f.returnDays.value.trim();
    const o = { businessName: f.businessName.value.trim(), logo: f.logo.value.trim(), currency: f.currency.value.trim() || 'Rs', deliveryFee: +f.deliveryFee.value || 0, freeAbove: +f.freeAbove.value || 0, tax: +f.tax.value || 0, returnDays: rd === '' ? 7 : Math.max(0, +rd || 0), paymentMethods: f.paymentMethods.value.trim() };
    try { await db.collection('settings').doc('store').set(o, { merge: true }); logAct('Updated store settings', ''); alert('Settings saved'); } catch (er) { alert(er.message); }
  };

  // ---- small additions to dashboard and the orders table ----
  function marks() {
    if (!can('orders')) return;
    const rows = $('#orders') && $('#orders').querySelectorAll('tr');
    (rows ? [...rows] : []).forEach(tr => {
      const td = tr.querySelectorAll('td'); if (td.length < 5) return;
      const o = DATA.orders.find(z => z.orderNo === td[0].textContent.trim()); if (!o) return;
      if (o.returnRequest && o.returnRequest.status === 'Requested') td[4].insertAdjacentHTML('beforeend', '<br><b style="color:#b00020">↩ Return requested</b>');
      else if (o.returnRequest) td[4].insertAdjacentHTML('beforeend', '<br><span class="tag">Return ' + esc(o.returnRequest.status.toLowerCase()) + '</span>');
      if (o.cancelledBy === 'Customer') td[4].insertAdjacentHTML('beforeend', '<br><span class="tag">cancelled by customer</span>');
    });
  }
  const _ro = renderOrders;
  renderOrders = function () { _ro(); marks(); };
  // ---- Reports: most wishlisted products ----
  function wishCard() {
    const rep = $('#rep'); if (!rep || !can('reports') || !can('customers')) return;
    const cnt = {}; (DATA.customers || []).forEach(c => (c.wishlist || []).forEach(id => { cnt[id] = (cnt[id] || 0) + 1; }));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => { const p = DATA.products.find(x => x.id === id); return esc(p ? p.name : '(removed product)') + ' (' + n + ')'; }).join('<br>') || '-';
    rep.insertAdjacentHTML('beforeend', `<div class="card"><b>${top}</b><br>Most wishlisted products</div>`);
  }
  const _rr = renderReports;
  renderReports = function () { _rr(); wishCard(); };
  RENDERS.push(function () {
    wishCard();
    if (!can('orders')) return;
    const n = DATA.orders.filter(o => o.returnRequest && o.returnRequest.status === 'Requested').length, st = $('#stats');
    if (st && n) st.insertAdjacentHTML('beforeend', `<div class="card" style="cursor:pointer;border-left:5px solid #b00020" onclick="go('orders')"><h2>${n}</h2>Return requests</div>`);
    marks();
  });
})();
