#!/bin/bash

set -e

echo "🔄 BCInv - Update System"
echo "========================"
echo ""

CURRENT_DIR=$(pwd)

# Verify we're in correct directory
if [ ! -f "server.js" ]; then
    echo "❌ server.js not found. Wrong directory?"
    exit 1
fi

echo "📍 Location: $CURRENT_DIR"
echo ""

echo "========================================"
echo "🔍 Step 1: Checking for updates..."
echo "========================================"
echo ""

echo "📡 Fetching latest changes from GitHub..."
git fetch origin main

if [ $? -ne 0 ]; then
    echo "❌ Failed to fetch updates"
    exit 1
fi

# Check if updates available
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
    echo ""
    echo "✅ Already up to date!"
    echo ""
    exit 0
fi

echo "✅ Updates available!"
echo ""

# Get current version
if command -v node &> /dev/null && [ -f "package.json" ]; then
    CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
    echo "📊 Current Version: v$CURRENT_VERSION"
fi

echo ""
echo "========================================"
echo "📋 Step 2: What's New"
echo "========================================"
echo ""

echo "Recent changes:"
git log --oneline --no-merges HEAD..origin/main | head -10 | sed 's/^/  • /'

echo ""
echo "========================================"
echo "⚠️  Step 3: Safety Check"
echo "========================================"
echo ""

# Show uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  WARNING: Uncommitted local changes:"
    git status --short | head -5
    echo ""
    echo "These may be overwritten during update."
    echo ""
fi

echo "🚨 IMPORTANT:"
echo ""
echo "  1. Database backup will be created automatically"
echo "  2. Services will restart (brief downtime)"
echo "  3. Database migrations will run if needed"
echo "  4. You can rollback if issues occur"
echo ""
echo "  Backup location: ./backups/"
echo ""

# Determine sudo usage
if [ "$EUID" -eq 0 ]; then
    SUDO_CMD=""
else
    SUDO_CMD="sudo"
fi

echo "========================================"
echo "❓ Step 4: Confirm Update"
echo "========================================"
echo ""

read -p "Continue with update? [y/N] " -n 1 -r
echo ""
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Update cancelled"
    echo ""
    echo "To update later, run: bash update.sh"
    echo ""
    exit 0
fi

echo "========================================"
echo "🚀 Step 5: Applying Update"
echo "========================================"
echo ""

# Create database backup
echo "💾 Creating database backup..."
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Load database credentials from .env
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

DB_NAME=${DB_NAME:-bcinv}
DB_USER=${DB_USER:-bcinv_user}

if command -v pg_dump &> /dev/null; then
    PGPASSWORD=$DB_PASSWORD pg_dump -U $DB_USER -h localhost $DB_NAME > "$BACKUP_FILE"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup created: $(basename $BACKUP_FILE) ($BACKUP_SIZE)"
else
    echo "⚠️  pg_dump not found, skipping backup"
fi

echo ""

# Pull changes
echo "📥 Pulling code updates..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Failed to pull changes"
    exit 1
fi

echo "✓ Code updated"
echo ""

# Update dependencies if package.json changed
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
    echo "📦 package.json changed - Installing dependencies..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "❌ Dependency installation failed"
        echo ""
        echo "Rollback: git reset --hard $LOCAL"
        exit 1
    fi
    
    echo "✓ Dependencies updated"
else
    echo "✓ No dependency updates needed"
fi

echo ""

# Run migrations
if git diff HEAD@{1} HEAD --name-only | grep -q "migrations/"; then
    echo "🗄️  Running database migrations..."
    npm run migrate
    
    if [ $? -ne 0 ]; then
        echo "❌ Migration failed"
        echo ""
        echo "Rollback: git reset --hard $LOCAL && npm install"
        exit 1
    fi
    
    echo "✓ Migrations completed"
else
    echo "✓ No database migrations needed"
fi

echo ""

# Restart services
echo "🔄 Restarting services..."

if [ -n "$SUDO_CMD" ]; then
    $SUDO_CMD systemctl restart bcinv-api
    $SUDO_CMD systemctl restart bcinv-worker
else
    systemctl restart bcinv-api
    systemctl restart bcinv-worker
fi

if [ $? -eq 0 ]; then
    echo "✓ Services restarted"
else
    echo "❌ Failed to restart services"
    echo "Manual restart: sudo systemctl restart bcinv-api bcinv-worker"
fi

echo ""
echo "Waiting for services to start..."
sleep 3
echo ""

echo "========================================"
echo "✅ Update Complete!"
echo "========================================"
echo ""

# Show service status
echo "📊 Service Status:"
if [ -n "$SUDO_CMD" ]; then
    $SUDO_CMD systemctl status bcinv-api --no-pager -l | head -10
    echo ""
    $SUDO_CMD systemctl status bcinv-worker --no-pager -l | head -10
else
    systemctl status bcinv-api --no-pager -l | head -10
    echo ""
    systemctl status bcinv-worker --no-pager -l | head -10
fi

echo ""
echo "💾 Backup: $(basename $BACKUP_FILE)"
echo ""
echo "🔗 Quick Actions:"
echo "  • Check logs: journalctl -u bcinv-api -f"
echo "  • View app: http://localhost:3000"
echo "  • Rollback: git reset --hard $LOCAL && npm install && sudo systemctl restart bcinv-api bcinv-worker"
echo ""
echo "🎉 Enjoy the updates!"
echo ""
