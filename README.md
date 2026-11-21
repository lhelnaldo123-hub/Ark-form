# ARK Form Center – Website & Management System

Business website for **ARK Form Center, Hyderabad, Sindh, Pakistan**: product catalogue, packages, offers/coupons, enquiries, customer accounts, ordering and a secure admin panel.

Built with plain **HTML, CSS and JavaScript** and **Firebase** (Authentication + Firestore). No build step, no server.

## Live demo

* **Website:** https://lhelnaldo123-hub.github.io/Ark-form/
* **Customer account:** https://lhelnaldo123-hub.github.io/Ark-form/account.html
* **Admin panel:** https://lhelnaldo123-hub.github.io/Ark-form/admin.html
* **Admin login:** the demo staff email and password are sent to the Supervisor separately (not stored in this repository).

## Files

| File | Purpose |
|---|---|
| `index.html` | Public website (all public pages are sections routed by `#hash`) |
| `register.html` | Customer registration page (linked from the login page) |
| `account.html` | Customer account: profile, My Orders, Track Order, Inbox, Addresses |
| `admin.html` | Admin panel (staff login) |
| `manifest.webmanifest`, `sw.js`, `js/install.js`, `ark-form-center-logo-*.png` | Install-as-app support (see "Install as an app") |
| `css/style.css`, `css/extra.css` | Styles (extra.css holds account/tracking/inbox/admin additions) |
| `js/pwd-eye.js` | Show / hide (eye) button on every password box: customer login and register, admin login, staff creation, change password |
| `js/firebase-config.js` | Firebase project settings |
| `js/app.js` | Shop: products, categories, cart, coupons, enquiry form, routing, back button |
| `js/site-content.js` | Editable home/About/policy text and reviews from the admin |
| `js/fx.js` | Visual effects: floating product band, draggable cart |
| `js/shop-account.js` | Checkout (login required, Delivery/Pickup), notification bell, rating pop-up |
| `js/wishlist.js` | Wishlist hearts on product cards and the product page |
| `js/account.js` | Customer account logic (orders, wishlist, cancel, return, reorder, review, inbox) |
| `js/admin-*.js` | Admin logic (images, manage (edit/hide/delete + sample import), extra = orders/enquiries/reports/staff, orders = messages + returns, tools = charts + new-order alerts + change password) |
| `firestore.rules` | Security rules (publish in Firebase Console; this copy is for documentation) |

**Script order matters.** `index.html` loads: `app.js`, `site-content.js`, `fx.js`, `shop-account.js`, then `wishlist.js` last. `admin.html` loads `admin-orders.js` after `admin-extra.js`, and `admin-tools.js` last.

## Install as an app (PWA)

The site can be installed on a phone or computer like an app. `manifest.webmanifest`, `sw.js`, `js/install.js` and the three logo pictures (`ark-form-center-logo-*.png`, kept in the main folder next to `index.html`) make this work; all are already linked from the pages.

* **Android / Chrome:** open the menu (☰) and tap **📲 Install app**, or use the browser menu > Install app.
* **iPhone / Safari:** tap Share, then **Add to Home Screen**.
* **Computer (Chrome / Edge):** click the install icon in the address bar.
* Needs **https** (GitHub Pages or Firebase Hosting both provide it). Upload `sw.js` and `manifest.webmanifest` in the **same folder as `index.html`**.
* The service worker always loads the newest files when online and only uses its saved copy when offline. Shop data still needs an internet connection. When you change `sw.js`, raise the `CACHE` version number.

## Setup

1. **Firebase project** – open the Firebase Console, then Authentication > Sign-in method > enable **Email/Password**.
2. **Firestore** – create a Firestore database.
3. **Config** – paste your web app config in `js/firebase-config.js`.
4. **Rules** – copy `firestore.rules` into Firestore > Rules and publish. Git does not apply the rules; they only take effect once published in the console. They cover staff roles, customer-only access to their own orders/messages, the limited customer actions (cancel, return request, reviewed), validated enquiries/reviews, and deactivated-customer blocking.
5. **First administrator** – in Authentication add a user (email + password). Then in Firestore create document `staff/<that user's UID>` with fields: `name` (text), `email` (text), `role` = `Administrator`, `active` = `true`. After that, add more staff from Admin > Staff & Roles.
6. **Hosting** – upload the folder to GitHub Pages or Firebase Hosting. Add the site domain under Authentication > Settings > Authorized domains.
7. **Admin first steps** – Settings (delivery fee, tax, payment methods, **return window days**), Site Content (about, FAQs, policies, contact), then add categories, products, packages and offers.

## Who logs in where

* **Customers:** `account.html` is the login page; its "Create an account" link opens the separate `register.html` page (and register.html links back to Login). Both are reached from the 👤 icon and ☰ menu in the shop. Reached from the 👤 icon and ☰ menu in the shop.
* **Staff (Administrator, Manager, Support):** `admin.html`. Reached from **Admin Login** in the shop footer, from the "Shop staff? Admin / Staff login" link on the customer login page, or by typing the address. Staff never register themselves; the Administrator creates their accounts in Staff & Roles. A customer account cannot open the admin panel.
* The admin login page has **Go to site** and **Customer login / Register** buttons. Once logged in, the header link reads **Preview site**.

## Roles

| Role | Access |
|---|---|
| Administrator | everything, including Site Content, Settings, Staff & Roles, Activity Log |
| Manager | products, categories, banners, packages, offers, orders, enquiries, customers, reviews, reports |
| Support | dashboard, orders, enquiries |

The panel hides sections by role; **real enforcement is in `firestore.rules`**.

## Customer order flow

* Guests browse, search, use coupons and send enquiries. **Placing an order needs login**; the cart and typed details are kept while the customer logs in, then they return to the cart.
* Checkout offers **Delivery** or **Pickup** (no delivery fee for pickup). Payment: cash on delivery / pay at pickup.
* Order statuses: Pending → Confirmed → Processing → Ready / Dispatched → Completed, or Cancelled.
* Every status change by staff sends a message to the customer's **Inbox** (bell icon).
* **Cancel:** the customer can cancel with a reason while the order is Pending or Confirmed. Staff can cancel at any time with a reason. The record is always kept.
* **Return:** after Completed, the customer can request a return within the **return window** (Admin > Settings, default 7 days). Staff approve or reject in the order dialog; the customer is told in the Inbox. Staff record refunds by setting Payment status to Refunded.
* **Reorder:** adds the items of a past order to the cart at today's prices (unavailable items are skipped and listed).
* **Wishlist:** logged-in customers tap the heart on any product (card or product page) to save it. Saved items are listed under My Account > Wishlist with View / Add to cart / Remove. Stored in the customer's own record (`customers/<uid>.wishlist`). Admin > Reports shows the most wishlisted products.
* **Reviews:** after delivery the customer rates each item; reviews show on the site only after admin approval.

## Navigation and account behaviour

* **Back buttons:** every shop page except Home has a "← Back" button (returns to the previous page; if the site was opened directly on that page it goes up one level). The account page has "← Back" in its header. The admin panel has "← Back" that returns to the previous section.
* **My Account / My Orders while logged out:** the page shows "Loading..." until the login state is known (no login-form flash for logged-in users). Logged-out visitors who open My Orders, Track Order, Inbox or Wishlist see a message asking them to log in, then the login and register forms.
* **Staff accounts are not customers:** the admin panel and the shop share one login in the same browser. If a staff / admin account opens My Account it sees a "logged in as staff" screen (link to the admin panel, log out) instead of customer orders, and it cannot place orders at checkout. The shop treats a staff login as a **preview**: a blue "Admin preview - Back to admin" bar shows, the drawer shows "Staff preview" instead of the staff email, checkout is not filled with the staff email and the wishlist is off. Admin's "Preview site" link opens this view. Test ordering with a separate customer account. Orders placed earlier by a staff account remain in Firestore and can be deleted from Admin > Orders.

## Admin panel (15 sections)

* **Dashboard:** summary cards, quick actions, and orders and enquiries charts for a chosen period (7/14/30/90 days or a custom date range; long periods show one bar per week).
* **New order / enquiry alerts:** while the admin panel is open, a banner appears when a new order or enquiry arrives (optional sound, browser tab shows a count). There is no alert when the panel is closed.
* **Account security:** every staff member can change their own password (🔑 Password in the panel header) or email themselves a reset link. Staff accounts are created and deactivated by the Administrator; actions are recorded in the Activity Log.


Dashboard, Products, Categories, Banners, Packages, Offers/Coupons, Orders, Enquiries, Customers, Reviews, Site Content, Settings, Reports (orders CSV + print/PDF), Staff & Roles, Activity Log.

## Placeholders – to be supplied by ARK Form Center

The brief says not to invent business details. These are editable placeholders until supplied: shop address, phone/WhatsApp, email, opening hours, map link, social links, About text, FAQs, Privacy Policy, Terms & Conditions, Return/Exchange Policy, final products, images and prices. The 8 sample products (defined in `js/app.js`) appear only while the shop has no products of its own. In Admin > Products, click **Import sample products so I can edit them** to copy them into the database; imported samples get simple placeholder pictures (a button adds them to samples that have none); replace them with real photos via Edit. After import they can be edited or deleted like any product.

## Unfinished / not included (for the Supervisor)

* No online payment gateway (cash on delivery / pay at pickup only).
* No email, SMS or WhatsApp sending (no service credentials supplied); customers are notified through the in-site Inbox and staff through the on-screen alerts above.
* Data backups are not automated by this code. Use Firebase Console > Firestore > Disaster recovery / scheduled backups (may require a billing plan) or export the data regularly.
* Product photos are compressed and stored inside each product record (about 850 KB per product). This suits a small catalogue; for a large catalogue move images to Firebase Storage.
* The contact page shows a map **link**, not an embedded map, until the exact shop location is confirmed.
* Reports cover orders, products, coupons, customers and enquiries; CSV export is for orders only.
* Return handling is for the whole order, not single items; the return window is one shop-wide setting.
* Form validation is done in the browser, and Firestore rules protect who may change what. Full server-side field validation would need Cloud Functions.
* "Reset Password" is Firebase's emailed link rather than a separate page in the site. The email comes from a Firebase "noreply" address and often lands in **Spam / Promotions**. It is only sent to an email that is registered. Firebase's **Email enumeration protection** (Console > Authentication > Settings > User actions) hides whether an email exists; while it is ON the site cannot tell a customer "you have not registered", so the message says "if this email is registered...". Turn it OFF if you want the exact "No account found, register now" message. Also check that the site domain is listed under Authentication > Settings > Authorized domains.

## Assumptions to confirm with the Supervisor

* Firebase (Authentication + Firestore) is used as the backend instead of a custom API server.
* The sample products and packages shown while the shop has no products are placeholders only. Replace them with real catalogue data before launch.
* All business details (address, phone, email, hours, policies, prices) are placeholders until ARK Form Center supplies them.

## Not yet verified

All JavaScript files pass a syntax check, but the site was **not run against the live Firebase project** while preparing this handover. Before launch, test: back buttons on all pages, My Orders when logged out and logged in, the staff-account screen, Import sample products, admin alerts (place an order while the panel is open), dashboard period picker, change password, wishlist (heart, saved list, add to cart, remove), register, login, forgot password, checkout (Delivery and Pickup), cancel, return approval, reorder, review approval, each admin role, and the published Firestore rules (for example: a customer cannot read another customer's order, cannot change an order's status except to cancel before processing, and a Support user cannot open Settings).
