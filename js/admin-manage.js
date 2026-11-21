// Edit / hide / archive / delete for Products, Categories, Banners, Packages and Offers
const MANAGE={
 products:{sec:'products',title:'Manage Products',flag:'published',cols:['name','category','price'],
  fields:[['name','Name','text'],['sku','SKU / code (optional)','text'],['category','Category','cat'],['price','Price','number'],['salePrice','Sale price (optional)','number'],['image','Main photo','img'],['images','More photos','imgs'],['variants','Sizes / variants (comma separated)','text'],['specs','Specifications','area'],['description','Description','area'],['stock','In stock','check'],['featured','Featured on home page','check'],['published','Published (visible on website)','check']]},
 categories:{sec:'categories',title:'Manage Categories',flag:'active',cols:['name','description','order'],
  fields:[['name','Category name','text'],['description','Description','area'],['image','Category photo','img'],['order','Display order','number'],['active','Enabled (visible on website)','check']]},
 banners:{sec:'banners',title:'Manage Banners',flag:'active',cols:['title','subtitle','order'],
  fields:[['title','Title','text'],['subtitle','Subtitle','text'],['image','Banner photo','img'],['btn','Button text','text'],['link','Button link (#products, #offers or a web address)','text'],['order','Display order','number'],['active','Active (shown on website)','check']]},
 packages:{sec:'packages',title:'Manage Packages',flag:'active',cols:['name','items','price'],
  fields:[['name','Package name','text'],['items','Included items','area'],['normal','Normal price','number'],['price','Package price','number'],['validity','Valid until','date'],['conditions','Conditions','text'],['options','Customisation options','text'],['featured','Featured package','check'],['active','Active (visible on website)','check']]},
 offers:{sec:'offers',title:'Manage Offers',flag:'active',cols:['title','code','value'],
  fields:[['title','Title','text'],['code','Coupon code','text'],['details','Details','area'],['image','Banner photo','img'],['type','Type','select:percent|fixed'],['value','Discount value','number'],['min','Minimum spend','number'],['start','Start date','date'],['expiry','Expiry date','date'],['limit','Usage limit (optional)','number'],['eligible','Eligible categories / product names (comma separated, empty = all)','text'],['active','Active','check']]}
};
const DEF={stock:true,published:true,active:true,featured:false};
const thumbOf=r=>{const u=splitImgs2(r.image)[0]||splitImgs2(r.images)[0];return u?`<img class="tn" src="${esc(u)}" alt="">`:''};
function renderManage(){
 const cats=[...new Set([...DATA.categories.map(c=>c.name),...DATA.products.map(p=>p.category)].filter(Boolean))];
 $('#catlist').innerHTML=cats.map(c=>`<option value="${esc(c)}">`).join('');
 for(const c in MANAGE){
  const m=MANAGE[c],box=$('#mg-'+c);if(!box||!can(m.sec))continue;
  const rows=DATA[c]||[];
  const sampleNote=(c==='products'&&!rows.length)?`<div class="samplebox"><b>The website is showing 8 sample products.</b> They are not in your database yet, so they cannot be edited here.<br><button class="sm" style="margin-top:8px" onclick="importSamples()">Import sample products so I can edit them</button></div>`:'';
  box.innerHTML=sampleNote+`<h3>${m.title}</h3><div class="wrap"><table><tr>${m.cols.map(k=>`<th>${esc(k)}</th>`).join('')}<th>Status</th><th></th></tr>`+
   (rows.length?rows.map(r=>`<tr>${m.cols.map((k,i)=>`<td>${i===0?thumbOf(r):''}${esc(r[k])}</td>`).join('')}<td>${r.archived?'Archived':r[m.flag]===false?'Hidden':'Live'}${c==='offers'?`<br><span class="tag">Used ${+r.used||0}${r.limit?' / '+esc(r.limit):''}</span>`:''}</td>
   <td><button class="sm" onclick="mEdit('${c}','${esc(r.id)}')">Edit</button> <button class="sm" onclick="mToggle('${c}','${esc(r.id)}')">${r[m.flag]===false?'Show':'Hide'}</button>${c==='products'?` <button class="sm" onclick="mArchive('${esc(r.id)}')">Archive</button>`:''} <button class="sm" onclick="mDel('${c}','${esc(r.id)}')">Delete</button></td></tr>`).join('')
   :`<tr><td colspan="${m.cols.length+2}">Nothing added yet</td></tr>`)+'</table></div>';
 }
}
function mEdit(c,id){
 const m=MANAGE[c],r=(DATA[c]||[]).find(x=>x.id===id);if(!r)return;
 const f=m.fields.map(([k,label,t])=>{
  const v=r[k];let inp;
  if(t==='img'||t==='imgs')return`<div class="imgw" data-name="${k}" data-multi="${t==='imgs'?1:0}" data-max="${c==='banners'?1200:800}" data-label="${esc(label)}"></div>`;
  if(t==='area')inp=`<textarea name="${k}" rows="3">${esc(v)}</textarea>`;
  else if(t==='check')inp=`<input type="checkbox" name="${k}" style="width:auto" ${(v===undefined?DEF[k]:!!v)?'checked':''}>`;
  else if(t.startsWith('select:'))inp=`<select name="${k}">${t.slice(7).split('|').map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('')}</select>`;
  else if(t==='cat')inp=`<input name="${k}" list="catlist" value="${esc(v)}">`;
  else inp=`<input name="${k}" type="${t}" value="${esc(v)}">`;
  return`<label class="tag">${esc(label)}</label>${inp}`;
 }).join('');
 showDlg(`<form onsubmit="mSave(event,'${c}','${esc(id)}')"><h3 style="margin-top:0">Edit</h3>${f}<br><button>Save changes</button> <button type="button" class="dk" onclick="closeDlg()">Cancel</button></form>`);
 m.fields.forEach(([k,,t])=>{if(t==='img'||t==='imgs'){const w=document.querySelector('#dlg .imgw[data-name="'+k+'"]');if(w)buildImg(w,r[k])}});
}
async function mSave(e,c,id){
 e.preventDefault();if(!can(MANAGE[c].sec))return alert('You do not have permission');
 const o={};
 MANAGE[c].fields.forEach(([k,,t])=>{
  const el=e.target.elements[k];
  if(t==='check')o[k]=el.checked;
  else if(t==='number')o[k]=el.value===''?firebase.firestore.FieldValue.delete():+el.value;
  else o[k]=el.value.trim();
 });
 if(c==='products'&&o.published)o.archived=false;
 try{await db.collection(c).doc(id).update(o);closeDlg();logAct('Edited '+c.slice(0,-1),o.name||o.title||'');refresh()}catch(er){alert(er.message)}
}
async function mToggle(c,id){
 const m=MANAGE[c],r=DATA[c].find(x=>x.id===id),show=r[m.flag]===false,u={[m.flag]:show};
 if(c==='products'&&show)u.archived=false;
 try{await db.collection(c).doc(id).update(u);logAct((show?'Showed ':'Hid ')+c.slice(0,-1),r.name||r.title||'');refresh()}catch(er){alert(er.message)}
}
async function mArchive(id){
 const r=DATA.products.find(x=>x.id===id);if(!confirm('Archive this product? It will be hidden from the website.'))return;
 try{await db.collection('products').doc(id).update({published:false,archived:true});logAct('Archived product',r.name||'');refresh()}catch(er){alert(er.message)}
}
async function mDel(c,id){
 const r=DATA[c].find(x=>x.id===id);
 if(!can(MANAGE[c].sec)||!confirm('Delete this item permanently? Use Hide or Archive if you may need it again.'))return;
 try{await db.collection(c).doc(id).delete();logAct('Deleted '+c.slice(0,-1),r.name||r.title||'');refresh()}catch(er){alert(er.message)}
}
// copies the 8 sample products (and their 3 categories) into Firestore so they can be edited, re-photographed or deleted
async function importSamples(){
 if(!can('products')||!confirm('Import the 8 sample products and 3 categories into your database? You can then edit or delete them.'))return;
 const cats=['Category 1','Category 2','Category 3'],prods=[[1,0],[2,0],[3,0],[4,1],[5,1],[6,2],[7,2],[8,2]],now=new Date().toISOString(),b=db.batch();
 cats.forEach((n,i)=>b.set(db.collection('categories').doc('s'+(i+1)),{name:n,description:'',order:i+1,active:true,date:now}));
 prods.forEach(([n,c])=>b.set(db.collection('products').doc('d'+n),{name:'Sample Product '+n,category:cats[c],price:0,stock:true,published:true,featured:false,description:'Sample item - replace it with a real product.',image:'',date:now}));
 try{await b.commit();logAct('Imported sample products','8 products');alert('Done. You can now Edit each product (name, price, description, photos).');refresh()}catch(er){alert('Could not import: '+er.message)}
}
RENDERS.push(renderManage);