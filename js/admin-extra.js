// ---- Part 2: add the new admin controls without editing admin.html ----
let SETS={};
(function(){
 const os=document.getElementById('os');
 if(os&&![...os.options].some(o=>o.text==='Delivered')){
  [...os.options].filter(o=>o.text==='Completed').forEach(o=>o.remove());
  ['Delivered','Return requested'].forEach(t=>os.add(new Option(t)));
 }
 const f=document.getElementById('stf');
 if(f&&!f.elements.returnDays){
  f.querySelector('button').insertAdjacentHTML('beforebegin','<h4 style="margin-top:14px">Orders: cancel &amp; return rules</h4><label class="tag">Customers can return an order within this many days after delivery (0 = returns not allowed)</label><input name="returnDays" type="number" min="0" placeholder="Return window in days (default 7)"><label class="tag">Customers can cancel their own order while it is</label><select name="cancelUntil"><option value="Pending">Pending only</option><option value="Confirmed" selected>Pending or Confirmed</option></select>');
 }
})();
const fdate=d=>String(d||'').slice(0,10);
const byDate=(a,b)=>(b.date||'').localeCompare(a.date||'');
const OST=['Pending','Confirmed','Processing','Ready / Dispatched','Delivered','Cancelled'],PAY=['Unpaid','Paid','Partially paid','Refunded'],EST=['New','In Progress','Responded','Closed'];
const notesHtml=n=>(n||[]).map(x=>`<div class="note">${esc(x.text)}<br><span class="tag">${esc(x.by)} · ${esc(fdate(x.date))}</span></div>`).join('')||'<p class="tag">No notes yet</p>';
const closeBtn='<hr><button type="button" style="background:#667" onclick="closeDlg()">Close</button>';

// ---------- Dashboard ----------
function renderDash(){
 const D=DATA,c=[],live=a=>a.filter(x=>x.active!==false);
 if(can('products'))c.push(['Products',D.products.length]);
 if(can('packages'))c.push(['Active packages',live(D.packages).length]);
 if(can('offers'))c.push(['Active offers',live(D.offers).length]);
 if(can('enquiries'))c.push(['New enquiries',D.enquiries.filter(x=>x.status==='New').length]);
 if(can('customers'))c.push(['Customers',D.customers.length]);
 if(can('orders')){c.push(['Orders',D.orders.length]);c.push(['Pending orders',D.orders.filter(x=>x.status==='Pending').length]);c.push(['Return requests',D.orders.filter(x=>x.returnStatus==='Requested').length])}
 $('#stats').innerHTML=c.map(x=>`<div class="card"><h2>${x[1]}</h2>${x[0]}</div>`).join('');
 const qa=[['products','+ Add product'],['packages','+ Create package'],['offers','+ Publish offer']].filter(x=>can(x[0]));
 $('#quick').innerHTML=qa.map(x=>`<button onclick="go('${x[0]}')">${x[1]}</button> `).join('')||'-';
 if(can('orders')){
  const days=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10))}
  const n=days.map(d=>D.orders.filter(o=>fdate(o.date)===d).length),mx=Math.max(1,...n);
  $('#chart').innerHTML='<div class="bars">'+n.map(v=>`<div style="height:${v/mx*100}%"><span>${v}</span></div>`).join('')+'</div><div class="bars" style="height:auto;padding:4px 0 0">'+days.map(d=>`<small style="flex:1;text-align:center;font-size:10px">${d.slice(5)}</small>`).join('')+'</div>';
  $('#recent').innerHTML='<tr><th>No</th><th>Customer</th><th>Total</th><th>Status</th></tr>'+([...D.orders].sort(byDate).slice(0,5).map(x=>`<tr><td>${esc(x.orderNo)}</td><td>${esc(x.name)}</td><td>${money(x.total)}</td><td>${esc(x.status)}</td></tr>`).join('')||'<tr><td colspan=4>No orders yet</td></tr>');
 }else{$('#chart').innerHTML='';$('#recent').innerHTML=''}
 $('#recentq').innerHTML=can('enquiries')?'<tr><th>From</th><th>Type</th><th>Status</th></tr>'+([...D.enquiries].sort(byDate).slice(0,5).map(x=>`<tr><td>${esc(x.name)}<br>${esc(x.phone)}</td><td>${esc(x.type)}</td><td>${esc(x.status)}</td></tr>`).join('')||'<tr><td colspan=3>No enquiries yet</td></tr>'):'';
}

// ---------- Notes (orders + enquiries) ----------
async function addNote(c,id,fld){
 const t=$('#'+fld).value.trim();if(!t)return;
 try{await db.collection(c).doc(id).update({staffNotes:firebase.firestore.FieldValue.arrayUnion({text:t,by:ME.name,date:new Date().toISOString()})});
  logAct('Note on '+c.slice(0,-1),t.slice(0,60));await refresh();c==='orders'?openOrder(id):openEnq(id)}catch(e){alert(e.message)}
}

// ---------- Orders ----------
function renderOrders(){
 if(!can('orders'))return;
 const q=($('#oq').value||'').toLowerCase(),s=$('#os').value,f=$('#ofrom').value,t=$('#oto').value;
 const l=DATA.orders.filter(o=>(!q||[o.orderNo,o.name,o.phone].join(' ').toLowerCase().includes(q))&&(!s||o.status===s||(s==='Delivered'&&o.status==='Completed')||(s==='Return requested'&&o.returnStatus==='Requested'))&&(!f||fdate(o.date)>=f)&&(!t||fdate(o.date)<=t)).sort(byDate);
 $('#orders').innerHTML='<tr><th>No</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th>Payment</th><th></th></tr>'+(l.length?l.map(x=>`<tr><td>${esc(x.orderNo)}</td><td>${esc(fdate(x.date))}</td><td>${esc(x.name)}<br>${esc(x.phone)}</td><td>${money(x.total)}</td><td>${esc(x.status)}${x.returnStatus?`<br><span class="tag" style="color:#b00020">Return: ${esc(x.returnStatus)}</span>`:''}</td><td>${esc(x.payStatus||'Unpaid')}</td><td><button class="sm" onclick="openOrder('${esc(x.id)}')">Open</button></td></tr>`).join(''):'<tr><td colspan=7>No orders found</td></tr>');
}
function openOrder(id){
 const x=DATA.orders.find(o=>o.id===id);if(!x)return;
 const items=(x.items||[]).map(i=>`<tr><td>${esc(i.name)}${i.variant?' ('+esc(i.variant)+')':''}</td><td>${esc(i.qty)}</td><td>${money(i.price*i.qty)}</td></tr>`).join('');
 let sts=x.status==='Cancelled'?OST:OST.filter(s=>s!=='Cancelled');if(!sts.includes(x.status))sts=[x.status,...sts];
 showDlg(`<h3 style="margin-top:0">Order ${esc(x.orderNo)}</h3>
 <p><b>${esc(x.name)}</b><br>${esc(x.phone)}${x.email?'<br>'+esc(x.email):''}<br>${esc(x.address)}<br><span class="tag">${esc(fdate(x.date))}</span></p>
 ${x.notes?`<p class="tag">Customer note: ${esc(x.notes)}</p>`:''}
 <table><tr><th>Item</th><th>Qty</th><th>Amount</th></tr>${items}</table>
 <p>Subtotal ${money(x.subtotal??x.total)} · Discount ${money(x.discount)}${x.coupon?' ('+esc(x.coupon)+')':''}${+x.delivery?' · Delivery '+money(x.delivery):''}${+x.tax?' · Tax '+money(x.tax):''}<br><b>Total ${money(x.total)}</b> · ${esc(x.payment||'')}</p>
 <label class="tag">Order status</label><select id="ost">${sts.map(s=>`<option ${s===x.status?'selected':''}>${s}</option>`).join('')}</select>
 <label class="tag">Payment status</label><select id="opay">${PAY.map(s=>`<option ${s===(x.payStatus||'Unpaid')?'selected':''}>${s}</option>`).join('')}</select>
 <button onclick="saveOrder('${esc(x.id)}')">Save</button>
 ${x.status==='Cancelled'?`<p class="msg err">Cancelled${x.cancelReason?': '+esc(x.cancelReason):''}${x.cancelledBy?' (by '+esc(x.cancelledBy)+')':''}</p>`:`<hr><input id="ocr" placeholder="Reason for cancelling"><button style="background:#b00020" onclick="cancelOrder('${esc(x.id)}')">Cancel order</button>`}
 ${returnBlock(x)}
 <hr><h4>Internal notes</h4>${notesHtml(x.staffNotes)}
 <textarea id="onote" rows="2" placeholder="Add internal note"></textarea><button onclick="addNote('orders','${esc(x.id)}','onote')">Add note</button>${closeBtn}`);
}
async function saveOrder(id){
 const x=DATA.orders.find(o=>o.id===id),s=$('#ost').value,p=$('#opay').value,now=new Date().toISOString(),u={status:s,payStatus:p};
 if(s!==x.status){u.history=firebase.firestore.FieldValue.arrayUnion({status:s,date:now,by:ME.name});if(s==='Delivered')u.deliveredAt=now}
 try{await db.collection('orders').doc(id).update(u);logAct('Order '+x.orderNo,'Status '+s+', payment '+p);await refresh();openOrder(id)}catch(e){alert(e.message)}
}
// ---------- Returns ----------
function returnBlock(x){
 const del=x.status==='Delivered'||x.status==='Completed';
 if(!x.returnStatus)return del?`<p class="tag">No return requested. Customers can return within ${+SETS.returnDays>=0&&SETS.returnDays!==undefined?+SETS.returnDays:7} days of delivery${x.deliveredAt?' (delivered '+esc(fdate(x.deliveredAt))+')':''}.</p>`:'';
 const c=x.returnStatus==='Rejected'?'#b00020':x.returnStatus==='Requested'?'#b8892f':'#1b7f3b';
 return `<hr><h4>Return request: <span style="color:${c}">${esc(x.returnStatus)}</span></h4><p class="tag">Asked on ${esc(fdate(x.returnRequestedAt))}</p><p style="white-space:pre-wrap">${esc(x.returnReason||'')}</p>${x.returnNote?`<p class="tag">Your reply: ${esc(x.returnNote)} (${esc(x.returnHandledBy||'')})</p>`:''}
 <input id="rnote" placeholder="Message to the customer (shown on their orders page)" value="${esc(x.returnNote||'')}">
 <button class="sm" onclick="returnAct('${esc(x.id)}','Approved')">Approve</button> <button class="sm" style="background:#b00020;color:#fff" onclick="returnAct('${esc(x.id)}','Rejected')">Reject</button> <button class="sm dk" onclick="returnAct('${esc(x.id)}','Refunded')">Mark returned &amp; refunded</button>`;
}
async function returnAct(id,st){
 const x=DATA.orders.find(o=>o.id===id),u={returnStatus:st,returnNote:$('#rnote').value.trim(),returnHandledBy:ME.name,returnHandledAt:new Date().toISOString()};
 if(st==='Rejected'&&u.returnNote.length<3)return alert('Please type a short reason for rejecting');
 if(st==='Refunded')u.payStatus='Refunded';
 try{await db.collection('orders').doc(id).update(u);logAct('Return '+st+' '+x.orderNo,u.returnNote);await refresh();openOrder(id)}catch(e){alert(e.message)}
}
async function cancelOrder(id){
 const r=$('#ocr').value.trim();if(r.length<3)return alert('Please type a reason for cancelling');
 if(!confirm('Cancel this order? The record is kept.'))return;
 const x=DATA.orders.find(o=>o.id===id);
 try{await db.collection('orders').doc(id).update({status:'Cancelled',cancelReason:r,cancelledBy:ME.name,cancelledAt:new Date().toISOString(),history:firebase.firestore.FieldValue.arrayUnion({status:'Cancelled',date:new Date().toISOString(),by:ME.name})});
  logAct('Cancelled order '+x.orderNo,r);await refresh();openOrder(id)}catch(e){alert(e.message)}
}

// ---------- Enquiries ----------
function renderEnq(){
 if(!can('enquiries'))return;
 const q=($('#eq').value||'').toLowerCase(),s=$('#es').value;
 const l=DATA.enquiries.filter(x=>(!q||[x.name,x.phone,x.message].join(' ').toLowerCase().includes(q))&&(!s||x.status===s)).sort(byDate);
 $('#enq').innerHTML='<tr><th>From</th><th>Type / Message</th><th>Status</th><th></th></tr>'+(l.length?l.map(x=>`<tr><td>${esc(x.name)}<br>${esc(x.phone)}<br><span class="tag">${esc(fdate(x.date))}</span></td><td>${esc(x.type)}: ${esc(String(x.message||'').slice(0,80))}</td><td>${esc(x.status)}</td><td><button class="sm" onclick="openEnq('${esc(x.id)}')">Open</button></td></tr>`).join(''):'<tr><td colspan=4>No enquiries found</td></tr>');
}
function openEnq(id){
 const x=DATA.enquiries.find(o=>o.id===id);if(!x)return;
 showDlg(`<h3 style="margin-top:0">Enquiry</h3><p><b>${esc(x.name)}</b><br>${esc(x.phone)}${x.email?'<br>'+esc(x.email):''}<br><span class="tag">${esc(fdate(x.date))} · ${esc(x.type)}</span></p>
 <p style="white-space:pre-wrap">${esc(x.message)}</p>
 <label class="tag">Status</label><select id="est">${EST.map(s=>`<option ${s===x.status?'selected':''}>${s}</option>`).join('')}</select>
 <button onclick="saveEnq('${esc(x.id)}',$('#est').value)">Save status</button> <button style="background:var(--p)" onclick="saveEnq('${esc(x.id)}','Closed')">Mark handled</button>
 <hr><h4>Internal notes</h4>${notesHtml(x.staffNotes)}
 <textarea id="enote" rows="2" placeholder="Add internal note"></textarea><button onclick="addNote('enquiries','${esc(x.id)}','enote')">Add note</button>${closeBtn}`);
}
async function saveEnq(id,s){
 try{await db.collection('enquiries').doc(id).update({status:s,handledBy:ME.name});logAct('Enquiry status',s);await refresh();openEnq(id)}catch(e){alert(e.message)}
}

// ---------- Customers ----------
const ordersOf=c=>DATA.orders.filter(o=>(o.uid&&o.uid===c.id)||(!o.uid&&c.phone&&o.phone===c.phone));
function renderCust(){
 if(!can('customers'))return;
 const q=($('#cq').value||'').toLowerCase();
 const l=DATA.customers.filter(x=>!q||[x.name,x.phone,x.email].join(' ').toLowerCase().includes(q));
 $('#cust').innerHTML='<tr><th>Customer</th><th>Orders</th><th>Spent</th><th>Status</th><th></th></tr>'+(l.length?l.map(x=>{
  const o=ordersOf(x),sp=o.filter(z=>z.status!=='Cancelled').reduce((s,z)=>s+(+z.total||0),0);
  return`<tr><td>${esc(x.name)}<br>${esc(x.phone)}<br><span class="tag">${esc(x.email)}</span></td><td>${o.length}</td><td>${money(sp)}</td><td>${x.active===false?'Deactivated':'Active'}</td>
  <td><button class="sm" onclick="custHist('${esc(x.id)}')">History</button> <button class="sm" onclick="togCust('${esc(x.id)}')">${x.active===false?'Activate':'Deactivate'}</button></td></tr>`}).join(''):'<tr><td colspan=5>No customers found</td></tr>');
}
function custHist(id){
 const c=DATA.customers.find(x=>x.id===id);if(!c)return;
 const o=ordersOf(c).sort(byDate);
 showDlg(`<h3 style="margin-top:0">${esc(c.name)}</h3><p>${esc(c.phone)}<br>${esc(c.email)}<br>${esc(c.address||'')}</p>
 <table><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th></tr>${o.map(x=>`<tr><td>${esc(x.orderNo)}</td><td>${esc(fdate(x.date))}</td><td>${money(x.total)}</td><td>${esc(x.status)}</td></tr>`).join('')||'<tr><td colspan=4>No orders yet</td></tr>'}</table>${closeBtn}`);
}
async function togCust(id){
 const c=DATA.customers.find(x=>x.id===id),a=c.active===false;
 if(!confirm((a?'Activate ':'Deactivate ')+c.name+'?'))return;
 try{await db.collection('customers').doc(id).update({active:a});logAct((a?'Activated':'Deactivated')+' customer',c.name);refresh()}catch(e){alert(e.message)}
}

// ---------- Reviews ----------
function renderRevs(){
 if(!can('reviews'))return;
 $('#revs').innerHTML='<tr><th>Review</th><th>Status</th><th></th></tr>'+(DATA.reviews.length?DATA.reviews.map(x=>`<tr><td>${'★'.repeat(Math.min(5,+x.rating||0))} ${esc(x.name)}${x.productName?` <span class="tag">on ${esc(x.productName)}${x.orderNo?' · '+esc(x.orderNo):''}</span>`:''}<br>${esc(x.comment)}</td><td>${x.approved?'Published':'Hidden'}</td>
  <td><button class="sm" onclick="rvAct('${esc(x.id)}',${!x.approved})">${x.approved?'Hide':'Approve'}</button> <button class="sm" onclick="rvDel('${esc(x.id)}')">Delete</button></td></tr>`).join(''):'<tr><td colspan=3>No reviews yet</td></tr>');
}
async function rvAct(id,a){if(!can('reviews'))return;try{await db.collection('reviews').doc(id).update({approved:a});logAct(a?'Approved review':'Hid review','');refresh()}catch(e){alert(e.message)}}
async function rvDel(id){if(!can('reviews')||!confirm('Delete this review?'))return;try{await db.collection('reviews').doc(id).delete();logAct('Deleted review','');refresh()}catch(e){alert(e.message)}}

// ---------- Site content + store settings ----------
async function renderContent(){
 if(!can('content'))return;
 try{const d=(await db.collection('settings').doc('site').get()).data()||{},f=$('#sf').elements;for(const k in d)if(f[k])f[k].value=d[k]}catch(e){}
}
async function saveS(e){
 e.preventDefault();if(!can('content'))return alert('You do not have permission');
 try{await db.collection('settings').doc('site').set(Object.fromEntries(new FormData(e.target)),{merge:true});logAct('Updated site content','');alert('Site content saved')}catch(er){alert(er.message)}
}
async function renderSettings(){
 if(!can('settings'))return;
 try{const d=(await db.collection('settings').doc('store').get()).data()||{},f=$('#stf').elements;SETS=d;for(const k in d)if(f[k])f[k].value=d[k]}catch(e){}
}
async function saveStore(e){
 e.preventDefault();if(!can('settings'))return alert('You do not have permission');
 const f=e.target.elements,o={businessName:f.businessName.value.trim(),logo:f.logo.value.trim(),currency:f.currency.value.trim()||'Rs',deliveryFee:+f.deliveryFee.value||0,freeAbove:+f.freeAbove.value||0,tax:+f.tax.value||0,returnDays:f.returnDays.value===''?7:Math.max(0,+f.returnDays.value),cancelUntil:f.cancelUntil.value};
 try{await db.collection('settings').doc('store').set(o,{merge:true});logAct('Updated store settings','');alert('Settings saved')}catch(er){alert(er.message)}
}

// ---------- Reports ----------
function renderReports(){
 if(!can('reports'))return;
 const f=$('#rf').value,t=$('#rt').value,inR=x=>(!f||fdate(x.date)>=f)&&(!t||fdate(x.date)<=t);
 const o=DATA.orders.filter(inR),ok=o.filter(x=>x.status!=='Cancelled'),q=DATA.enquiries.filter(inR),cu=DATA.customers.filter(inR);
 const val=ok.reduce((s,x)=>s+(+x.total||0),0);
 const cnt={};ok.forEach(x=>(x.items||[]).forEach(i=>cnt[i.name]=(cnt[i.name]||0)+(+i.qty||0)));
 const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>esc(x[0])+' ('+x[1]+')').join('<br>')||'-';
 const penq=DATA.products.map(p=>[p.name,q.filter(x=>String(x.message||'').includes(p.name)).length]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>esc(x[0])+' ('+x[1]+')').join('<br>')||'-';
 const cp={};ok.forEach(x=>{if(x.coupon){cp[x.coupon]=cp[x.coupon]||{n:0,d:0};cp[x.coupon].n++;cp[x.coupon].d+=+x.discount||0}});
 const cpt=Object.entries(cp).map(([k,v])=>esc(k)+': '+v.n+' orders, '+money(v.d)+' off').join('<br>')||'-';
 const per={};ok.forEach(x=>{const k=x.uid||x.phone;if(k)per[k]=(per[k]||0)+1});
 const rep=Object.values(per).filter(n=>n>1).length,by=s=>o.filter(x=>x.status===s).length;
 const cards=[['Order value',money(val)],['Orders',o.length],['Pending orders',by('Pending')],['Delivered orders',by('Delivered')+by('Completed')],['Return requests',o.filter(x=>x.returnStatus).length],['Cancelled orders',by('Cancelled')],['Popular products',top],['Product enquiries',penq],['Coupon usage',cpt],['New customers',cu.length],['Repeat customers',rep],['New enquiries',q.filter(x=>x.status==='New').length],['In progress',q.filter(x=>x.status==='In Progress').length],['Responded / closed',q.filter(x=>x.status==='Responded'||x.status==='Closed').length]];
 $('#rep').innerHTML=cards.map(x=>`<div class="card"><b>${x[1]}</b><br>${x[0]}</div>`).join('');
}
function csv(){
 const f=$('#rf').value,t=$('#rt').value;
 const o=DATA.orders.filter(x=>(!f||fdate(x.date)>=f)&&(!t||fdate(x.date)<=t));
 const rows=[['Order','Date','Customer','Phone','Subtotal','Discount','Coupon','Delivery','Tax','Total','Status','Payment status']].concat(o.map(x=>[x.orderNo,x.date,x.name,x.phone,x.subtotal??'',x.discount??0,x.coupon||'',x.delivery??0,x.tax??0,x.total,x.status,x.payStatus||'Unpaid']));
 const s=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'text/csv'}));a.download='orders.csv';a.click();
}
function printRep(){go('reports');print()}

// ---------- Staff & roles ----------
function renderStaff(){
 if(!can('staff'))return;
 const me=auth.currentUser.uid;
 $('#stafft').innerHTML='<tr><th>Staff</th><th>Role</th><th>Status</th></tr>'+DATA.staff.map(x=>`<tr><td>${esc(x.name)}<br><span class="tag">${esc(x.email||'')}</span></td>
  <td><select ${x.id===me?'disabled':''} onchange="setRole('${esc(x.id)}',this.value)">${Object.keys(ROLES).map(r=>`<option ${r===x.role?'selected':''}>${r}</option>`).join('')}</select></td>
  <td>${x.active===false?'Inactive':'Active'}<br>${x.id===me?'(you)':`<button class="sm" onclick="togStaff('${esc(x.id)}')">${x.active===false?'Activate':'Deactivate'}</button>`}</td></tr>`).join('');
}
async function addStaff(e){
 e.preventDefault();if(!can('staff'))return alert('You do not have permission');
 const d=Object.fromEntries(new FormData(e.target)),em=d.email.trim(),nm=d.name.trim();
 if(d.password.length<6)return alert('Password must be at least 6 characters');
 let app2;
 try{
  app2=firebase.initializeApp(FIREBASE_CONFIG,'staff'+Date.now());
  const c=await app2.auth().createUserWithEmailAndPassword(em,d.password);
  await db.collection('staff').doc(c.user.uid).set({name:nm,email:em,role:d.role,active:true,date:new Date().toISOString()});
  await app2.auth().signOut();
  logAct('Created staff account',nm+' ('+d.role+')');
  e.target.reset();alert('Staff account created. Give them the email and password.');refresh();
 }catch(er){alert(er.message)}
 finally{if(app2)app2.delete().catch(()=>{})}
}
async function setRole(id,r){
 if(!can('staff'))return;
 try{await db.collection('staff').doc(id).update({role:r});logAct('Changed staff role',r);refresh()}catch(e){alert(e.message)}
}
async function togStaff(id){
 const x=DATA.staff.find(s=>s.id===id),a=x.active===false;
 if(!confirm((a?'Activate ':'Deactivate ')+x.name+'?'))return;
 try{await db.collection('staff').doc(id).update({active:a});logAct((a?'Activated':'Deactivated')+' staff',x.name);refresh()}catch(e){alert(e.message)}
}

// ---------- Activity log ----------
function renderActs(){
 if(!can('activity'))return;
 $('#acts').innerHTML='<tr><th>When</th><th>Who</th><th>Action</th></tr>'+(DATA.activity.length?DATA.activity.map(x=>`<tr><td>${esc(String(x.date||'').slice(0,16).replace('T',' '))}</td><td>${esc(x.who)}<br><span class="tag">${esc(x.role)}</span></td><td>${esc(x.action)}<br><span class="tag">${esc(x.detail)}</span></td></tr>`).join(''):'<tr><td colspan=3>No activity yet</td></tr>');
}
RENDERS.push(renderDash,renderOrders,renderEnq,renderCust,renderRevs,renderContent,renderSettings,renderReports,renderStaff,renderActs);