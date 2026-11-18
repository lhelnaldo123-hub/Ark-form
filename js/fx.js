/* ARK Form Center - visual effects (new file: js/fx.js)
   1) sample products with real photos (only until the admin adds real products)
   2) floating product band (each card opens that product)
   3) draggable, floating cart with fly-to-cart animation
   4) broken photos fall back to a neat placeholder */
(function () {
  'use strict';
  var U = function (id) { return 'https://images.unsplash.com/photo-' + id + '?auto=format&fit=crop&w=800&q=70'; };

  /* 1. Sample catalogue shown only while the shop has no products of its own */
  try {
    if (typeof DEMO !== 'undefined') {
      var S = [
        ['Aviator Sunglasses', 'Featured', 1800, 0, '1572635196237-14b3f281503f'],
        ['Everyday Backpack', 'Featured', 3500, 0, '1553062407-98eeb64c6a62'],
        ['Wireless Headphones', 'Featured', 5900, 4900, '1505740420928-5e560c06d30e'],
        ['Runner Sneakers', 'Popular', 7500, 0, '1542291026-7eec264c27ff'],
        ['Classic Wrist Watch', 'Popular', 9900, 8500, '1523275335684-37898b6baf30'],
        ['Smart Phone', 'New Arrivals', 24900, 0, '1511707171634-5f897ff02aa9'],
        ['Pro Camera', 'New Arrivals', 18500, 0, '1526170375885-4d8ecf77b99f'],
        ['Casual Shoes', 'Bundles', 6500, 0, '1491553895911-0055eca6402d']
      ];
      DEMO.products.forEach(function (p, i) {
        var s = S[i]; if (!s) return;
        p.name = s[0]; p.category = s[1]; p.price = s[2]; if (s[3]) p.salePrice = s[3];
        p.image = U(s[4]); p.description = 'Sample item - the admin can replace it with a real product.';
      });
      var K = DEMO.packages;
      if (K[0]) { K[0].items = 'Aviator Sunglasses + Everyday Backpack'; K[0].normal = 5300; K[0].price = 4600; }
      if (K[1]) { K[1].items = 'Wireless Headphones + Runner Sneakers + Classic Wrist Watch'; K[1].normal = 23300; K[1].price = 20500; }
      if (K[2]) { K[2].items = 'Smart Phone + Pro Camera + Casual Shoes'; K[2].normal = 49900; K[2].price = 44900; }
    }
  } catch (e) {}

  /* 4. Broken photo -> tidy placeholder instead of a broken icon */
  addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG' || t.dataset.fx) return;
    t.dataset.fx = '1';
    var d = document.createElement('div');
    d.className = 'ph';
    d.style.background = 'linear-gradient(135deg,#13294b,#2b5c8a)';
    d.textContent = (t.alt || '?').charAt(0).toUpperCase();
    t.replaceWith(d);
  }, true);

  /* 2. Floating product band */
  function band() {
    var host = document.getElementById('floatband');
    if (!host || typeof PRODUCTS === 'undefined') return;
    var list = PRODUCTS.filter(function (p) { return p.stock !== false; });
    if (!list.length) list = PRODUCTS.slice();
    list.sort(function (a, b) { return (images(b).length ? 1 : 0) - (images(a).length ? 1 : 0); });
    list = list.slice(0, 14);
    if (!list.length) { host.style.display = 'none'; return; }
    var set = list.slice();
    while (set.length < 8) set = set.concat(list);
    var card = function (p, i, hid) {
      var im = images(p)[0];
      var pic = im ? '<img src="' + esc(im) + '" alt="' + esc(p.name) + '" draggable="false">' : ph(p);
      return '<a class="fp" style="--i:' + i + '" href="#view/' + esc(p.id) + '"' + (hid ? ' tabindex="-1" aria-hidden="true"' : '') + '>' +
        '<span class="fi">' + pic + (pct(p) ? '<em class="off">-' + pct(p) + '%</em>' : '') + '</span>' +
        '<b class="fn">' + esc(p.name) + '</b>' +
        '<span class="fpr">' + (eff(p) ? money(eff(p)) : 'Enquire for price') + '</span>' +
        '<i class="fgo">View product &rarr;</i></a>';
    };
    var html = set.map(function (p, i) { return card(p, i, false); }).join('') +
               set.map(function (p, i) { return card(p, i, true); }).join('');
    host.querySelector('.ftrack').innerHTML = html;
    host.querySelector('.ftrack').style.setProperty('--dur', Math.max(24, set.length * 4.5) + 's');
    var v = host.querySelector('.fview'), t;
    v.addEventListener('touchstart', function () { clearTimeout(t); v.classList.add('hold'); }, { passive: true });
    var rel = function () { t = setTimeout(function () { v.classList.remove('hold'); }, 1400); };
    v.addEventListener('touchend', rel, { passive: true });
    v.addEventListener('touchcancel', rel, { passive: true });
  }
  (function wait(n) {
    if (typeof READY !== 'undefined' && READY) return band();
    if (n < 100) setTimeout(function () { wait(n + 1); }, 150);
  })(0);

  /* 3. Draggable floating cart */
  (function () {
    var c = document.getElementById('fcart'); if (!c) return;
    var KEY = 'arkCartPos', sx, sy, ox, oy, id = null, moved = false, last = { x: 0, y: 0, t: 0 };
    var size = function () { return c.offsetWidth || 58; };
    var clamp = function (x, y) {
      return [Math.min(Math.max(8, x), innerWidth - size() - 8), Math.min(Math.max(72, y), innerHeight - size() - 8)];
    };
    var place = function (x, y) {
      c.style.left = x + 'px'; c.style.top = y + 'px'; c.style.right = 'auto'; c.style.bottom = 'auto';
    };
    var restore = function () {
      try {
        var s = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (s) { var p = clamp(s.x * innerWidth, s.y * innerHeight); place(p[0], p[1]); }
      } catch (e) {}
    };
    restore(); addEventListener('resize', restore);
    c.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      id = e.pointerId; var r = c.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; moved = false;
      try { c.setPointerCapture(id); } catch (x) {}
    });
    c.addEventListener('pointermove', function (e) {
      if (id === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 7) return;
      moved = true; c.classList.add('drag'); c.classList.remove('snap');
      var p = clamp(ox + dx, oy + dy); place(p[0], p[1]);
    });
    var end = function () {
      if (id === null) return;
      id = null; c.classList.remove('drag');
      if (!moved) return;
      var r = c.getBoundingClientRect(), x = r.left + size() / 2 < innerWidth / 2 ? 10 : innerWidth - size() - 10;
      var p = clamp(x, r.top); c.classList.add('snap'); place(p[0], p[1]);
      try { localStorage.setItem(KEY, JSON.stringify({ x: p[0] / innerWidth, y: p[1] / innerHeight })); } catch (e) {}
    };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    c.addEventListener('click', function (e) { if (moved) { e.preventDefault(); moved = false; } }, true);

    /* fly-to-cart when the count goes up */
    document.addEventListener('pointerdown', function (e) { last = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);
    var n = document.getElementById('cartn2'), prev = parseInt(n && n.textContent, 10) || 0;
    if (n && window.MutationObserver) {
      new MutationObserver(function () {
        var now = parseInt(n.textContent, 10) || 0;
        if (now > prev && Date.now() - last.t < 1500 && c.offsetParent !== null && c.animate) {
          var r = c.getBoundingClientRect(), d = document.createElement('div');
          d.className = 'fly'; d.textContent = '\uD83D\uDECD\uFE0F'; document.body.appendChild(d);
          var x1 = r.left + r.width / 2 - 17, y1 = r.top + r.height / 2 - 17;
          d.animate([
            { transform: 'translate(' + (last.x - 17) + 'px,' + (last.y - 17) + 'px) scale(1.2)', opacity: 1 },
            { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(.35)', opacity: .35 }
          ], { duration: 650, easing: 'cubic-bezier(.45,-.25,.7,1)' }).onfinish = function () { d.remove(); };
        }
        prev = now;
      }).observe(n, { childList: true, characterData: true, subtree: true });
    }
  })();
})();