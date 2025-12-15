#!/usr/bin/env python
"""
Database verification script.
Ensures PostgreSQL tables exist before Django starts.
Useful for debugging connection/migration issues in AWS.
"""

import os
import sys
import django
from pathlib import Path

# Add parent directory to Python path so we can import control_room module
# This is needed when running the script from the scripts/ subdirectory
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'control_room.settings')
django.setup()

from django.db import connection


def verify_database():
    """
    Verify database is accessible and has required tables.
    Prints detailed debug info if tables are missing.
    """
    print("\n" + "="*60)
    print("DATABASE VERIFICATION")
    print("="*60)

    try:
        # Test basic connection
        with connection.cursor() as cursor:
            # First, verify we can execute raw SQL
            cursor.execute("SELECT version();")
            version = cursor.fetchone()[0]
            print(f"✅ PostgreSQL Connection: {version.split(',')[0]}")

            # Check if auth_user table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'auth_user'
                )
            """)

            table_exists = cursor.fetchone()[0]

            if table_exists:
                # Count users
                cursor.execute("SELECT COUNT(*) FROM auth_user")
                user_count = cursor.fetchone()[0]
                print(f"✅ Auth table exists: {user_count} users found")

                # List all tables
                cursor.execute("""
                    SELECT tablename
                    FROM pg_tables
                    WHERE schemaname = 'public'
                    ORDER BY tablename
                """)
                tables = cursor.fetchall()
                print(f"✅ Total tables in 'public' schema: {len(tables)}")
                print("\nTables:")
                for table in tables:
                    print(f"  - {table[0]}")

                print("\n" + "="*60)
                print("✅ DATABASE VERIFICATION PASSED")
                print("="*60 + "\n")
                return True
            else:
                print("❌ Auth table NOT found!")
                print("\nAvailable tables:")
                cursor.execute("""
                    SELECT tablename
                    FROM pg_tables
                    WHERE schemaname = 'public'
                    ORDER BY tablename
                """)
                tables = cursor.fetchall()
                if tables:
                    for table in tables:
                        print(f"  - {table[0]}")
                else:
                    print("  (No tables found)")

                print("\n" + "="*60)
                print("❌ DATABASE VERIFICATION FAILED")
                print("="*60)
                print("\nERROR: Required tables are missing!")
                print("This usually means:")
                print("  1. Migrations did not run successfully")
                print("  2. Tables were created in a different database")
                print("  3. User does not have permission to access tables")
                print("\nFix: Ensure migrations ran in entrypoint.sh")
                print("="*60 + "\n")
                return False

    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("\n" + "="*60)
        print("DATABASE VERIFICATION ERROR")
        print("="*60)
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Message: {str(e)}")
        print("\nThis usually means:")
        print("  1. Database server is not accessible")
        print("  2. Connection credentials are incorrect")
        print("  3. Network/firewall blocking connection")
        print("  4. Database has not been created yet")
        print("="*60 + "\n")
        return False


if __name__ == "__main__":
    success = verify_database()
    sys.exit(0 if success else 1)
