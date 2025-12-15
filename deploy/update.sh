#!/bin/bash
set -e
cd "$(dirname "$0")"

# Safety Check: Configuration must exist
if [ ! -f .env.production ]; then
    echo "❌ ERROR: .env.production missing!"
    echo "Please run 'bash deploy/install.sh' first to generate configuration."
    exit 1
fi

echo ">>> Updating Control Room Stack..."

# 1. Pull Code
echo ">>> Pulling latest code..."
git pull

# 2. Rebuild
echo ">>> Rebuilding containers..."
docker compose --env-file .env.production --file docker-compose.yml build

# 3. Restart services
echo ">>> Restarting services..."
docker compose --env-file .env.production --file docker-compose.yml up -d --remove-orphans

# 4. Prune unused images
docker image prune -f

echo "✅ Update Complete."
