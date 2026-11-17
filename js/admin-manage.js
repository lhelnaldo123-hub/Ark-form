// Edit / hide / delete for Products, Packages and Offers
const MANAGE = {
  products: { sec: 'products', title: 'Manage Products', flag: 'published', cols: ['name', 'category', 'price'],
    fields: [['name', 'Name', 'text'], ['sku', 'SKU / code (optional)', 'text'], ['category', 'Category', 'text'], ['price', 'Price', 'number'], ['salePrice', 'Sale price (optional)', 'number'],
      ['image', 'Image URL', 'text'], ['description', 'Description', 'area'], ['stock', 'In stock', 'check'], ['featured', 'Featured on home page', 'check'], ['published', 'Published (visible on website)', 'check']] },
  packages: { sec: 'packages', title: 'Manage Packages', flag: 'active', cols: ['name', 'items', 'price'],
    fields: [['name', 'Package name', 'text'], ['items', 'Included items', 'area'], ['normal', 'Normal price', 'number'], ['price', 'Package price', 'number'],
      ['validity', 'Valid until', 'date'], ['active', 'Active (visible on website)', 'check']] },
  offers: { sec: 'offers', title: 'Manage Offers', flag: 'active', cols: ['title', 'code', 'value'],
    fields: [['title', 'Title', 'text'], ['code', 'Coupon code', 'text'], ['details', 'Details', 'area'], ['type', 'Type', 'select:percent|fixed'], ['value', 'Discount value', 'number'],
      ['min', 'Minimum spend', 'number'], ['start', 'Start date', 'date'], ['expiry', 'Expiry date', 'date'], ['limit', 'Usage limit (optional)', 'number'], ['active', 'Active', 'check']] }
};
let MDATA = {};
function mdialog() {
  let d = document.getElementById('mdlg');
  if (!d) { d = document.createElement('dialog'); d.id = 'mdlg'; d.style.cssText = 'max-width:520px;width:92%;border:1px solid #ccc;border-radius:8px;padding:16px'; document.body.appendChild(d); }
  return d;
}
async function loadManage() {
  for (const c in MANAGE) {
    const m = MANAGE[c], sec = document.querySelector(`[data-sec="${m.sec}"]`);
    if (!sec || !can(m.sec)) continue;
    let box = document.getElementById('mg-' + c);
    if (!box) { box = document.createElement('div'); box.id = 'mg-' + c; sec.appendChild(box); }
    let rows = [];
    try { rows = (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { box.innerHTML = '<p>Could not load: ' + esc(e.message) + '</p>'; continue; }
    MDATA[c] = rows;
    box.innerHTML = `<h3>${m.title}</h3><table><tr>${m.cols.map(k => `<th>${esc(k)}</th>`).join('')}<th>Status</th><th></th></tr>` +
      (rows.length ? rows.map(r => `<tr>${m.cols.map(k => `<td>${esc(r[k])}</td>`).join('')}<td>${r[m.flag] === false ? 'Hidden' : 'Live'}</td>
      <td><button onclick="mEdit('${c}','${esc(r.id)}')">Edit</button> <button onclick="mToggle('${c}','${esc(r.id)}')">${r[m.flag] === false ? 'Show' : 'Hide'}</button> <button onclick="mDel('${c}','${esc(r.id)}')">Delete</button></td></tr>`).join('')
        : `<tr><td colspan="${m.cols.length + 2}">Nothing added yet</td></tr>`) + '</table>';
  }
}
function mEdit(c, id) {
  const m = MANAGE[c], r = (MDATA[c] || []).find(x => x.id === id); if (!r) return;
  const f = m.fields.map(([k, label, t]) => {
    const v = r[k], isFlag = t === 'check';
    let inp;
    if (t === 'area') inp = `<textarea name="${k}" rows="3">${esc(v)}</textarea>`;
    else if (isFlag) inp = `<input type="checkbox" name="${k}" ${v === false ? '' : (v === undefined && k !== 'featured' ? 'checked' : (v ? 'checked' : ''))}>`;
    else if (t.startsWith('select:')) inp = `<select name="${k}">${t.slice(7).split('|').map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    else inp = `<input name="${k}" type="${t}" value="${esc(v)}">`;
    return `<label class="tag">${esc(label)}</label>${inp}`;
  }).join('');
  const d = mdialog();
  d.innerHTML = `<form onsubmit="mSave(event,'${c}','${esc(id)}')"><h3>Edit</h3>${f}<br><button>Save changes</button> <button type="button" onclick="mdialog().close()">Cancel</button></form>`;
  d.showModal();
}
async function mSave(e, c, id) {
  e.preventDefault(); if (!can(MANAGE[c].sec)) return alert('You do not have permission');
  const o = {};
  MANAGE[c].fields.forEach(([k, , t]) => {
    const el = e.target.elements[k];
    if (t === 'check') o[k] = el.checked;
    else if (t === 'number') o[k] = el.value === '' ? firebase.firestore.FieldValue.delete() : +el.value;
    else o[k] = el.value;
  });
  try { await db.collection(c).doc(id).update(o); mdialog().close(); loadManage(); } catch (er) { alert(er.message); }
}
async function mToggle(c, id) {
  const m = MANAGE[c], r = MDATA[c].find(x => x.id === id);
  try { await db.collection(c).doc(id).update({ [m.flag]: r[m.flag] === false }); loadManage(); } catch (er) { alert(er.message); }
}
async function mDel(c, id) {
  if (!can(MANAGE[c].sec) || !confirm('Delete this item permanently? Use Hide if you may need it again.')) return;
  try { await db.collection(c).doc(id).delete(); loadManage(); } catch (er) { alert(er.message); }
}
// reload these lists whenever the admin page refreshes (after adding items)
const _refresh0 = refresh;
refresh = async function () { await _refresh0(); loadManage(); };