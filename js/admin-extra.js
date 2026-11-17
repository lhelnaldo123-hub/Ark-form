let ORD = [];
firebase.auth().onAuthStateChanged(u => { if (u) loadX(); });
async function loadX() {
  try {
    const d = (await db.collection('settings').doc('site').get()).data() || {};
    for (const k in d) if ($('#sf')[k]) $('#sf')[k].value = d[k];
  } catch (e) {}
  const g = async c => (await db.collection(c).get()).docs.map(x => ({ id: x.id, ...x.data() }));
  const [rv, o, q, cu] = await Promise.all([g('reviews'), g('orders'), g('enquiries'), g('customers')]);
  ORD = o;
  $('#revs').innerHTML = '<tr><th>Review</th><th>Status</th><th></th></tr>' + rv.map(x => `<tr><td>${'★'.repeat(x.rating)} ${x.name}<br>${x.comment}</td><td>${x.approved ? 'Published' : 'Hidden'}</td>
   <td><button onclick="rvAct('${x.id}',${!x.approved})">${x.approved ? 'Hide' : 'Approve'}</button> <button onclick="rvDel('${x.id}')">Delete</button></td></tr>`).join('');
  const val = o.filter(x => x.status != 'Cancelled').reduce((s, x) => s + (x.total || 0), 0);
  const cnt = {}; o.forEach(x => (x.items || []).forEach(i => cnt[i.name] = (cnt[i.name] || 0) + i.qty));
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0] + ' (' + x[1] + ')').join(', ') || '-';
  const by = s => o.filter(x => x.status == s).length;
  $('#rep').innerHTML = [['Order value', 'Rs ' + val], ['Pending orders', by('Pending')], ['Completed orders', by('Completed')], ['New enquiries', q.filter(x => x.status == 'New').length],
    ['Customers', cu.length], ['Popular products', top]].map(x => `<div class="card"><b>${x[1]}</b><br>${x[0]}</div>`).join('');
}
async function saveS(e) {
  e.preventDefault();
  await db.collection('settings').doc('site').set(Object.fromEntries(new FormData(e.target)), { merge: true });
  alert('Site content saved');
}
async function rvAct(id, a) { await db.collection('reviews').doc(id).update({ approved: a }); loadX(); }
async function rvDel(id) { await db.collection('reviews').doc(id).delete(); loadX(); }
function csv() {
  const rows = [['Order', 'Date', 'Customer', 'Phone', 'Total', 'Status']].concat(ORD.map(x => [x.orderNo, x.date, x.name, x.phone, x.total, x.status]));
  const t = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' })); a.download = 'orders.csv'; a.click();
}
