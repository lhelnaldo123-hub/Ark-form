const waLink = v => { v = String(v || '').trim(); if (/^https?:\/\//i.test(v)) return v; const d = v.replace(/\D/g, ''); return d ? 'https://wa.me/' + d : ''; };
(async () => {
  const s = await SITEP;
  if (s.announce) { const e = $('#strip'); e.textContent = s.announce; e.style.display = ''; }
  if (s.about) $('#aboutText').textContent = s.about;
  const rows = [['Address', s.address], ['Phone / WhatsApp', s.phone], ['Email', s.email], ['Hours', s.hours]].filter(x => x[1]);
  if (rows.length) {
    $('#contactInfo').innerHTML = rows.map(x => `<p><b>${x[0]}:</b> ${esc(x[1])}</p>`).join('');
    $('#fContact').innerHTML = rows.map(x => `<p>${esc(x[1])}</p>`).join('');
  }
  const links = [['Facebook', safeUrl(s.facebook)], ['Instagram', safeUrl(s.instagram)], ['WhatsApp', waLink(s.whatsapp)]].filter(x => x[1]);
  $('#fSocial').innerHTML = links.length ? '<h4 style="margin-top:12px">Follow us</h4>' + links.map(x => `<a href="${esc(x[1])}" target="_blank" rel="noopener">${x[0]}</a>`).join('') : '';
  $('#cSocial').innerHTML = links.map(x => `<a class="btn" style="margin:0 6px 6px 0" href="${esc(x[1])}" target="_blank" rel="noopener">${x[0]}</a>`).join('');
  const m = safeUrl(s.map);
  $('#mapLink').innerHTML = m ? `<a class="btn dk" href="${esc(m)}" target="_blank" rel="noopener">📍 View on map</a>` : '';
  [['faqBox', s.faq], ['privBox', s.privacy], ['termsBox', s.terms], ['retBox', s.returns]].forEach(([id, v]) => {
    if (v) $('#' + id).innerHTML = `<p style="white-space:pre-wrap">${esc(v)}</p>`;
  });
  if (s.faq) $('#faqPrev').textContent = String(s.faq).split('\n').filter(Boolean).slice(0, 4).join('\n');
  try {
    const r = (await db.collection('reviews').where('approved', '==', true).get()).docs.map(d => d.data());
    $('#rev').innerHTML = r.length ? r.map(x => { const n = Math.min(5, Math.max(0, +x.rating || 0));
      return `<div class="rv"><div class="stars">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</div><p>${esc(x.comment)}</p><b>${esc(x.name)}</b></div>`; }).join('') : '<p>No reviews yet.</p>';
  } catch (e) {}
})();
firebase.auth().onAuthStateChanged(u => {
  $('#revForm').innerHTML = u ? `<form class="card" onsubmit="sendReview(event)"><h4>Leave a review</h4><input name="name" placeholder="Your name" required>
   <select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>
   <textarea name="comment" placeholder="Your review" required></textarea><button>Submit</button><p class="msg"></p></form>` : '<p><a href="account.html">Login</a> to leave a review.</p>';
});
async function sendReview(e) {
  e.preventDefault(); const f = e.target, v = k => f.elements[k].value.trim();
  if (v('name').length < 2) return fmsg(f, 'Please enter your name', 0);
  if (v('comment').length < 5) return fmsg(f, 'Please write a short review', 0);
  try {
    await db.collection('reviews').add({ name: v('name'), rating: +v('rating'), comment: v('comment'), approved: false, uid: firebase.auth().currentUser.uid, date: new Date().toISOString() });
    f.reset(); fmsg(f, 'Thanks! Your review will show after approval.', 1);
  } catch (er) { fmsg(f, er.message, 0); }
}