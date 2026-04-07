# Goal: Native Cloudflare Authentication Migration

The goal is to formally drop the dependency on Supabase Auth and Google SSO, migrating the application to a 100% self-contained Custom Email & Password Authentication system entirely hosted on Cloudflare Workers and D1. This eliminates third-party platform limitations, solves domain-redirect complexities, and makes the auth system completely free forever.

## Core Strategy
1. **D1 Database Expansion**: We will add `password_hash` to the existing `users` table to securely store passwords using Web Crypto API (`SHA-256` or equivalent edge-compatible hashing with salts).
2. **Native JWT Generation**: Using Hono's `hono/jwt` library, our backend will generate its own secure authorization tokens natively on the Edge, utilizing the existing `SUPABASE_JWT_SECRET` (which will simply be renamed in our minds to `JWT_SECRET`).
3. **Frontend UI Transformation**: We will replace the Google Sign-in button with a sleek Login/Register panel on the Landing Page.
4. **Admin-Driven Password Reset**: Since we are dropping external dependencies, sending automated "Reset Password" emails requires a 3rd-party SMTP provider like SendGrid. To keep the system 100% free with zero configuration, we will implement an "Admin Password Reset" feature where Institutional Admins can generate temporary passwords for users who forget theirs.

## User Review Required

> [!WARNING]
> By approving this plan, you will sever the final tie to Supabase. Your entire database, file storage, and authentication will live exclusively on Cloudflare. This is a very clean architecture, but it confirms the end of Google SSO. 

## Proposed Changes

---

### Database Schema Updates
We need to track native passwords in D1.

#### [MODIFY] `SUPABASE_SETUP.sql`
- Add an `ALTER TABLE users ADD COLUMN password_hash TEXT;` block.

---

### Backend API (Hono)

#### [MODIFY] `src/server/routes/auth.ts`
- `POST /api/auth/register`: Takes email and password, validates institutional domain bounds (if required), securely hashes the password, creates the user in D1, and signs a new token using `hono/jwt`.
- `POST /api/auth/login`: Verifies user credentials against D1 `password_hash`. Mints and returns a JWT access token.
- `PATCH /api/auth/password-reset`: Admin-only endpoint to securely reset a staff member's password to a temporary default.

#### [MODIFY] `src/server/middleware/auth.ts`
- Refactor the token verification process. We no longer need to handle Supabase's specific JWT quirks. We will verify standard custom JWTs containing `{ userId, email, role }` payloads directly.
- Remove auto-provisioning since registration is now natively handled at the `/register` endpoint.

---

### Frontend

#### [MODIFY] `components/LandingPage.tsx`
- Remove the "Institutional Google ID" SSO flow.
- Build an interconnected **Log In** and **Create Account** module directly onto the landing page.

#### [MODIFY] `services/auth.ts` & `services/honoClient.ts`
- Replace `supabase.auth` calls with standard `fetch` API requests to `/api/auth/login`.
- Store the returned JWT strictly in standard `localStorage`.

#### [MODIFY] `App.tsx`
- Strip the `supabase.auth.onAuthStateChange` logic entirely. The app will boot cleanly and verify the `localStorage` JWT token directly using our `verifyToken` API endpoint or just trusting it until a 401 triggers a logout.

## Open Questions

> [!IMPORTANT]
> **Account Verification Strategy:** You mentioned keeping verification free. If we use this Native D1 Auth plan, users who register are immediately active. Do you want to enforce a manual "Admin Approval" step for new accounts before they can login, or let anyone with an `@poliku.edu.my` email gain instant system access upon registration?
