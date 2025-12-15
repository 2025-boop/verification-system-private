#!/bin/bash
set -e

# ==============================================================================
# CONTROL ROOM ENTRYPOINT
# ==============================================================================
# Fails fast on any error. Waite for dependencies with strict timeouts.
# ==============================================================================

echo "🚀 Starting Control Room Entrypoint..."

# 1. FIX: Create missing static directory to silence Django warning (staticfiles.W004)
# This directory is in STATICFILES_DIRS but might be empty in the container
mkdir -p /app/static
mkdir -p /app/staticfiles
mkdir -p /app/media

# 2. WAIT FOR DEPENDENCIES (Fail Fast Strategy)
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}

wait_for_service() {
    local host="$1"
    local port="$2"
    local service_name="$3"
    local max_attempts=30
    local attempt=1

    echo "⏳ Waiting for $service_name ($host:$port)..."
    while [ $attempt -le $max_attempts ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            echo "✅ $service_name is ready!"
            return 0
        fi
        sleep 1
        ((attempt++))
    done
    
    echo "❌ $service_name failed to start after $max_attempts seconds."
    exit 1
}

wait_for_service "$DB_HOST" "$DB_PORT" "PostgreSQL"
# We only check Redis connectivity, not full protocol here (healthcheck does that)
# If REDIS_HOST is set to an AWS endpoint, this verifies SG rules allow access
echo "⏳ Waiting for Redis ($REDIS_HOST:$REDIS_PORT)..."
# Simple check if it's a domain name vs IP (basic heuristic)
if nc -z -w 5 "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; then
     echo "✅ Redis is ready!"
else
     echo "⚠️  Redis not reachable via simple TCP check (might be firewall or wrong host)."
     # We don't exit here immediately for Redis to allow for potential complexity, 
     # but healthcheck.py will fail if it's critical.
     # Actually, strictly fail-fast means we SHOULD exit.
     # But let's trust the python healthcheck to be more nuanced with TLS.
     echo "   Continuing to application startup to let Healthcheck diagnose..."
fi


# 3. VERIFY & MIGRATE DATABASE
echo "🔄 Running database migrations..."
python manage.py migrate --noinput || { echo "❌ Migrations failed"; exit 1; }

echo "🔍 Verifying database accessibility..."
# We run verify_db.py to ensure we actually have permissions and schema is correct
python scripts/verify_db.py || { echo "❌ Database verification failed"; exit 1; }


# 4. SYSTEM SETUP
echo "🔑 Ensuring superuser..."
python scripts/create_superuser.py || { echo "❌ Superuser creation failed"; exit 1; }

echo "📦 Collecting static files..."
python manage.py collectstatic --noinput --clear || { echo "❌ Collectstatic failed"; exit 1; }


# 5. FINAL HEALTH CHECK before serving traffic
echo "🏥 Running comprehensive health check..."
python scripts/healthcheck.py || { echo "❌ Startup Health Check Failed"; exit 1; }


# 6. START APPLICATION
echo "✅ Setup complete! Starting Server..."
if [ "$DJANGO_ENV" = "production" ]; then
    echo "🚀 Starting Daphne (Production Mode)..."
    exec daphne -b 0.0.0.0 -p 8000 control_room.asgi:application
else
    echo "🚀 Starting Daphne (Dev Mode)..."
    exec daphne -b 0.0.0.0 -p 8000 control_room.asgi:application
fi
