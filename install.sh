#!/bin/bash
# BC Inventory Management - Automated Installation Script
# Run as: curl -sSL https://raw.githubusercontent.com/zv20/bcinv/main/install.sh | bash

set -e

echo "====================================="
echo "BC Inventory Management - Installer"
echo "====================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Error: Please run as root (use sudo or run in container as root)"
    exit 1
fi

echo "[1/7] Installing system dependencies..."
apt update
# Node.js 20 from NodeSource already includes npm - don't install Debian's npm package
apt install -y postgresql postgresql-contrib git curl

echo ""
echo "[2/7] Setting up database..."
systemctl start postgresql
systemctl enable postgresql

DB_PASSWORD=$(openssl rand -base64 24)

# Use su instead of sudo (works in minimal containers without sudo)
su - postgres -c "psql" << EOF
DROP DATABASE IF EXISTS bcinv;
DROP USER IF EXISTS bcinv_user;
CREATE DATABASE bcinv;
CREATE USER bcinv_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE bcinv TO bcinv_user;
\c bcinv
GRANT ALL ON SCHEMA public TO bcinv_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bcinv_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bcinv_user;
EOF

echo "✓ Database created"

echo ""
echo "[3/7] Installing application..."
cd /opt/bcinv

echo ""
echo "[4/7] Installing Node.js dependencies..."
npm install --production

echo ""
echo "[5/7] Creating database schema..."
PGPASSWORD=$DB_PASSWORD psql -h localhost -U bcinv_user -d bcinv -f database/schema.sql

echo ""
echo "[6/7] Configuring application..."
cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bcinv
DB_USER=bcinv_user
DB_PASSWORD=$DB_PASSWORD
PORT=3000
EOF
chmod 600 .env

cat > /etc/systemd/system/bcinv-api.service << 'SERVICEEOF'
[Unit]
Description=BC Inventory Management API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/bcinv
EnvironmentFile=/opt/bcinv/.env
ExecStart=/usr/bin/node /opt/bcinv/src/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEEOF

echo ""
echo "[7/7] Starting service..."
systemctl daemon-reload
systemctl enable bcinv-api
systemctl start bcinv-api

echo "Waiting for service to start..."
sleep 3

if systemctl is-active --quiet bcinv-api; then
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo ""
    echo "====================================="
    echo "✓ INSTALLATION SUCCESSFUL!"
    echo "====================================="
    echo ""
    echo "BC Inventory Management is running!"
    echo ""
    echo "Access URL: http://$SERVER_IP:3000"
    echo ""
    echo "Database Info:"
    echo "  • Credentials saved to: /opt/bcinv/.env"
    echo "  • Database: bcinv"
    echo "  • User: bcinv_user"
    echo ""
    echo "Pre-loaded Data:"
    echo "  • 4 departments (General, Food, Beverages, Supplies)"
    echo "  • 3 warehouse locations"
    echo ""
    echo "Useful Commands:"
    echo "  • Check status: systemctl status bcinv-api"
    echo "  • View logs: journalctl -u bcinv-api -f"
    echo "  • Restart: systemctl restart bcinv-api"
    echo ""
else
    echo ""
    echo "✗ Service failed to start"
    echo "Check logs: journalctl -u bcinv-api -n 50"
    exit 1
fi
