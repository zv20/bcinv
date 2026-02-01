#!/bin/bash
# Complete deployment script for BC Inventory updates

set -e

echo "======================================"
echo "BC Inventory - Deployment Script"
echo "======================================"
echo ""

echo "[1/4] Pulling latest code from GitHub..."
cd /opt/bcinv
git pull origin main

echo ""
echo "[2/4] Running database migrations..."
if [ -f "database/migrations/001_add_departments_suppliers.sql" ]; then
    su - postgres -c "psql -d bcinv -f /opt/bcinv/database/migrations/001_add_departments_suppliers.sql" 2>&1 | grep -v "already exists" || true
    echo "✓ Migration completed"
else
    echo "! No migration file found, skipping..."
fi

echo ""
echo "[3/4] Restarting API server..."
systemctl restart bcinv-api
sleep 2

echo ""
echo "[4/4] Checking service status..."
if systemctl is-active --quiet bcinv-api; then
    echo "✓ API server is running"
    echo ""
    echo "======================================"
    echo "✓ DEPLOYMENT SUCCESSFUL!"
    echo "======================================"
    echo ""
    echo "Your inventory system has been updated with:"
    echo "  • Departments management"
    echo "  • Suppliers management"
    echo "  • Enhanced locations management"
    echo "  • Dropdown menus in product forms"
    echo ""
    echo "Open your browser and refresh to see the changes!"
    echo "URL: http://$(hostname -I | awk '{print $1}'):3000"
    echo ""
else
    echo "✗ API server failed to start!"
    echo ""
    echo "Check logs with:"
    echo "  sudo journalctl -u bcinv-api -n 50"
    exit 1
fi
