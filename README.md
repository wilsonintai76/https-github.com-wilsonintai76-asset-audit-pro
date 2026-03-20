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
- **Audit Groups**: Automatically consolidate smaller departments into larger "Audit Units" for streamlined management.
- **Asset Aggregation**: Real-time totaling of assets across consolidated entities.
- **Premium Visualization**: Card-based layouts with "Brutalist" design aesthetics for high-impact reporting.

### 🛡️ Role-Based Access (RBAC)
- **Admin**: Full system control, user management, and configuration.
- **Coordinator**: Oversight of multiple departments and scheduling.
- **Supervisor**: Management of single-department assets and auditor assignments.
- **Auditor/Staff**: Direct access to audit checklists and verification tools.

### ⚙️ Automation & Pipeline
- **Auto-Versioning**: Semantic versioning (SemVer) automated via GitHub Actions on every push.
- **Cloudflare Integration**: Built for edge deployment via Cloudflare Pages.
- **Hybrid Deployment**: Support for Docker-based self-hosted services alongside cloud-based Supabase persistence.

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
- **Pushes to `master`**: Automatically bumps the patch version in `package.json`, creates a GitHub Tag, and triggers a Cloudflare Pages deployment.
- **Self-Hosted Components**: Uses a `self-hosted` runner for Docker-based server synchronization as defined in `.github/workflows/deploy.yml`.

### ⚠️ Troubleshooting Versioning
If the version number (patch) does not increment automatically on GitHub:
1.  Go to your Repository **Settings**.
2.  Navigate to **Actions** > **General**.
3.  Scroll down to **Workflow permissions**.
4.  Select **"Read and write permissions"** and click **Save**.
5.  Ensure **"Allow GitHub Actions to create and approve pull requests"** is also checked.

---

© 2026 Asset Audit Pro. All rights reserved.
