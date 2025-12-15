# Production Dockerfile with multi-stage build
# Stage 1: Builder - Install dependencies
# Stage 2: Runtime - Minimal final image

# ============================================================================
# STAGE 1: Builder
# Install all dependencies and compile Python packages
# ============================================================================
FROM python:3.12-slim as builder

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Set working directory
WORKDIR /app

# Install system dependencies for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install --user --no-warn-script-location -r requirements.txt

# ============================================================================
# STAGE 2: Runtime
# Minimal image with only runtime dependencies
# ============================================================================
FROM python:3.12-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH=/home/appuser/.local/bin:$PATH \
    PYTHONPATH=/home/appuser/.local/lib/python3.12/site-packages

# Install only runtime dependencies (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security FIRST
RUN useradd -m -u 1000 appuser

# Set working directory
WORKDIR /app

# Copy Python dependencies from builder stage to appuser's home
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local

# Copy Application Code
COPY --chown=appuser:appuser manage.py .
COPY --chown=appuser:appuser control_room/ ./control_room/
COPY --chown=appuser:appuser accounts/ ./accounts/
COPY --chown=appuser:appuser scripts/ ./scripts/

# Create directories for static files and media
RUN mkdir -p /app/staticfiles /app/media && \
    chown -R appuser:appuser /app


# Ensure scripts are executable and have Unix line endings
RUN sed -i 's/\r$//' /app/scripts/entrypoint.sh && \
    sed -i 's/\r$//' /app/scripts/wait-for-it.sh && \
    chmod +x /app/scripts/entrypoint.sh && \
    chmod +x /app/scripts/wait-for-it.sh


# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python scripts/healthcheck.py --liveness || exit 1

# Run entrypoint script
ENTRYPOINT ["/app/scripts/entrypoint.sh"]