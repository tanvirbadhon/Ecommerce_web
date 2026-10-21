# Kiddo Toy Mart

## Active online backend: Supabase Free + Firebase Hosting

The website now uses Supabase for products, public product photos, administrator login and cash-on-delivery orders. `store-backend.json` selects the backend; its publishable key is public configuration, not a privileged credential. Supabase SQL policies enforce administrator permissions and keep customer orders private. Firebase is used only for static Hosting on Spark; the active `firebase.json` contains no Functions or Storage deployment. Cloud Functions code remains archived in `functions/` but is not used or deployed.

The schema and administrator grant were applied by the owner in Supabase SQL Editor. A read-only live check confirmed the public catalog responds and anonymous order reads are denied. The cloud catalog starts empty; previous local listings are still in `.data/products.json`.

For the online product manager, use the Supabase email/password account, not the old local password. Open `/admin`, sign in, and add your own products and photos. Do not paste passwords, secret keys or database credentials into chat. Sessions are stored in browser sessionStorage for that browser session; sign out on shared computers.

Run `npm run supabase:test` for database policy/checkout tests and browser-adapter checks. Run `npm run firebase:build` to prepare the allowlisted static deployment. Firebase Hosting deployment and custom-domain connection remain pending. An account-authenticated sign-in, upload and checkout test still needs to be completed in the browser. Free service quotas and inactivity pausing apply.

## Open the store

Run `npm run dev` from this folder, then open http://127.0.0.1:3000. The page connects to Supabase for online data.
Node.js is the only required runtime; no packages need installing.

## Add or edit online products without code

1. Open http://127.0.0.1:3000/admin.
2. Sign in with the email and password you created in Supabase Authentication.
3. Choose Add product and enter its name, price, category and description.
4. Upload a cover photo and optional gallery images, then Save product.
5. Refresh the storefront to see the product. Uncheck Visible in store to hide it.

Uploads support JPG, PNG and WebP, up to 5 MB per photo and ten gallery images. They are public product photos; never upload private documents. Only the account in `private.store_admins` can edit products, upload photos, or read orders.

The legacy local disk-backed mode remains available by changing `store-backend.json` to `{"mode":"local"}`. That mode uses the `npm run admin-key` password and `.data` files. It is for local development and cannot run on static Hosting.

## Checkout and orders

The bag's Proceed to checkout link and a product's Buy it now button open checkout. Customers enter their name, Bangladesh mobile number, address and city, with optional email, postal code and notes. Payment is cash on delivery. Delivery choices currently follow the supplied reference: Dhaka ৳80, nearby areas ৳110, outside Dhaka ৳150. Shipping amounts are defined in `store-api.js` and `supabase/schema.sql`; update both together before accepting customers.

The Supabase checkout function validates quantities and products and calculates prices itself. A successful order returns an order number and is saved as Pending confirmation. The product manager lists incoming orders and customer delivery details. Order submission does not send an email, SMS or WhatsApp message; check the manager for new orders. Duplicate retries with the same request identifier return the original order.

## Legacy local data and hosting

In local backend mode, products, images and orders persist in `.data/products.json`, `.data/uploads/` and `.data/orders/`. Back up this entire folder, including the administrator key. `catalog.json` seeds a new installation only; everyday edits belong in the product manager. To relocate storage, set `KIDDO_DATA_DIR` to an absolute persistent directory before starting the server.

This server intentionally binds to this computer's loopback interface and rejects other hostnames. It is **not yet publicly deployed**. Firebase Hosting plus Supabase is the active online path; the local filesystem backend remains available for development. Before using www.ktoymart.store for customers, complete the Hosting deployment, HTTPS domain connection, account-authenticated end-to-end checks, backups and order notifications. Do not expose the local development server directly to the internet.

## Store details

- Name: Kiddo Toy Mart
- Future domain shown on the banner: www.ktoymart.store (DNS is not connected)
- Address: Baridhara J block (Purobi Prangan), Notun Bazar, Vatara-1229
- Phone / WhatsApp: +880 1610-288554
- Email: mdshawon545454@gmail.com

Some initial catalog photos and prices were imported from https://toysmartbd.shop/ at the user's request on 2026-10-20. These photos load from that store's CDN. Replace these initial listings with your own inventory, prices, specifications, age guidance and photography in the product manager. The incorrect helmet/video listing has been removed. No fabricated visitor or sales activity is displayed.

## Checks

Run `npm test` for backend authentication, image uploads, product edits, server-authoritative order totals, idempotent submission, validation and persistence checks plus frontend routing checks. Tests use a temporary isolated directory and never add orders to the store's real data.

## Product IDs and Trash
Run `supabase/product-management.sql` in Supabase SQL Editor to add the SKU and recoverable Trash fields to an existing project. Product ID / SKU accepts letters, digits, hyphens and underscores (up to 40 characters), is stored uppercase, and is unique. Leaving it blank assigns KTM plus the stable internal numeric record ID. Internal IDs and old order records are not changed. Delete moves the product to Trash and hides it; Restore makes it visible in the store immediately. Product photos are retained for restoration.

## Color options and product activity
Run `supabase/product-colors.sql` in Supabase SQL Editor before saving colors or ordering color variants. The editor accepts comma-separated color names, and customers select a color before adding to their bag. Each color has its own cart line and is validated against the product when the order is placed. Existing uncolored orders remain intact. Product activity labels are simulated: sales range 2–10 in 24 hours, viewer count 10–50 with ten-second updates. Delivery estimates are 3–5 days for available items and 15–25 days for preorders.

### Order confirmation and current address

The current Firebase Hosting site is https://ktoymart.web.app (admin: /admin). Run `supabase/order-management.sql` once in the Supabase SQL Editor to enable order status updates. In admin, choose Pending confirmation, open an order and click Confirm order. Use the Show filter to find Confirmed, Shipped, Delivered or Cancelled orders. Only store administrators may change status; order totals and customer details are preserved. Product search accepts names, SKU codes and numeric IDs in the storefront and admin.

For permanent deletion, run `supabase/permanent-delete.sql` once in Supabase SQL Editor. Trash entries then support Delete permanently with confirmation. Only administrators may delete trashed products. Existing order snapshots and image files remain preserved.
