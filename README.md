<div align="center">
<img width="1200" height="475" alt="Inspect-able Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Inspect-able: Asset Audit Pro

**Inspect-able** is a premium, institutional-grade asset audit and compliance management system. Designed for large-scale organizations, it provides real-time visibility into asset distribution, auditor coverage, and institutional KPI compliance — deployed entirely on the Cloudflare edge with sub-millisecond latency.

## 🚀 Key Features

### 📊 Institutional Dashboard
- **Real-time Stats**: Track global asset counts, auditor availability, and overall compliance progress.
- **KPI Tiering**: Dynamic classification of departments into **Small/Medium/Large** tiers with custom compliance targets.
- **Phase Management**: Multi-phase audit scheduling with automated progress tracking.
- **Smart Auto-Assignment**: Institutional-grade allocation engine that automatically assigns certified officers to inspections based on cross-audit permissions and workload balancing.

### 🏢 Consolidation Units
- **Auto-First Grouping**: Instantly consolidate small, unbalanced departments based on a dynamic asset threshold into perfectly balanced generic units (e.g., Group A, Group B).
- **Refinement Sandbox**: Modify generated audit groups via an intuitive registry checklist interface before finalizing to the database.
- **Premium Visualization**: Card-based layouts with "Brutalist" design aesthetics for high-impact reporting.

### 🎯 Cross-Audit Pairing Simulator
- **Intelligent Engine**: Automatically assigns high-asset audit targets to available auditing departments until the Institutional Phase KPI is perfectly met.
- **2-Person Team Constraint**: The mathematical engine computes workload strictly by "Teams" (calculating exactly 2 auditors per audit team), handling uneven headcounts natively.
- **Real-Time Projection Sandbox**: A live KPI Progress Bar shifts visually as admins manually override, create, or delete pairing drafts before locking decisions into the database.
- **Auto-Exemptions**: Departments with zero assets and zero auditors are instantly fully exempted from calculations.

### 🛡️ Role-Based Access (RBAC)
- **Admin**: Full system control, user management, and configuration.
- **Coordinator**: Oversight of multiple departments and scheduling.
- **Supervisor**: Management of single-department assets and auditor assignments.
- **Auditor/Staff**: Direct access to audit checklists and verification tools.
- **Live RBAC matrix** stored in KV (`rbac_matrix`) — overrideable at runtime with no redeploy.

### 🔐 Security & Session Management
- **Single-session enforcement**: Only one active browser session per user at any time. Logging in from a new device immediately displaces the previous session (`SESSION_DISPLACED 401`).
- **Admin force-logout**: Admins can remotely terminate any user's session via `DELETE /api/auth/session/:userId`.
- **Zero-latency JWT verification**: Supabase JWTs are verified locally on the edge using HS256 — no Supabase API call on every request.
- **KV role cache**: User roles and department ID are cached in KV (5-min TTL) and invalidated immediately on user mutations — D1 is only queried on cold fetch.
- **Cache-on-logout**: Server-side KV session and role cache are evicted before `supabase.auth.signOut()` fires.

### ⚙️ Automation & Pipeline
- **Auto-Versioning**: Semantic versioning (SemVer) automated via GitHub Actions on every push.
- **Cloudflare Integration**: Built for edge deployment via Cloudflare Workers + D1 + KV + R2.
- **Scheduled Backups**: Daily D1 → R2 snapshot at 02:00 UTC (10:00 AM MYT).

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, Lucide Icons |
| API server | [Hono](https://hono.dev/) + Hono RPC + Zod validators |
| Auth | Supabase Auth (Google OAuth) + local HS256 JWT verify |
| Primary DB | Cloudflare D1 (SQLite at the edge) |
| Cache / Sessions | Cloudflare KV (`SETTINGS` namespace) |
| File storage | Cloudflare R2 (backups + media) |
| AI | Cloudflare Workers AI (`llama-3.3-70b-instruct-fp8-fast`) |
| Deployment | Cloudflare Workers (Wrangler) |
| CI/CD | GitHub Actions |

## 🗄️ Cloudflare KV Usage

| KV key | Purpose | TTL |
|---|---|---|
| `sess:{userId}` | Single-session registry (current `session_id`) | 24 h |
| `ucache:{userId}` | User roles + departmentId cache | 5 min |
| `buildings` | Full buildings list cache | 1 h |
| `rbac_matrix` | Live RBAC permission overrides | 5 min (read TTL) |

## 💻 Getting Started

### Prerequisites
- Node.js (Latest stable)
- Cloudflare account with Workers, D1, KV, and R2 enabled
- Supabase Project (for Auth only)

### Setup Instructions

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/wilsonintai76/asset-audit-pro.git
   cd asset-audit-pro
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Create Cloudflare resources**:
   ```bash
   # KV namespace
   npx wrangler kv namespace create SETTINGS
   # Paste the returned id into wrangler.toml [[kv_namespaces]]

   # D1 database
   npx wrangler d1 create inspect-able-db
   npx wrangler d1 execute inspect-able-db --file=src/server/db/schema.sql

   # R2 bucket
   npx wrangler r2 bucket create inspect-able-backups
   ```

4. **Set secrets**:
   ```bash
   npx wrangler secret put SUPABASE_JWT_SECRET      # Supabase → Project Settings → API → JWT Secret
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```

5. **Configure `.env`** (local dev only):
   Copy `.env.example` to `.env` and fill in your Supabase public URL and anon key.

6. **Run Development Server**:
   ```bash
   npm run dev
   ```

7. **Build & Deploy**:
   ```bash
   npm run build
   npx wrangler deploy
   ```

## 🚢 CI/CD Workflow

This project uses an automated CI/CD pipeline:
- **Pushes to `main`**: Automatically bumps the patch version in `package.json`, creates a GitHub Tag, and triggers a Cloudflare Workers deployment.

### 🔢 Versioning Standards (SemVer)
The system follows [Semantic Versioning](https://semver.org/) automatically based on your commit messages:
-   **Patch Bump** (`0.0.x`): Triggered by prefixes like `fix:`, `chore:`, `docs:`, or no prefix.
-   **Minor Bump** (`0.x.0`): Triggered by the `feat:` prefix (New features).
-   **Major Bump** (`x.0.0`): Triggered by the `BREAKING CHANGE:` prefix or `feat!:` / `fix!:` syntax.

**Example**: Sending a commit with `feat: add new reporting module` will automatically update the version to the next minor release (e.g., `1.2.2` → `1.3.0`).

---

© 2026 Asset Audit Pro. All rights reserved.
