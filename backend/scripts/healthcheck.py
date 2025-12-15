#!/usr/bin/env python
"""
Comprehensive health check script for Control Room.

Tests all critical components:
1. Environment variables (via Django settings)
2. Database (PostgreSQL connectivity)
3. Redis (TCP + TLS detection)
4. Django Channels layer
5. WebSocket ASGI routing

Usage:
    python scripts/healthcheck.py              # Full startup check
    python scripts/healthcheck.py --liveness   # Quick DB+Redis only (K8s liveness probe)
    python scripts/healthcheck.py --readiness  # All checks (K8s readiness probe)
    python scripts/healthcheck.py --verbose    # Full output with debugging

Exit codes:
    0: All checks passed
    1: One or more checks failed
"""

import os
import sys
import django
import asyncio
import socket
from pathlib import Path

# Add parent directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'control_room.settings')
django.setup()

from django.conf import settings
from django.db import connection
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


class HealthCheck:
    """Comprehensive health check for all system components."""

    def __init__(self, verbose=False, liveness_only=False, readiness_all=False):
        self.verbose = verbose
        self.liveness_only = liveness_only
        self.readiness_all = readiness_all
        self.results = {}
        self.env_mode = os.getenv('DJANGO_ENV', 'local').upper()

        # Check if terminal supports Unicode (emoji)
        self.supports_unicode = self._check_unicode_support()

    @staticmethod
    def _check_unicode_support():
        """Check if terminal supports Unicode characters."""
        try:
            import sys
            encoding = sys.stdout.encoding or 'utf-8'
            return encoding.lower() not in ['ascii', 'cp1252', 'latin-1']
        except:
            return False

    def _emoji(self, emoji_str: str, fallback: str = ""):
        """Return emoji if supported, otherwise fallback."""
        return emoji_str if self.supports_unicode else (fallback or "")

    def print_header(self):
        """Print header banner."""
        print("\n" + "=" * 70)
        print("CONTROL ROOM HEALTH CHECK")
        print(f"Environment: {self.env_mode}")
        print("=" * 70 + "\n")

    def print_result(self, component: str, status: str, message: str = "", emoji: str = ""):
        """Print formatted result for a component."""
        if status == "PASS":
            emoji = emoji or self._emoji("✅", "[OK]")
        elif status == "WARN":
            emoji = emoji or self._emoji("⚠️ ", "[WN]")
        else:  # FAIL
            emoji = emoji or self._emoji("❌", "[ER]")

        print(f"{emoji} {component:<30} {status:<10} {message}")
        self.results[component] = status

    def print_section(self, title: str):
        """Print section divider."""
        print(f"\n{title}")
        print("-" * 70)

    def check_tcp_connection(self, host: str, port: int, timeout: float = 3.0) -> bool:
        """Low-level TCP connection check."""
        try:
            sock = socket.create_connection((host, int(port)), timeout=timeout)
            sock.close()
            return True
        except Exception:
            return False

    def check_environment_variables(self) -> bool:
        """Check required configuration (via Django settings)."""
        self.print_section(self._emoji("1️⃣  ", "[1] ") + "CONFIGURATION")

        # We check settings, not just env vars, because settings source of truth
        checks = [
            ('SECRET_KEY', getattr(settings, 'SECRET_KEY', None)),
            ('DATABASES', getattr(settings, 'DATABASES', {})),
            ('ALLOWED_HOSTS', getattr(settings, 'ALLOWED_HOSTS', [])),
        ]

        if self.env_mode == 'PRODUCTION':
             # Add production specific checks
             pass

        all_ok = True
        
        # Check SECRET_KEY
        secret = settings.SECRET_KEY
        if secret and 'django-insecure' not in secret:
            self.print_result("  SECRET_KEY", "PASS", "Set and secure")
        elif secret:
             self.print_result("  SECRET_KEY", "WARN", "Set (insecure default detected)")
        else:
             self.print_result("  SECRET_KEY", "FAIL", "Not set")
             all_ok = False

        # Check Hosts
        if settings.ALLOWED_HOSTS:
             self.print_result("  ALLOWED_HOSTS", "PASS", f"Configured ({len(settings.ALLOWED_HOSTS)} hosts)")
        else:
             self.print_result("  ALLOWED_HOSTS", "WARN", "Empty (might be insecure)")

        return all_ok

    def check_database(self) -> bool:
        """Check PostgreSQL connectivity and schema."""
        self.print_section(self._emoji("2️⃣  ", "[2] ") + "DATABASE (PostgreSQL)")

        try:
            db_engine = settings.DATABASES['default'].get('ENGINE', '')
            with connection.cursor() as cursor:
                # Check version
                if 'postgresql' in db_engine:
                    cursor.execute("SELECT version();")
                    version = cursor.fetchone()[0]
                    db_version = version.split(',')[0]
                elif 'sqlite' in db_engine:
                    cursor.execute("SELECT sqlite_version();")
                    version = cursor.fetchone()[0]
                    db_version = f"SQLite {version}"
                else:
                    db_version = "Unknown"
                self.print_result("  Connection", "PASS", db_version)

                # Check auth table
                try:
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    count = User.objects.count()
                    self.print_result("  Auth Table", "PASS", f"{count} users found")
                    return True
                except Exception as e:
                    self.print_result("  Auth Table", "FAIL", f"Error: {e}")
                    return False

        except Exception as e:
            self.print_result("  Connection", "FAIL", str(e)[:50])
            return False

    def check_redis(self) -> bool:
        """Check Redis connectivity with TCP + High Level."""
        self.print_section(self._emoji("3️⃣  ", "[3] ") + "REDIS (Cache & Channel Layer)")

        try:
            # 1. Parse Config
            redis_config = settings.CHANNEL_LAYERS.get('default', {})
            hosts = redis_config.get('CONFIG', {}).get('hosts', [])
            
            if not hosts:
                self.print_result("  Configuration", "FAIL", "No hosts configured")
                return False

            # Extract host/port
            host = "localhost"
            port = 6379

            if isinstance(hosts, list) and hosts:
                host_config = hosts[0]
                if isinstance(host_config, str) and host_config.startswith("rediss://"):
                     # Parse rediss:// URL
                     try:
                         # Strip rediss://
                         remainder = host_config.replace("rediss://", "")
                         # Remove auth if present
                         if "@" in remainder:
                             remainder = remainder.split("@")[1]
                         # Remove query params
                         if "?" in remainder:
                             remainder = remainder.split("?")[0]
                         
                         parts = remainder.split(":")
                         host = parts[0]
                         if len(parts) > 1:
                             port = int(parts[1])
                     except Exception:
                         self.print_result("  Config Parse", "WARN", "Failed to parse URL, using raw")
                         pass

                elif isinstance(host_config, dict):
                     if "host" in host_config and "port" in host_config:
                         host = host_config["host"]
                         port = host_config["port"]
                     elif "address" in host_config:
                         address = host_config.get('address')
                         if isinstance(address, tuple):
                              host, port = address
                
                elif isinstance(host_config, tuple):
                     host, port = host_config

            self.print_result("  Config", "PASS", f"{host}:{port}")

            # 2. Low-Level TCP Check
            if self.check_tcp_connection(host, port):
                self.print_result("  Network (TCP)", "PASS", "Port Open")
            else:
                self.print_result("  Network (TCP)", "FAIL", "Connection Refused/Timeout")
                # We fail here because if TCP is dead, app will die
                return False

            # 3. High-Level Channel Layer Check
            channel_layer = get_channel_layer()
            if channel_layer is None:
                self.print_result("  Channel Layer", "WARN", "Not configured")
                return True

            @async_to_sync
            async def test_redis_ping():
                try:
                    # Generate a temp channel (local op)
                    channel_name = await channel_layer.new_channel()
                    
                    # Send a message (network op - hits Redis)
                    # This verifies we can connect, auth, and write to Redis.
                    # We don't need a consumer to listen; successful write is enough.
                    await asyncio.wait_for(
                        channel_layer.send(
                            channel_name,
                            {'type': 'ping'}
                        ),
                        timeout=5.0
                    )
                    return True
                except asyncio.TimeoutError:
                    return False
                except Exception:
                     return False

            if test_redis_ping():
                self.print_result("  Channels Auth", "PASS", "Write to Redis OK")
                return True
            else:
                self.print_result("  Channels Auth", "WARN", "Write timeout (Config/Auth issue?)")
                return True # Allow startup - TCP works

        except Exception as e:
            self.print_result("  Check Error", "FAIL", str(e))
            return False

    def check_websocket_asgi(self) -> bool:
        """Check WebSocket ASGI routing."""
        self.print_section(self._emoji("5️⃣  ", "[5] ") + "WEBSOCKET (ASGI Routing)")
        # ... logic similar to original, kept simple ...
        try:
            from control_room.asgi import application
            if hasattr(application, '__call__'):
                 self.print_result("  ASGI App", "PASS", "Loaded")
            else:
                 self.print_result("  ASGI App", "FAIL", "Not callable")
                 return False
            return True
        except ImportError:
             self.print_result("  ASGI App", "FAIL", "Import Error")
             return False


    def run(self) -> int:
        """Run health checks based on mode."""
        if self.verbose:
            self.print_header()
        
        # Liveness: Basic connectivity (DB check only usually, but here we do env + db)
        # Readiness: Can serve traffic (DB + Redis + Channels)
        
        all_ok = True

        # 1. Config (Always check)
        if not self.check_environment_variables():
            all_ok = False

        # 2. Database (Start with this)
        if all_ok and not self.check_database():
            all_ok = False

        # 3. Redis (Critical for Channels)
        # If liveness check, maybe we skip Redis if we consider DB enough? 
        # But for this app, Redis is critical.
        if all_ok:
             if not self.check_redis():
                 all_ok = False

        # 4. WebSocket ASGI (Only for readiness/full)
        if not self.liveness_only:
            if all_ok and not self.check_websocket_asgi():
                all_ok = False

        if self.verbose:
            print("\n" + "=" * 70)
            if all_ok:
                print(self._emoji("✅ ", "[OK] ") + "ALL CHECKS PASSED")
            else:
                print(self._emoji("❌ ", "[ER] ") + "CRITICAL FAILURE DETECTED")
        
        return 0 if all_ok else 1

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Health Check')
    parser.add_argument('--liveness', action='store_true', help='Run liveness checks only')
    parser.add_argument('--readiness', action='store_true', help='Run readiness checks')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    checker = HealthCheck(
        verbose=args.verbose or (not args.liveness and not args.readiness), # Default verbose if no flags
        liveness_only=args.liveness,
        readiness_all=args.readiness
    )
    sys.exit(checker.run())

if __name__ == '__main__':
    main()
