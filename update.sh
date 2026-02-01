#!/bin/bash

set -e

echo "🔄 BC Inventory System - Update"
echo "====================================="
echo ""

CURRENT_DIR=$(pwd)

# Verify correct directory
if [ ! -f "server.js" ]; then
    echo "❌ server.js not found. Wrong directory?"
    exit 1
fi

echo "📍 Location: $CURRENT_DIR"
echo ""

# Load environment for DB credentials
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "========================================"
echo "🔍 Step 1: Checking for updates..."
echo "========================================"
echo ""

# Fetch updates without applying
echo "📡 Fetching latest from GitHub..."
git fetch origin main

if [ $? -ne 0 ]; then
    echo "❌ Failed to fetch updates"
    exit 1
fi

# Compare local vs remote
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
echo "  3. Dependencies will be updated if needed"
echo "  4. Database migrations will run"
echo "  5. Rollback command provided if issues occur"
echo ""
echo "  Backup location: ./backups/"
echo ""

# Determine if root/sudo needed
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
    echo "To update later: bash update.sh"
    echo ""
    exit 0
fi

echo "========================================"
echo "🚀 Step 5: Applying Update"
echo "========================================"
echo ""

# Create backup directory
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"

echo "💾 Creating PostgreSQL backup..."

if [ -n "$DB_PASSWORD" ] && [ -n "$DB_USER" ] && [ -n "$DB_NAME" ]; then
    PGPASSWORD=$DB_PASSWORD pg_dump -h ${DB_HOST:-localhost} -U $DB_USER -d $DB_NAME > "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo "✅ Backup created: $(basename $BACKUP_FILE) ($BACKUP_SIZE)"
    else
        echo "❌ Backup failed! Aborting update."
        exit 1
    fi
else
    echo "⚠️  Database credentials not found in .env"
    echo "Proceeding without backup (not recommended)"
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""

# Pull changes
echo "📥 Pulling code updates..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Failed to pull changes"
    echo ""
    echo "Rollback: git reset --hard $LOCAL"
    exit 1
fi

echo "✅ Code updated"
echo ""

# Update dependencies if package.json changed
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json\|package-lock.json"; then
    echo "📦 Updating dependencies..."
    npm install --production
    
    if [ $? -ne 0 ]; then
        echo "❌ Dependency installation failed"
        echo ""
        echo "Rollback:"
        echo "  git reset --hard $LOCAL"
        echo "  npm install"
        exit 1
    fi
    
    echo "✓ Dependencies updated"
else
    echo "✓ No dependency updates needed"
fi

echo ""

# Run migrations if schema changed
if git diff HEAD@{1} HEAD --name-only | grep -q "database/\|migrations/"; then
    echo "🗄️  Running database migrations..."
    
    if [ -f "migrations/migrate.js" ]; then
        node migrations/migrate.js
    elif [ -f "database/schema.sql" ]; then
        PGPASSWORD=$DB_PASSWORD psql -h ${DB_HOST:-localhost} -U $DB_USER -d $DB_NAME -f database/schema.sql
    fi
    
    echo "✓ Migrations complete"
else
    echo "✓ No database changes"
fi

echo ""

# Restart services
echo "🔄 Restarting services..."
echo ""

if [ -n "$SUDO_CMD" ]; then
    $SUDO_CMD systemctl restart bcinv-api
    $SUDO_CMD systemctl restart bcinv-worker
else
    systemctl restart bcinv-api
    systemctl restart bcinv-worker
fi

if [ $? -ne 0 ]; then
    echo "❌ Failed to restart services"
    echo ""
    echo "Manual restart:"
    if [ -n "$SUDO_CMD" ]; then
        echo "  sudo systemctl restart bcinv-api bcinv-worker"
    else
        echo "  systemctl restart bcinv-api bcinv-worker"
    fi
    exit 1
fi

echo "✅ Services restarted"
echo ""

# Wait for services
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
echo "💾 Backup saved: $(basename $BACKUP_FILE)"
echo ""
echo "🔗 Quick Actions:"
echo "  • View logs: journalctl -u bcinv-api -f"
echo "  • Check app: curl http://localhost:3000"
if [ -n "$BACKUP_FILE" ]; then
    echo "  • Rollback: git reset --hard $LOCAL && npm install"
    echo "             && PGPASSWORD=\$DB_PASSWORD psql -U $DB_USER -d $DB_NAME < $BACKUP_FILE"
    if [ -n "$SUDO_CMD" ]; then
        echo "             && sudo systemctl restart bcinv-api bcinv-worker"
    else
        echo "             && systemctl restart bcinv-api bcinv-worker"
    fi
fi
echo ""
echo "🎉 Update successful!"
echo ""
