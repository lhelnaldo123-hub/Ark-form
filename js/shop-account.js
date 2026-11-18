// ARK Form Center - login gate for checkout + drawer login/logout (Part 1)
// Load this LAST in index.html (after app.js, site-content.js and fx.js).
(function () {
  const auth = firebase.auth();

  // 1) Checkout needs a login. The cart stays saved, so after login the customer comes straight back to it.
  const originalCheckout = checkout;
  checkout = function (e) {
    if (!auth.currentUser) {
      e.preventDefault();
      const f = e.target;
      try { sessionStorage.setItem('coDraft', JSON.stringify(Object.fromEntries(new FormData(f)))); } catch (x) {}
      fmsg(f, 'Please log in or create an account to place your order. Taking you there...', 0);
      setTimeout(() => { location.href = 'account.html?next=cart'; }, 900);
      return;
    }
    return originalCheckout(e);
  };

  // 2) Bring back what the customer already typed in the checkout form before they went to log in
  try {
    const d = JSON.parse(sessionStorage.getItem('coDraft') || 'null');
    if (d) {
      const f = document.getElementById('coForm').elements;
      ['name', 'phone', 'email', 'address', 'notes'].forEach(k => { if (d[k] && f[k]) f[k].value = d[k]; });
      sessionStorage.removeItem('coDraft');
    }
  } catch (x) {}

  // 3) Confirmation page: send the customer to their orders page
  const originalConfirm = drawConfirm;
  drawConfirm = function (no) {
    originalConfirm(no);
    document.querySelectorAll('#confBox a[href="account.html"]').forEach(a => { a.href = 'account.html#orders'; a.textContent = 'Track my order'; });
  };

  // 4) Login state: checkout note + button text + drawer Login / Logout
  auth.onAuthStateChanged(u => {
    const f = document.getElementById('coForm'), b = f.querySelector('button'), n = document.getElementById('loginNote');
    if (b) b.textContent = u ? 'Place Order' : 'Log in to place order';
    if (n) n.style.display = u ? 'none' : '';
    const box = document.getElementById('dAuth');
    if (!box) return;
    box.innerHTML = u
      ? `<b>👋 ${esc(u.displayName || u.email)}</b><a class="btn sm" href="account.html">My profile</a><a class="btn dk sm" href="account.html#orders">My orders</a><br><br><button class="btn-out sm" onclick="drawerLogout()">Log out</button>`
      : `<b>Welcome!</b><a class="btn sm" href="account.html">Login / Register</a>`;
  });
  window.drawerLogout = function () {
    auth.signOut().then(() => { closeMenu(); toast('You are logged out'); });
  };
})();
