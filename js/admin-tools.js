// ARK Admin - dashboard charts with a period picker, new order / enquiry alerts, change-my-password.
// Load LAST in admin.html (after admin-orders.js).
(function () {
  // ================= 1. Dashboard charts (orders + enquiries) =================
  const P = { mode: '7', from: '', to: '' };
  const iso = d => d.toISOString().slice(0, 10);
  function range() {
    if (P.mode === 'custom' && P.from && P.to && P.from <= P.to) return [P.from, P.to];
    const n = +P.mode || 7, to = new Date(), from = new Date(); from.setDate(to.getDate() - (n - 1));
    return [iso(from), iso(to)];
  }
  function buckets(f, t) {                       // one bar per day, or per week when the period is long
    const days = [], d = new Date(f + 'T00:00:00Z'), end = new Date(t + 'T00:00:00Z');
    while (d <= end && days.length < 400) { days.push(iso(d)); d.setUTCDate(d.getUTCDate() + 1); }
    const step = days.length > 31 ? 7 : 1, out = [];
    for (let i = 0; i < days.length; i += step) out.push({ a: days[i], b: days[Math.min(i + step - 1, days.length - 1)] });
    return out;
  }
  function chart(list, bk) {
    const n = bk.map(k => list.filter(o => { const x = fdate(o.date); return x >= k.a && x <= k.b; }).length), mx = Math.max(1, ...n);
    const every = Math.max(1, Math.ceil(bk.length / 8));
    return '<div class="bars">' + n.map(v => `<div style="height:${v / mx * 100}%">${v && bk.length <= 31 ? `<span>${v}</span>` : ''}</div>`).join('') + '</div>' +
      '<div class="bars" style="height:auto;padding:4px 0 0">' + bk.map((k, i) => `<small style="flex:1;text-align:center;font-size:10px">${i % every === 0 ? k.a.slice(5) : ''}</small>`).join('') + '</div>';
  }
  function drawDash() {
    const box = $('#chart'); if (!box) return;
    const h = box.previousElementSibling; if (h && h.tagName === 'H4') h.textContent = 'Orders and enquiries';
    if (!$('#dpSel')) {
      box.insertAdjacentHTML('beforebegin', `<div class="fl noprint"><div><label class="tag">Period</label><select id="dpSel"><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom range</option></select></div><div id="dpCus" style="display:none"><label class="tag">From</label><input id="dpF" type="date"></div><div id="dpCus2" style="display:none"><label class="tag">To</label><input id="dpT" type="date"></div></div>`);
      const upd = () => { P.mode = $('#dpSel').value; P.from = $('#dpF').value; P.to = $('#dpT').value; $('#dpCus').style.display = $('#dpCus2').style.display = P.mode === 'custom' ? '' : 'none'; drawDash(); };
      ['#dpSel', '#dpF', '#dpT'].forEach(s => $(s).addEventListener('change', upd));
    }
    const [f, t] = range(), bk = buckets(f, t), inR = o => { const x = fdate(o.date); return x >= f && x <= t; };
    let h2 = `<p class="tag">${f} to ${t}${bk.length && bk[0].a !== bk[0].b ? ' · one bar = one week' : ''}</p>`;
    if (can('orders')) { const o = (DATA.orders || []).filter(inR), v = o.filter(x => x.status !== 'Cancelled').reduce((s, x) => s + (+x.total || 0), 0); h2 += `<b>Orders: ${o.length}</b> <span class="tag">(value excluding cancelled: ${money(v)})</span>${chart(o, bk)}`; }
    if (can('enquiries')) { const q = (DATA.enquiries || []).filter(inR); h2 += `<b style="display:block;margin-top:14px">Enquiries: ${q.length}</b>${chart(q, bk)}`; }
    box.innerHTML = h2;
  }

  // ================= 2. Alerts for new orders / enquiries (while the panel is open) =================
  let subs = [], started = false, unseen = 0, sound = localStorage.getItem('adm_sound') === '1';
  const seen = new Set(), baseTitle = document.title;
  function beep() {
    if (!sound) return;
    try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = .12; o.start(); setTimeout(() => { o.stop(); c.close(); }, 260); } catch (e) {}
  }
  function banner() {
    let b = $('#alerts'); if (b) return b;
    document.body.insertAdjacentHTML('beforeend', '<style>#alerts{position:fixed;top:10px;right:10px;left:10px;max-width:380px;margin-left:auto;z-index:99;display:grid;gap:8px}#alerts .al{background:#fff;border-left:6px solid var(--gold);border-radius:12px;box-shadow:0 8px 24px #0004;padding:10px 12px;font-size:14px}#alerts .al button{margin:6px 6px 0 0}</style><div id="alerts"></div>');
    return $('#alerts');
  }
  function notify(kind, x) {
    if (seen.has(x.id)) return; seen.add(x.id);
    const box = banner(), el = document.createElement('div'); el.className = 'al';
    el.innerHTML = kind === 'order'
      ? `🛒 <b>New order ${esc(x.orderNo)}</b><br>${esc(x.name)} · ${money(x.total)}<br><button class="sm" data-o>Open</button><button class="sm dk" data-x>Dismiss</button>`
      : `✉️ <b>New enquiry</b><br>${esc(x.name)} · ${esc(x.type || '')}<br><button class="sm" data-o>Open</button><button class="sm dk" data-x>Dismiss</button>`;
    el.querySelector('[data-x]').onclick = () => el.remove();
    el.querySelector('[data-o]').onclick = async () => { el.remove(); await refresh(); if (kind === 'order') { go('orders'); openOrder(x.id); } else { go('enquiries'); openEnq(x.id); } };
    box.prepend(el); while (box.children.length > 4) box.lastChild.remove();
    unseen++; document.title = '(' + unseen + ') ' + baseTitle; beep();
    refresh();
  }
  function startAlerts() {
    if (started || !ME) return; started = true;
    const t0 = new Date().toISOString(), watch = (c, kind) => subs.push(db.collection(c).where('date', '>', t0).onSnapshot(s => s.docChanges().forEach(ch => { if (ch.type === 'added') notify(kind, { id: ch.doc.id, ...ch.doc.data() }); }), () => {}));
    if (can('orders')) watch('orders', 'order');
    if (can('enquiries')) watch('enquiries', 'enquiry');
  }
  addEventListener('focus', () => { unseen = 0; document.title = baseTitle; });
  auth.onAuthStateChanged(u => { if (!u) { subs.forEach(f => f()); subs = []; started = false; seen.clear(); unseen = 0; document.title = baseTitle; const a = $('#alerts'); if (a) a.innerHTML = ''; } });

  // ================= 3. Change my password =================
  const errText = e => ({ 'auth/wrong-password': 'Current password is incorrect', 'auth/invalid-credential': 'Current password is incorrect', 'auth/weak-password': 'New password is too weak', 'auth/requires-recent-login': 'Please log out, log in again and retry', 'auth/too-many-requests': 'Too many attempts. Try again later' }[e.code] || e.message);
  const pm = (t, ok) => { const m = $('#pwm'); m.style.color = ok ? '#1b7f3b' : '#b00020'; m.textContent = t; };
  window.pwDialog = function () {
    showDlg(`<h3 style="margin-top:0">Change my password</h3><input id="pwo" type="password" placeholder="Current password" autocomplete="current-password"><input id="pwn" type="password" placeholder="New password (min 8 characters)" autocomplete="new-password"><input id="pwc" type="password" placeholder="Repeat new password" autocomplete="new-password">
      <button onclick="changePw()">Change password</button> <button type="button" class="sm dk" onclick="mailPw()">Email me a reset link instead</button><p id="pwm"></p>${closeBtn}`);
  };
  window.changePw = async function () {
    const o = $('#pwo').value, n = $('#pwn').value, c = $('#pwc').value, u = auth.currentUser;
    if (!o) return pm('Type your current password', 0);
    if (n.length < 8) return pm('New password must be at least 8 characters', 0);
    if (n !== c) return pm('The two new passwords do not match', 0);
    if (n === o) return pm('Choose a password different from the current one', 0);
    try {
      await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, o));
      await u.updatePassword(n); logAct('Changed own password', '');
      pm('Password changed ✔', 1); $('#pwo').value = $('#pwn').value = $('#pwc').value = '';
    } catch (e) { pm(errText(e), 0); }
  };
  window.mailPw = async function () { try { await auth.sendPasswordResetEmail(auth.currentUser.email); pm('Reset link sent to ' + auth.currentUser.email, 1); } catch (e) { pm(errText(e), 0); } };

  // ================= header buttons + hook into the normal refresh =================
  function headerBtns() {
    if ($('#pwBtn')) return;
    const lo = document.querySelector('#who'); if (!lo || !lo.parentElement) return;
    lo.parentElement.insertAdjacentHTML('beforeend', ' <button class="sm dk" id="sndBtn" type="button"></button> <button class="sm dk" id="pwBtn" type="button" onclick="pwDialog()">🔑 Password</button>');
    const paint = () => { $('#sndBtn').textContent = sound ? '🔔 Alert sound on' : '🔕 Alert sound off'; };
    $('#sndBtn').onclick = () => { sound = !sound; localStorage.setItem('adm_sound', sound ? '1' : '0'); paint(); beep(); };
    paint();
  }
  RENDERS.push(function () { headerBtns(); startAlerts(); drawDash(); });
})();
