# Control Room Setup Guide

Follow this guide to set up the Control Room on a fresh Linux server (e.g., AWS EC2, DigitalOcean).

## 1. Initial Setup (One-Time)

### Cloning & Dependencies
```bash
# 1. Clone the repository
git clone https://github.com/2025-boop/verification-system-private.git
cd verification-system-private

# 2. Run the Installer
bash deploy/install.sh
```

**The installer will automatically:**
1.  Install Docker & plugins if missing.
2.  Generate a secure configuration file (`.env.production`).
3.  **Prompt you** to enter your Domain and Email.
4.  Launch the application.

### Configuration
The `.env.production` file is **private** and not tracked by Git.
- It is created from `.env.production.example`.
- Secrets are auto-generated.
- You **must** set `DOMAIN` to your real domain (e.g., `app.example.com`).

---

## 2. Updates & Maintenance (Ongoing)

When you make changes to the code (locally), push them to GitHub:

```bash
git add .
git commit -m "New features"
git push
```

Then, on your server, simply run:

```bash
cd verification-system-private
bash deploy/update.sh
```

**The update script will:**
1.  Pull the latest code.
2.  Check that your config exists (fail-safe).
3.  Rebuild and restart containers.

---

## 3. Reference
- **Logs**: `docker compose logs -f`
- **Config File**: `nano deploy/.env.production`
- **Reset Config**: If you mess up, delete `deploy/.env.production` and run `install.sh` again.
