#!/bin/sh

# Determine the public folder location
# Backoffice is simpler, standard Next.js standalone structure
CONFIG_PATH="./public/config.js"

echo "Generating runtime config at $CONFIG_PATH"

# Create directory if it doesn't exist (safety check)
mkdir -p $(dirname "$CONFIG_PATH")

# Write config.js
cat <<EOF > "$CONFIG_PATH"
window.__ENV = {
  NEXT_PUBLIC_WS_URL: "${NEXT_PUBLIC_WS_URL:-ws://localhost:8000}",
  NEXT_PUBLIC_BASE_URL: "${NEXT_PUBLIC_BASE_URL:-http://localhost:3000}"
};
EOF

echo "Config generated:"
cat "$CONFIG_PATH"

# Execute the passed command
exec "$@"
