#!/bin/bash
# BC Inventory Management - Automated Installation Script
# Run as: curl -sSL https://raw.githubusercontent.com/zv20/bcinv/main/install.sh | sudo bash

set -e

echo "====================================="
echo "BC Inventory Management - Installer"
echo "====================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Error: Please run as root (use sudo)"
    exit 1
fi

echo "[1/7] Installing system dependencies..."
apt update
apt install -y postgresql postgresql-contrib nodejs npm git curl

echo ""
echo "[2/7] Setting up database..."
DB_PASSWORD=$(openssl rand -base64 24)

sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS bcinv;
DROP USER IF EXISTS bcinv_user;
CREATE DATABASE bcinv;
CREATE USER bcinv_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE bcinv TO bcinv_user;
\q
EOF

echo ""
echo "[3/7] Cloning application..."
rm -rf /opt/bcinv
mkdir -p /opt/bcinv
git clone https://github.com/zv20/bcinv.git /opt/bcinv
cd /opt/bcinv

echo ""
echo "[4/7] Installing Node.js dependencies..."
npm install --production

echo ""
echo "[5/7] Creating database schema..."
sudo -u postgres psql -d bcinv -f database/schema.sql

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

cat > /etc/systemd/system/bcinv-api.service << 'EOF'
[Unit]
Description=BC Inventory Management API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/bcinv
EnvironmentFile=/opt/bcinv/.env
ExecStart=/usr/bin/node /opt/bcinv/src/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo ""
echo "[7/7] Starting service..."
systemctl daemon-reload
systemctl enable bcinv-api
systemctl start bcinv-api

sleep 3

if systemctl is-active --quiet bcinv-api; then
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo ""
    echo "====================================="
    echo "✓ INSTALLATION SUCCESSFUL!"
    echo "====================================="
    echo ""
    echo "Your BC Inventory Management System is ready!"
    echo ""
    echo "Access URL: http://$SERVER_IP:3000"
    echo ""
    echo "Database credentials saved to: /opt/bcinv/.env"
    echo "Database password: $DB_PASSWORD"
    echo ""
    echo "Default data includes:"
    echo "  • 4 departments (General, Food, Beverages, Supplies)"
    echo "  • 3 warehouse locations"
    echo ""
    echo "Useful commands:"
    echo "  • Check status: sudo systemctl status bcinv-api"
    echo "  • View logs: sudo journalctl -u bcinv-api -f"
    echo "  • Restart: sudo systemctl restart bcinv-api"
    echo ""
else
    echo ""
    echo "✗ Installation completed but service failed to start"
    echo "Check logs: sudo journalctl -u bcinv-api -n 50"
    exit 1
fi
