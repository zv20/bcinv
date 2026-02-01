#!/bin/bash

echo "🚀 BCInv - Grocery Inventory Setup"
echo "===================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs root privileges"
    echo "Running: sudo $0"
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

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

if [ $? -ne 0 ]; then
    echo "❌ Failed to update system packages"
    exit 1
fi

echo "✓ System packages updated"
echo ""

# Install required dependencies
echo "📦 Installing system packages..."
apt install -y curl git ca-certificates gnupg postgresql postgresql-contrib

if [ $? -ne 0 ]; then
    echo "❌ Failed to install system packages"
    exit 1
fi

echo "✓ System packages installed"
echo ""

# Install Node.js 20 LTS
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "ℹ️  Node.js already installed: $NODE_VERSION"
    
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        echo "⚠️  Node.js version too old (need v18+). Installing newer version..."
        INSTALL_NODE=true
    else
        echo "✓ Node.js version is acceptable"
        INSTALL_NODE=false
    fi
else
    echo "📦 Node.js not found. Installing Node.js 20 LTS..."
    INSTALL_NODE=true
fi

echo ""

if [ "$INSTALL_NODE" = true ]; then
    echo "📦 Installing Node.js 20 LTS..."
    
    apt remove -y nodejs npm
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Node.js"
        exit 1
    fi
    
    echo "✓ Node.js installed: $(node --version)"
    echo "✓ npm installed: $(npm --version)"
else
    echo "✓ Using existing Node.js installation"
fi

echo ""

# Configure PostgreSQL
echo "🗄️  Configuring PostgreSQL..."

systemctl start postgresql
systemctl enable postgresql

# Generate secure password if not provided
DB_PASSWORD=${DB_PASSWORD:-$(openssl rand -base64 32)}

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE bcinv;
CREATE USER bcinv_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE bcinv TO bcinv_user;
\c bcinv
GRANT ALL ON SCHEMA public TO bcinv_user;
EOF

if [ $? -ne 0 ]; then
    echo "⚠️  Database may already exist, continuing..."
fi

echo "✓ PostgreSQL configured"
echo ""

# Configure PostgreSQL for LXC container access
PG_VERSION=$(ls /etc/postgresql/ | head -1)
PG_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

if [ -f "$PG_CONF" ]; then
    cp "$PG_CONF" "$PG_CONF.bak"
    cp "$PG_HBA" "$PG_HBA.bak"
    
    # Allow listening on all interfaces
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
    
    # Add authentication for local network
    echo "host    all             all             10.0.0.0/8              md5" >> "$PG_HBA"
    echo "host    all             all             172.16.0.0/12           md5" >> "$PG_HBA"
    echo "host    all             all             192.168.0.0/16          md5" >> "$PG_HBA"
    
    systemctl restart postgresql
    echo "✓ PostgreSQL configured for network access"
fi

echo ""

# Install application dependencies
echo "📦 Installing application dependencies..."

if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Are you in the correct directory?"
    exit 1
fi

npm install

if [ $? -ne 0 ]; then
    echo "⚠️  Retrying with clean install..."
    npm cache clean --force
    rm -rf node_modules package-lock.json
    npm install
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

echo "✓ Dependencies installed"
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
LOG_LEVEL=info
EOF
    chmod 600 .env
    echo "✓ Environment file created"
    echo "⚠️  Database password: $DB_PASSWORD"
    echo "⚠️  (Saved in .env file)"
else
    echo "✓ Using existing .env file"
fi

echo ""

# Create directories
echo "📁 Creating directories..."
mkdir -p logs backups
chmod 755 logs backups
echo "✓ Directories created"
echo ""

# Run database migrations
echo "🗄️  Running database migrations..."
npm run migrate

if [ $? -ne 0 ]; then
    echo "❌ Migration failed"
    exit 1
fi

echo "✓ Database schema created"
echo ""

# Create systemd services
CURRENT_DIR=$(pwd)
CURRENT_USER=$(logname 2>/dev/null || echo $SUDO_USER || echo "root")

echo "⚙️  Creating systemd services..."

# API service
cat > /etc/systemd/system/bcinv-api.service << EOF
[Unit]
Description=BCInv API Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$CURRENT_DIR
ExecStart=/usr/bin/node $CURRENT_DIR/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Worker service
cat > /etc/systemd/system/bcinv-worker.service << EOF
[Unit]
Description=BCInv Background Worker
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$CURRENT_DIR
ExecStart=/usr/bin/node $CURRENT_DIR/worker.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable bcinv-api.service
systemctl enable bcinv-worker.service

echo "✓ Systemd services created"
echo ""

# Get network info
HOSTNAME=$(hostname)
IP_ADDRESS=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ Setup Complete!"
echo "===================================="
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
echo "  • Password: (see .env file)"
echo ""

read -p "Start services now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    systemctl start bcinv-api
    systemctl start bcinv-worker
    sleep 2
    
    if systemctl is-active --quiet bcinv-api && systemctl is-active --quiet bcinv-worker; then
        echo "✅ Services started successfully!"
        echo ""
        echo "🌐 Visit: http://$IP_ADDRESS:3000"
    else
        echo "❌ Failed to start services. Check logs:"
        echo "   journalctl -u bcinv-api -n 50"
        echo "   journalctl -u bcinv-worker -n 50"
    fi
else
    echo "ℹ️  Services not started. Start manually:"
    echo "   systemctl start bcinv-api bcinv-worker"
fi

echo ""
