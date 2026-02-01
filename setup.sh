#!/bin/bash

echo "🚀 BC Inventory System - LXC Container Setup"
echo "================================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs to be run as root (use sudo)"
    exec sudo "$0" "$@"
fi

echo "✓ Running with root privileges"
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo "❌ Cannot detect OS. This script supports Debian/Ubuntu."
    exit 1
fi

echo "📋 Detected OS: $OS $VERSION"
echo ""

# Update system packages
echo "📦 Updating system packages..."
apt update && apt upgrade -y

if [ $? -ne 0 ]; then
    echo "❌ Failed to update system packages"
    exit 1
fi

echo "✓ System packages updated"
echo ""

# Install required dependencies
echo "📦 Installing required system packages..."
apt install -y curl git ca-certificates gnupg postgresql postgresql-contrib

if [ $? -ne 0 ]; then
    echo "❌ Failed to install system packages"
    exit 1
fi

echo "✓ System packages installed"
echo ""

# Install Node.js 20 LTS
echo "📦 Installing Node.js 20 LTS..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "ℹ️  Node.js is already installed: $NODE_VERSION"
    
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        echo "⚠️  Node.js version is too old (need v18+). Installing newer version..."
        INSTALL_NODE=true
    else
        echo "✓ Node.js version is acceptable"
        INSTALL_NODE=false
    fi
else
    echo "📦 Node.js not found. Installing..."
    INSTALL_NODE=true
fi

if [ "$INSTALL_NODE" = true ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Node.js"
        exit 1
    fi
    
    echo "✓ Node.js installed: $(node --version)"
    echo "✓ npm installed: $(npm --version)"
fi

echo ""

# Configure PostgreSQL
echo "🗄️  Configuring PostgreSQL..."

systemctl start postgresql
systemctl enable postgresql

echo "✓ PostgreSQL service started"
echo ""

# Generate secure password
DB_PASSWORD=$(openssl rand -base64 24)

# Create database and user
echo "📊 Creating database and user..."
sudo -u postgres psql << EOF
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

if [ $? -ne 0 ]; then
    echo "❌ Failed to create database"
    exit 1
fi

echo "✓ Database and user created"
echo ""

# Configure PostgreSQL for network access (optional, for remote management)
PG_VERSION=$(ls /etc/postgresql/ | head -1)
PG_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

if [ -f "$PG_CONF" ]; then
    cp "$PG_CONF" "$PG_CONF.bak"
    cp "$PG_HBA" "$PG_HBA.bak"
    
    # Allow listening on all interfaces
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
    
    # Add authentication for private networks
    if ! grep -q "host.*all.*all.*10.0.0.0/8" "$PG_HBA"; then
        echo "host    all             all             10.0.0.0/8              md5" >> "$PG_HBA"
        echo "host    all             all             172.16.0.0/12           md5" >> "$PG_HBA"
        echo "host    all             all             192.168.0.0/16          md5" >> "$PG_HBA"
    fi
    
    systemctl restart postgresql
    echo "✓ PostgreSQL configured for network access"
fi

echo ""

# Create .env file
echo "📝 Creating environment configuration..."

if [ ! -f ".env" ]; then
    cat > .env << EOF
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=bcinv
DB_USER=bcinv_user
DB_PASSWORD=$DB_PASSWORD

EXPIRY_WARNING_DAYS=7
LOG_LEVEL=info
EOF

    chmod 600 .env
    echo "✓ Environment file created with secure password"
else
    echo "ℹ️  .env file already exists, skipping"
fi

echo ""

# Install Node.js dependencies
echo "📦 Installing application dependencies..."

if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Are you in the correct directory?"
    exit 1
fi

npm install --production

if [ $? -ne 0 ]; then
    echo "⚠️  Retrying with npm cache clean..."
    npm cache clean --force
    rm -rf node_modules package-lock.json
    npm install --production
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

echo "✓ Dependencies installed"
echo ""

# Run database migrations
echo "🗄️  Running database migrations..."

# Import schema directly
PGPASSWORD=$DB_PASSWORD psql -h localhost -U bcinv_user -d bcinv -f database/schema.sql

if [ $? -eq 0 ]; then
    echo "✓ Database schema created"
else
    echo "⚠️  Schema creation had warnings (may be normal if tables exist)"
fi

echo ""

# Create systemd services
CURRENT_DIR=$(pwd)
CURRENT_USER=$(logname 2>/dev/null || echo $SUDO_USER || echo "root")

echo "⚙️  Creating systemd services..."

# API Service
cat > /etc/systemd/system/bcinv-api.service << EOF
[Unit]
Description=BC Inventory API Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$CURRENT_DIR
ExecStart=/usr/bin/node $CURRENT_DIR/server.js
Restart=always
RestartSec=10
EnvironmentFile=$CURRENT_DIR/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Worker Service
cat > /etc/systemd/system/bcinv-worker.service << EOF
[Unit]
Description=BC Inventory Background Worker
After=network.target postgresql.service bcinv-api.service
Requires=postgresql.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$CURRENT_DIR
ExecStart=/usr/bin/node $CURRENT_DIR/worker.js
Restart=always
RestartSec=10
EnvironmentFile=$CURRENT_DIR/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable bcinv-api.service
systemctl enable bcinv-worker.service

echo "✓ Systemd services created and enabled"
echo ""

# Create directories
mkdir -p logs backups
chmod 755 logs backups

echo "✓ Created logs and backups directories"
echo ""

# Get network info
HOSTNAME=$(hostname)
IP_ADDRESS=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ Setup Complete!"
echo "================================================"
echo ""
echo "📊 Summary:"
echo "  • Node.js: $(node --version)"
echo "  • PostgreSQL: Running"
echo "  • Database: bcinv"
echo "  • Location: $CURRENT_DIR"
echo "  • Services: bcinv-api, bcinv-worker"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Start services:"
echo "   systemctl start bcinv-api"
echo "   systemctl start bcinv-worker"
echo ""
echo "2. Check status:"
echo "   systemctl status bcinv-api"
echo "   systemctl status bcinv-worker"
echo ""
echo "3. View logs:"
echo "   journalctl -u bcinv-api -f"
echo "   journalctl -u bcinv-worker -f"
echo ""
echo "📡 Access:"
echo "  • Local: http://localhost:3000"
echo "  • Network: http://$IP_ADDRESS:3000"
echo ""
echo "🔐 Database:"
echo "  • Host: localhost"
echo "  • Database: bcinv"
echo "  • User: bcinv_user"
echo "  • Password: (saved in .env file)"
echo ""
echo "================================================"
echo ""

read -p "Start services now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    systemctl start bcinv-api
    systemctl start bcinv-worker
    sleep 2
    
    echo ""
    echo "Service Status:"
    systemctl status bcinv-api --no-pager -l | head -10
    echo ""
    systemctl status bcinv-worker --no-pager -l | head -10
    echo ""
    echo "✅ Services started! Visit: http://$IP_ADDRESS:3000"
else
    echo "ℹ️  Services not started. Start manually:"
    echo "   systemctl start bcinv-api bcinv-worker"
fi

echo ""
