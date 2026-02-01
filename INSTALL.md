# BC Inventory Management - Fresh Installation Guide

## System Requirements
- Ubuntu 20.04+ or Debian 11+
- 2GB RAM minimum
- PostgreSQL 12+
- Node.js 18+

## Quick Installation

Run this one command as root:

```bash
curl -sSL https://raw.githubusercontent.com/zv20/bcinv/main/install.sh | sudo bash
```

## Manual Installation

### 1. Install Dependencies

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib nodejs npm git
```

### 2. Setup Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE bcinv;
CREATE USER bcinv_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE bcinv TO bcinv_user;
\q
```

### 3. Clone and Setup Application

```bash
# Clone repository
sudo mkdir -p /opt/bcinv
sudo git clone https://github.com/zv20/bcinv.git /opt/bcinv
cd /opt/bcinv

# Install Node dependencies
npm install

# Setup database schema
sudo -u postgres psql -d bcinv -f database/schema.sql
```

### 4. Configure Application

```bash
# Create environment file
cat > .env << 'EOF'
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bcinv
DB_USER=bcinv_user
DB_PASSWORD=your_secure_password_here
PORT=3000
EOF

# Secure the file
chmod 600 .env
```

### 5. Create Systemd Service

```bash
sudo cat > /etc/systemd/system/bcinv-api.service << 'EOF'
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

sudo systemctl daemon-reload
sudo systemctl enable bcinv-api
sudo systemctl start bcinv-api
```

### 6. Verify Installation

```bash
# Check service status
sudo systemctl status bcinv-api

# Test API
curl http://localhost:3000/api/dashboard

# View logs
sudo journalctl -u bcinv-api -f
```

### 7. Access Application

Open browser: `http://your-server-ip:3000`

## Default Data

The installation includes:
- 4 default departments: General, Food, Beverages, Supplies
- 3 default locations: Warehouse A, Warehouse B, Retail Floor

You can modify these in the Settings menu.

## Firewall Configuration

If using UFW:

```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

## Backup

Backup database:

```bash
sudo -u postgres pg_dump bcinv > bcinv_backup_$(date +%Y%m%d).sql
```

Restore database:

```bash
sudo -u postgres psql -d bcinv < bcinv_backup_YYYYMMDD.sql
```

## Troubleshooting

### Service won't start
```bash
# Check logs
sudo journalctl -u bcinv-api -n 100

# Check database connection
sudo -u postgres psql -d bcinv -c 'SELECT COUNT(*) FROM products;'
```

### Port already in use
```bash
# Find process using port 3000
sudo lsof -i :3000

# Change port in .env file
sudo nano /opt/bcinv/.env
# Set PORT=3001 (or another available port)

# Restart service
sudo systemctl restart bcinv-api
```

## Uninstall

```bash
# Stop service
sudo systemctl stop bcinv-api
sudo systemctl disable bcinv-api
sudo rm /etc/systemd/system/bcinv-api.service

# Remove database
sudo -u postgres psql -c 'DROP DATABASE bcinv;'
sudo -u postgres psql -c 'DROP USER bcinv_user;'

# Remove application
sudo rm -rf /opt/bcinv
```

## Support

For issues, check:
1. System logs: `sudo journalctl -u bcinv-api -n 50`
2. PostgreSQL logs: `sudo tail -f /var/log/postgresql/postgresql-*.log`
3. Ensure PostgreSQL is running: `sudo systemctl status postgresql`
