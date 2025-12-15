# Production Deployment Guide

This guide provides step-by-step instructions to deploy the **Control Room stack** on any Linux server (VPS, AWS, DigitalOcean, etc.).

---

## 🚀 Quick Start (Production)

### 1. Transfer Files to the Server

Transfer the entire `deploy/` directory (or the whole repo) to your server. You can use `scp` or any other file transfer method.

### 2. Install Dependencies

Run the following commands to install Docker and necessary dependencies:

```bash
sudo dnf update -y && \
sudo dnf install -y docker && \
sudo systemctl start docker && \
sudo systemctl enable docker && \
sudo usermod -aG docker ec2-user && \
newgrp docker && \
docker --version
```

#### Set up Docker Compose

1. **Create a plugin directory** for Docker Compose:

   ```bash
   sudo mkdir -p /usr/local/lib/docker/cli-plugins
   ```

2. **Download the latest Docker Compose** binary for your system architecture:

   ```bash
   sudo curl -sL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
   -o /usr/local/lib/docker/cli-plugins/docker-compose
   ```

3. **Set proper permissions**:

   ```bash
   sudo chown root:root /usr/local/lib/docker/cli-plugins/docker-compose
   sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
   ```

4. **Verify the installation**:

   ```bash
   docker compose version
   ```

---

### 3. Run the Installer

Execute the installation script:

```bash
bash install.sh
```

This will set up all necessary services.

### 4. Configure Environment Variables

The installer will generate a `.env.production` file. Open it to configure the following settings:

```bash
nano deploy/.env.production
```

* **`DOMAIN`**: Your public domain (e.g., `controlroom.example.com`).
* **`ACME_EMAIL`**: Your email address for Let's Encrypt SSL notifications.

Example:

```bash
DOMAIN=controlroom.example.com
ACME_EMAIL=your-email@example.com
```

Save and close the file.

---

### 5. Restart the Application

Apply the changes and restart the services by running:

```bash
bash deploy/update.sh
```

Alternatively, you can use Docker Compose directly:

```bash
docker compose up -d
```

---

## 🛠 Maintenance

* **Update Code**: To pull the latest changes, rebuild containers, and restart the app:

  ```bash
  bash deploy/update.sh
  ```

* **View Logs**: To view real-time logs from the containers:

  ```bash
  docker compose logs -f
  ```

* **Stop the App**: To stop the containers:

  ```bash
  docker compose down
  ```

---

## 💻 Local Testing (Staging)

To test the app locally (on your laptop or development machine) using the same stack as production, run:

```bash
bash test_local.sh
```

* **Frontend**: [http://localhost](http://localhost) (or [http://localhost:3000](http://localhost:3000) for direct debug)
* **Backend**: [http://localhost/api/](http://localhost/api/) (or [http://localhost:8000/api/](http://localhost:8000/api/) for direct debug)

---

## 📁 Files

Here’s a brief overview of the important files and scripts:

* **`docker-compose.yml`**: Defines the main services (Traefik, Backend, Frontend, Postgres, Redis).
* **`.env.production`**: Contains secret keys and configuration settings (auto-generated).
* **`deploy/install.sh`**: Setup script for the production environment.
* **`deploy/update.sh`**: Script to update the deployment with the latest code and rebuild containers.

---
