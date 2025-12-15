#!/bin/bash
set -e

# Colors
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}>>> Starting Local Staging Test...${NC}"

# 1. Setup Local Environment Variables
if [ ! -f .env.local_test ]; then
    echo ">>> Creating .env.local_test from .env.production.example..."
    cp .env.production.example .env.local_test
    
    # Configure for LOCALHOST testing
    # We strip domain configuraton and use localhost
    sed -i 's/controlroom.example.com/localhost/g' .env.local_test
    sed -i 's/admin@example.com/admin@localhost/g' .env.local_test
    
    # Generate secrets if placeholders exist
    SECRET_KEY=$(openssl rand -base64 32)
    DB_PASS=$(openssl rand -base64 16)
    sed -i "s|django-insecure-secret-key-placeholder|$SECRET_KEY|g" .env.local_test
    sed -i "s|postgres_password_placeholder|$DB_PASS|g" .env.local_test

    # IMPORTANT: Set DJANGO_ENV to production to test the real settings
    # But override DB/Redis hosts to match Docker Compose service names
    echo "DJANGO_ENV=production" >> .env.local_test
    # Traefik needs to know this is a test (no SSL) - we'll handle this in compose override
fi

# 2. Start Stack (No SSL for Local Test)
echo -e "${YELLOW}>>> Launching Stack (HTTP Mode)...${NC}"

# We use an override file to disable SSL redirection for localhost testing
cat <<EOF > docker-compose.local-test.yml
version: '3.8'
services:
  traefik:
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      # Disable SSL resolver for local test
  
  backend:
    environment:
      - DOMAIN=localhost
      - DJANGO_ENV=production
      # Debug mode on for staging test to see errors
      - DEBUG=True
    labels:
      - "traefik.http.routers.backend.rule=Host(\`localhost\`) && PathPrefix(\`/api\`, \`/ws\`, \`/admin\`, \`/static\`)"
      - "traefik.http.routers.backend.entrypoints=web"
      # Remove SSL middlewares
      - "traefik.http.routers.backend.middlewares="

  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost/api
      - NEXT_PUBLIC_WS_URL=ws://localhost
    labels:
      - "traefik.http.routers.frontend.rule=Host(\`localhost\`)"
      - "traefik.http.routers.frontend.entrypoints=web"
      # Remove SSL middlewares
      - "traefik.http.routers.frontend.middlewares="
EOF


# 3. Build and Run
docker compose -f docker-compose.yml -f docker-compose.local-test.yml --env-file .env.local_test up --build -d

echo -e "${GREEN}>>> Staging Environment Running!${NC}"
echo "------------------------------------------------"
echo " Traefik Proxy: http://localhost (Try incognito if 404)"
echo "------------------------------------------------"
echo " Direct Access (Debug):"
echo " Frontend:      http://localhost:3000"
echo " Backend API:   http://localhost:8000/api/"
echo " Traefik Dash:  http://localhost:8080/dashboard/"
echo "------------------------------------------------"
