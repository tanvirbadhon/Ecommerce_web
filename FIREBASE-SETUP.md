# Firebase setup for Kiddo Toy Mart

The Firebase adapter is prepared locally. No Firebase project, billing account, cloud resources, administrator permissions, or live deployment have been created by these files.

## First: create your project

1. Open https://console.firebase.google.com/ and sign in with your own Google account.
2. Choose **Create a project**, and name it **Kiddo Toy Mart**. Analytics is optional; this store does not require it.
3. Copy the **Project ID** from Project settings > General. Send that ID in the chat. Do not send passwords, service-account JSON files, or private keys.

No paid shared-hosting package is needed for this architecture. Firebase Storage and Cloud Functions require Blaze billing, with separate usage charges and allowances. Enable billing only when you are ready to approve that setup. Billing alerts notify you of spending; they are not a guaranteed spending cap. The function configuration keeps zero warm instances and caps instances at two, which does not eliminate charges.

## Services to configure after the Project ID is confirmed

- **Authentication:** enable Email/Password, then create your administrator user with a password you choose yourself. No public sign-up interface is included. An account must also have the `admin` custom claim; ordinary signed-in accounts are denied store management.
- **Firestore:** create the default database in production mode. Choose a location deliberately because it cannot simply be changed later. The prepared backend region is `asia-south1`; review the region together with database/storage location before deployment.
- **Storage:** initialize your bucket and copy its exact name from the console. Do not guess `.appspot.com` versus `.firebasestorage.app`.
- **Web app:** register a web app in Project settings and copy its public Web API key. The backend uses Firebase Authentication’s official sign-in endpoint. Never put an administrator password or service-account key into the site source.

Create `functions/.env.PROJECT_ID` from `functions/.env.example` with the Web API key and exact bucket name. The default allowed origins are the project's `.web.app` and `.firebaseapp.com` domains. Add `https://ktoymart.store,https://www.ktoymart.store` to `STORE_EXTRA_ORIGINS` only when connecting your domain. Do not add wildcard origins.

## Prepared implementation

- `firebase.json`: a small allowlisted Hosting build and `/api/**` rewrites to the Node.js 22 `storeApi` function.
- `functions/handler.js`: Firestore products, atomic order creation, server-calculated prices, idempotency, administrator authorization, and bounded image uploads to Storage.
- `functions/index.js`: Firebase SDK initialization, region and resource limits.
- `firestore.rules` and `storage.rules`: deny direct browser access. Validated server APIs use the Admin SDK; product images are served through individual download-token URLs. Those photo URLs are public catalog assets; never use that upload route for private documents.
- Admin sessions use Firebase's `__session` cookie, marked HttpOnly, Secure, and SameSite=Strict. All mutations check an explicit origin allowlist. Revoking the administrator claim blocks subsequent management requests.
- Request rate limits are shared through Firestore transactions, rather than held in one server instance's memory. Enable a Firestore TTL policy on `requestLimits.expiresAt` to remove old limiter documents. TTL deletions can incur charges.
- The local Node store and its current password-based login continue to work with `npm run dev`.

## Install and verify

```powershell
npm install --prefix functions --ignore-scripts
npm run firebase:build
npm run firebase:test
npm test
```

Cloud integration needs additional checks against the actual Firebase project (or emulators) after it exists. Local unit checks do not prove deployed permissions, bucket configuration, cookies, region availability, or end-to-end cloud checkout.

## Administrator access and product migration

These commands change cloud data or permissions. Run them only after confirming the target project, intended administrator UID, and migration scope. Authenticate the Admin SDK locally through Application Default Credentials or an approved credential file outside this repository. Never paste a key into chat.

```powershell
node functions/tools/manage.cjs grant-admin --project PROJECT_ID --uid ADMIN_USER_UID
node functions/tools/manage.cjs import-products --project PROJECT_ID --bucket EXACT_BUCKET_NAME --source "C:\Users\Badhon\Desktop\ecommerce\.data\products.json"
```

The import copies local product photos to Storage and creates missing product records. Existing cloud products are skipped. It does not migrate orders or customer information. Local files and the existing store remain intact. Review imported photos and prices before launch.

## Deployment — after review and approval

Use an official Firebase CLI installation, sign in yourself, and confirm the chosen project. No CLI login or deployment has been performed automatically.

```powershell
firebase deploy --project PROJECT_ID --only firestore:rules,storage,functions,hosting
```

This publishes the website and backend. Before directing customers there, verify a non-admin cannot access orders, an administrator can save and upload a product, a COD order receives a number and appears once, and no private local files were published. Connect the custom domain through Firebase Hosting only after those checks. Configure order notifications separately; order creation currently saves the order but does not send an email/SMS.

Official references:
- https://firebase.google.com/docs/hosting/full-config
- https://firebase.google.com/docs/hosting/manage-cache
- https://firebase.google.com/docs/auth/admin/manage-cookies
- https://firebase.google.com/docs/auth/admin/custom-claims
- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
