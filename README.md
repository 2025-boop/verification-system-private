# Verification System

This is the monorepo for the Control Room verification platform.

## Repository Structure

```text
/
├── backend/            # Django Backend (API + WebSocket)
├── frontend/           # Next.js Agent Portal & Client Interface
└── deploy/             # Deployment Scripts & Infrastructure (Docker Compose)
```

## Getting Started

### 1. Prerequisites
- Docker & Docker Compose
- Git

### 2. Run Locally (Staging Mode)
You can bring up the entire stack on your local machine with one command.

```bash
cd deploy
bash test_local.sh
```
*   **Frontend**: http://localhost
*   **Backend**: http://localhost/api/
*   **Dashboard**: http://localhost:8080

## Deployment (Production)

This repo follows a "GitOps Lite" workflow. To deploy:

1.  **Push** your changes to `main`.
2.  **SSH** into your server.
3.  **Run Update**:
    ```bash
    cd verification-system
    git pull
    bash deploy/update.sh
    ```

For full details, see [deploy/README.md](deploy/README.md).
