# Production Deployment Guide

This directory contains everything you need to deploy the Control Room stack to any Linux server (VPS, AWS, DigitalOcean, etc.).

## 🚀 Quick Start (Production)

1.  **Transfer** this entire `deploy/` directory (or the whole repo) to your server.
2.  **Run the Installer**:
    ```bash
    bash install.sh
    ```
3.  **Configure**: The script will generate `.env.production`. Open it and set your `DOMAIN` and `ACME_EMAIL`:
    ```bash
    nano .env.production
    ```
    *   `DOMAIN`: Your public domain (e.g., `controlroom.example.com`).
    *   `ACME_EMAIL`: Email for Let's Encrypt SSL notifications.
4.  **Restart**: Run `bash install.sh` again or `docker compose up -d` to apply changes.

## 🛠 Maintenance

*   **Update Code**: `bash update.sh` (Pulls git changes, rebuilds containers, restarts).
*   **View Logs**: `docker compose logs -f`
*   **Stop App**: `docker compose down`

## 💻 Local Testing (Staging)

You can test the exact production stack on your laptop (localhost) before deploying.

```bash
bash test_local.sh
```

*   Frontend: [http://localhost](http://localhost) (or [http://localhost:3000](http://localhost:3000) for direct debug)
*   Backend: [http://localhost/api/](http://localhost/api/) (or [http://localhost:8000/api/](http://localhost:8000/api/) for direct debug)

## 📁 Files

*   `docker-compose.yml`: Main service definition (Traefik, Backend, Frontend, Postgres, Redis).
*   `.env.production`: Secrets and Config (Auto-generated).
*   `install.sh`: Setup script.
*   `update.sh`: Update script.
