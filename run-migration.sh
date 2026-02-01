#!/bin/bash
# Run database migration for departments and suppliers

echo "Running migration: Add departments and suppliers tables..."

su - postgres -c "psql -d bcinv -f /opt/bcinv/database/migrations/001_add_departments_suppliers.sql"

if [ $? -eq 0 ]; then
    echo "✓ Migration completed successfully!"
    echo "✓ Departments and suppliers tables created"
    echo "✓ Existing categories migrated to departments"
else
    echo "✗ Migration failed!"
    exit 1
fi
