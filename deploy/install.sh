#!/bin/bash
set -e

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

# 4. Build and Start
echo -e "${BLUE}>>> Building and Starting Services...${NC}"
docker-compose build
docker-compose up -d

echo -e "${GREEN}>>> Installation Complete! 🚀${NC}"
echo "------------------------------------------------"
echo "Backend API:  https://\$DOMAIN/api/"
echo "Agent Portal: https://\$DOMAIN/"
echo "------------------------------------------------"
