#!/bin/bash
set -e

echo ">>> Updating Control Room Stack..."

# 1. Pull Code
echo ">>> Pulling latest code..."
git pull

# 2. Rebuild
echo ">>> Rebuilding containers..."
docker-compose --file docker-compose.yml build

# 3. Restart
echo ">>> Restarting services..."
docker-compose --file docker-compose.yml up -d --remove-orphans

# 4. Prune unused images
docker image prune -f

echo "✅ Update Complete."
