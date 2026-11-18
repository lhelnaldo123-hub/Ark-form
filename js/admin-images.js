// Photo picker for admin forms: choose photos from the phone, they are shrunk and stored with the item
const IMG_TOTAL_MAX = 850000; // keeps one item safely under Firestore's 1 MB limit
const splitImgs2 = s => String(s || '').split('\n').flatMap(x => { x = x.trim(); return x.startsWith('data:') ? [x] : x.split(','); }).map(x => x.trim()).filter(Boolean);
function shrinkImg(file, max) {
  return new Promise((ok, bad) => {
    const r = new FileReader();
    r.onerror = () => bad(new Error('Could not read the photo'));
    r.onload = () => {
      const im = new Image();
      im.onerror = () => bad(new Error('This file is not a photo'));
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', .72));
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
function buildImg(w, val) {
  const n = w.dataset.name, multi = w.dataset.multi === '1', max = +w.dataset.max || 800;
  w.innerHTML = `<label class="tag">${esc(w.dataset.label || 'Photo')}</label><input type="hidden" name="${esc(n)}"><div class="ith"></div>
   <div class="irow"><label class="btn sm">📷 ${multi ? 'Add photos' : 'Choose photo'}<input type="file" accept="image/*" ${multi ? 'multiple' : ''} hidden></label>
   <input class="iurl" placeholder="or paste an image link"></div><p class="msg"></p>`;
  const h = w.querySelector('input[type=hidden]'), th = w.querySelector('.ith'), msg = w.querySelector('.msg');
  h.value = Array.isArray(val) ? val.join('\n') : String(val || '');
  const list = () => splitImgs2(h.value);
  const draw = () => { const L = list(); th.innerHTML = L.map((u, i) => `<span><img src="${esc(u)}" alt=""><b data-i="${i}">×</b>${multi && L.length > 1 ? `<div class="mv">${i > 0 ? `<button type="button" data-mv="${i}" data-d="-1" aria-label="Move earlier">◀</button>` : '<i></i>'}${i < L.length - 1 ? `<button type="button" data-mv="${i}" data-d="1" aria-label="Move later">▶</button>` : '<i></i>'}</div>` : ''}</span>`).join(''); };
  const set = a => {
    const v = a.join('\n');
    if (v.length > IMG_TOTAL_MAX) { msg.className = 'msg err'; msg.textContent = 'Too many or too large photos for one item. Remove one first.'; return false; }
    h.value = v; msg.textContent = ''; draw(); return true;
  };
  th.onclick = e => {
    const m = e.target.closest('button[data-mv]');
    if (m) { const a = list(), i = +m.dataset.mv, j = i + +m.dataset.d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set(a); return; }
    const b = e.target.closest('b'); if (!b) return; const a = list(); a.splice(+b.dataset.i, 1); set(a);
  };
  w.querySelector('input[type=file]').onchange = async e => {
    const fs = [...e.target.files]; e.target.value = ''; if (!fs.length) return;
    msg.className = 'msg'; msg.textContent = 'Preparing photo...';
    try { const add = []; for (const f of fs) add.push(await shrinkImg(f, max)); set(multi ? [...list(), ...add] : [add[0]]); }
    catch (er) { msg.className = 'msg err'; msg.textContent = er.message; }
  };
  const u = w.querySelector('.iurl');
  u.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); u.blur(); } };
  u.onchange = () => { const v = u.value.trim(); if (!/^https?:\/\//i.test(v)) return; u.value = ''; set(multi ? [...list(), v] : [v]); };
  draw();
}
function initImgs(root) { (root || document).querySelectorAll('.imgw').forEach(w => buildImg(w, '')); }
initImgs();
// small style for the move-left / move-right buttons (image ordering)
(function () { const s = document.createElement('style'); s.textContent = '.ith .mv{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between}.ith .mv button{padding:0 7px;height:22px;font-size:11px;line-height:1;border-radius:0 0 0 10px;background:#000a;color:#fff}.ith .mv button:last-child{border-radius:0 0 10px 0}'; document.head.appendChild(s); })();
