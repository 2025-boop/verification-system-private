#!/bin/bash
set -e
cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}>>> Starting Control Room Installation...${NC}"

# 1. Check Dependencies
if ! command -v docker &> /dev/null; then
    echo "Docker could not be found. Please install Docker first."
    exit 1
fi

# 1.5 Check/Install Docker Buildx (Required for Compose V2)
# Fix: Check strictly for v0.19 to avoid using old pre-installed versions (like 0.12)
if ! docker buildx version 2>/dev/null | grep -q "v0.19"; then
    echo -e "${BLUE}>>> System Buildx outdated. Installing v0.19.0 (Global)...${NC}"
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -SL https://github.com/docker/buildx/releases/download/v0.19.0/buildx-v0.19.0.linux-amd64 -o /usr/local/lib/docker/cli-plugins/docker-buildx
    chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
    echo -e "${GREEN}>>> Docker Buildx updated!${NC}"
fi

# 2. Setup Environment Variables
if [ ! -f .env.production ]; then
    echo -e "${BLUE}>>> Generatting .env.production from example...${NC}"
    cp .env.production.example .env.production
    
    # Generate random secrets
    SECRET_KEY=$(openssl rand -base64 32)
    DB_PASS=$(openssl rand -base64 16)
    
    # Update secrets in file using sed (compatible with Linux/Mac)
    sed -i "s|django-insecure-secret-key-placeholder|$SECRET_KEY|g" .env.production
    sed -i "s|postgres_password_placeholder|$DB_PASS|g" .env.production
    
    echo -e "${GREEN}>>> Generated secure passwords in .env.production${NC}"
    echo "⚠️  ACTION REQUIRED: Please edit .env.production and set your DOMAIN and ACME_EMAIL!"
    read -p "Press Enter when you have updated the .env.production file..."
fi

# 3. Create Data Directories
mkdir -p traefik_data
touch traefik_data/acme.json
chmod 600 traefik_data/acme.json

# 4. Build and Start
echo -e "${BLUE}>>> Building and Starting Services...${NC}"
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d

echo -e "${GREEN}>>> Installation Complete! 🚀${NC}"
echo "------------------------------------------------"
echo "Backend API:  https://\$DOMAIN/api/"
echo "Agent Portal: https://\$DOMAIN/"
echo "------------------------------------------------"
