const esc = t => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
(async () => {
  let s = {};
  try { s = (await db.collection('settings').doc('site').get()).data() || {}; } catch (e) {}
  if (s.about) $('#aboutText').textContent = s.about;
  const c = [s.address, s.phone, s.email, s.hours].filter(Boolean);
  if (c.length) { $('#contactInfo').textContent = c.join(' · '); $('#fContact').textContent = c.join(' · '); }
  const pol = [['FAQs', s.faq], ['Privacy Policy', s.privacy], ['Terms & Conditions', s.terms], ['Return / Exchange Policy', s.returns]].filter(x => x[1]);
  if (pol.length) $('#faqBox').innerHTML = pol.map(x => `<h4>${x[0]}</h4><p style="white-space:pre-wrap">${esc(x[1])}</p>`).join('');
  try {
    const r = (await db.collection('reviews').where('approved', '==', true).get()).docs.map(d => d.data());
    $('#rev').innerHTML = r.length ? r.map(x => `<div class="card"><div>${'★'.repeat(x.rating)}${'☆'.repeat(5 - x.rating)}</div><p>${esc(x.comment)}</p><b>${esc(x.name)}</b></div>`).join('') : '<p>No reviews yet.</p>';
  } catch (e) {}
})();
firebase.auth().onAuthStateChanged(u => {
  $('#revForm').innerHTML = u ? `<form class="card" onsubmit="sendReview(event)"><h4>Leave a review</h4><input name="name" placeholder="Your name" required>
   <select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>
   <textarea name="comment" placeholder="Your review" required></textarea><button>Submit</button></form>` : '<p><a href="account.html">Login</a> to leave a review.</p>';
});
async function sendReview(e) {
  e.preventDefault(); const f = e.target;
  try {
    await db.collection('reviews').add({ name: f.name.value, rating: +f.rating.value, comment: f.comment.value, approved: false, uid: firebase.auth().currentUser.uid, date: new Date().toISOString() });
    f.reset(); alert('Thanks! Your review will show after approval.');
  } catch (er) { alert(er.message); }
}
