let ORD = [];
async function loadX() {
  if (can('content')) {
    try {
      const d = (await db.collection('settings').doc('site').get()).data() || {};
      for (const k in d) if ($('#sf')[k]) $('#sf')[k].value = d[k];
    } catch (e) {}
  }
  const g = async (c, s) => { if (!can(s)) return []; try { return (await db.collection(c).get()).docs.map(x => ({ id: x.id, ...x.data() })); } catch (e) { return []; } };
  const [rv, o, q, cu] = await Promise.all([g('reviews', 'reviews'), g('orders', 'orders'), g('enquiries', 'enquiries'), g('customers', 'customers')]);
  ORD = o;
  $('#revs').innerHTML = '<tr><th>Review</th><th>Status</th><th></th></tr>' + rv.map(x => `<tr><td>${'★'.repeat(+x.rating || 0)} ${esc(x.name)}<br>${esc(x.comment)}</td><td>${x.approved ? 'Published' : 'Hidden'}</td>
   <td><button onclick="rvAct('${esc(x.id)}',${!x.approved})">${x.approved ? 'Hide' : 'Approve'}</button> <button onclick="rvDel('${esc(x.id)}')">Delete</button></td></tr>`).join('');
  if (!can('reports')) return;
  const val = o.filter(x => x.status != 'Cancelled').reduce((s, x) => s + (x.total || 0), 0);
  const cnt = {}; o.forEach(x => (x.items || []).forEach(i => cnt[i.name] = (cnt[i.name] || 0) + i.qty));
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => esc(x[0]) + ' (' + x[1] + ')').join(', ') || '-';
  const by = s => o.filter(x => x.status == s).length;
  $('#rep').innerHTML = [['Order value', 'Rs ' + val], ['Pending orders', by('Pending')], ['Completed orders', by('Completed')], ['New enquiries', q.filter(x => x.status == 'New').length],
    ['Customers', cu.length], ['Popular products', top]].map(x => `<div class="card"><b>${x[1]}</b><br>${x[0]}</div>`).join('');
}
async function saveS(e) {
  e.preventDefault(); if (!can('content')) return alert('You do not have permission');
  await db.collection('settings').doc('site').set(Object.fromEntries(new FormData(e.target)), { merge: true });
  alert('Site content saved');
}
async function rvAct(id, a) { if (!can('reviews')) return; await db.collection('reviews').doc(id).update({ approved: a }); loadX(); }
async function rvDel(id) { if (!can('reviews')) return; await db.collection('reviews').doc(id).delete(); loadX(); }
function csv() {
  const rows = [['Order', 'Date', 'Customer', 'Phone', 'Total', 'Status']].concat(ORD.map(x => [x.orderNo, x.date, x.name, x.phone, x.total, x.status]));
  const t = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' })); a.download = 'orders.csv'; a.click();
}