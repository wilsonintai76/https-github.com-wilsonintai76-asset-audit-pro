<div align="center">
<img width="1200" height="475" alt="Inspect-able Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Inspect-able: Asset Audit Pro

**Inspect-able** is a premium, institutionalgrade asset audit and compliance management system. Designed for large-scale organizations, it provides real-time visibility into asset distribution, auditor coverage, and institutional KPI compliance.

## 🚀 Key Features

### 📊 Institutional Dashboard
- **Real-time Stats**: Track global asset counts, auditor availability, and overall compliance progress.
- **KPI Tiering**: Dynamic classification of departments into **Small/Medium/Large** tiers with custom compliance targets.
- **Phase Management**: Multi-phase audit scheduling with automated progress tracking.

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

### ⚙️ Automation & Pipeline
- **Auto-Versioning**: Semantic versioning (SemVer) automated via GitHub Actions on every push.
- **Cloudflare Integration**: Built for edge deployment via Cloudflare Pages.

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, Lucide Icons.
- **Backend/DB**: Supabase (PostgreSQL + Auth).
- **Automation**: GitHub Actions.
- **Deployment**: Cloudflare Pages / Wrangler.

## 💻 Getting Started

### Prerequisites
- Node.js (Latest stable)
- Supabase Project (Database URL & Keys)

### Setup Instructions

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/wilsonintai76/asset-audit-pro.git
   cd asset-audit-pro
   ```

2. **Configuration**:
   Copy `.env.example` to `.env` and fill in your Supabase credentials and Gemini API Key (for intelligent reporting).

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

## 🚢 CI/CD Workflow

This project uses an automated CI/CD pipeline:
- **Pushes to `main`**: Automatically bumps the patch version in `package.json`, creates a GitHub Tag, and triggers a Cloudflare Pages deployment.

### 🔢 Versioning Standards (SemVer)
The system follows [Semantic Versioning](https://semver.org/) automatically based on your commit messages:
-   **Patch Bump** (`0.0.x`): Triggered by prefixes like `fix:`, `chore:`, `docs:`, or no prefix.
-   **Minor Bump** (`0.x.0`): Triggered by the `feat:` prefix (New features).
-   **Major Bump** (`x.0.0`): Triggered by the `BREAKING CHANGE:` prefix or `feat!:` / `fix!:` syntax.

**Example**: Sending a commit with `feat: add new reporting module` will automatically update the version to the next minor release (e.g., `1.2.2` → `1.3.0`).

---

© 2026 Asset Audit Pro. All rights reserved.
