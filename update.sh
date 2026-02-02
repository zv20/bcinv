#!/bin/bash

# BC Inventory - Application Update Script
# Run this inside the container to update to the latest version

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${CYAN}"
echo "═══════════════════════════════════════════════════════════"
echo "    📦 BC Inventory - Update Manager"
echo "═══════════════════════════════════════════════════════════"
echo -e "${NC}"
echo

# Check if running inside container
if [ ! -d "/opt/bcinv" ]; then
    echo -e "${RED}✖ Error: /opt/bcinv not found!${NC}"
    echo -e "${YELLOW}This script must be run inside the BC Inventory container${NC}"
    exit 1
fi

cd /opt/bcinv

# Get current info
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
CURRENT_MESSAGE=$(git log -1 --pretty=%B 2>/dev/null | head -1 || echo "unknown")

echo -e "${BLUE}📋 Current Status${NC}"
echo -e "  Branch: ${MAGENTA}${CURRENT_BRANCH}${NC}"
echo -e "  Commit: ${MAGENTA}${CURRENT_COMMIT}${NC}"
echo -e "  Message: ${MAGENTA}${CURRENT_MESSAGE}${NC}"

# Check service status
API_STATUS=$(systemctl is-active bcinv-api 2>/dev/null || echo "inactive")
WORKER_EXISTS=$(systemctl list-unit-files | grep -q "bcinv-worker.service" && echo "yes" || echo "no")
if [ "$WORKER_EXISTS" = "yes" ]; then
    WORKER_STATUS=$(systemctl is-active bcinv-worker 2>/dev/null || echo "inactive")
else
    WORKER_STATUS="not installed"
fi

echo -e "  API Service: ${MAGENTA}${API_STATUS}${NC}"
echo -e "  Worker Service: ${MAGENTA}${WORKER_STATUS}${NC}"
echo

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted local changes${NC}"
    echo -e "${YELLOW}These will be overwritten by the update${NC}"
    git status --short
    echo
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Update cancelled${NC}"
        exit 0
    fi
fi

echo -e "${YELLOW}📥 Fetching latest changes from GitHub...${NC}"
git fetch origin

LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ $LOCAL = $REMOTE ]; then
    echo -e "${GREEN}✓ Already up to date!${NC}"
    echo -e "${BLUE}Current version is the latest${NC}"
    exit 0
fi

echo -e "${GREEN}📦 New changes available${NC}"
echo -e "${BLUE}Changes since current version:${NC}"
git log --oneline HEAD..@{u} | head -10
echo

read -p "Proceed with update? (Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}Update cancelled${NC}"
    exit 0
fi

echo
echo -e "${BLUE}💾 Creating database backup...${NC}"
BACKUP_FILE="/tmp/bcinv_backup_$(date +%Y%m%d_%H%M%S).sql"
if su - postgres -c "pg_dump bcinv > $BACKUP_FILE" 2>/dev/null; then
    echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}⚠️  Backup failed (continuing anyway)${NC}"
fi

echo -e "${YELLOW}🛑 Stopping services...${NC}"
# Stop API service (required)
systemctl stop bcinv-api
# Stop worker service if it exists
if [ "$WORKER_EXISTS" = "yes" ]; then
    systemctl stop bcinv-worker 2>/dev/null || echo -e "${YELLOW}  Worker service already stopped${NC}"
fi
echo -e "${GREEN}✓ Services stopped${NC}"

echo -e "${YELLOW}⬇️  Pulling latest code...${NC}"
if git pull origin $CURRENT_BRANCH; then
    echo -e "${GREEN}✓ Code updated${NC}"
else
    echo -e "${RED}✖ Failed to pull changes${NC}"
    echo -e "${YELLOW}Restarting services...${NC}"
    systemctl start bcinv-api
    if [ "$WORKER_EXISTS" = "yes" ]; then
        systemctl start bcinv-worker 2>/dev/null || true
    fi
    exit 1
fi

echo -e "${YELLOW}📦 Checking for dependency updates...${NC}"
if npm install --production; then
    echo -e "${GREEN}✓ Dependencies updated${NC}"
else
    echo -e "${RED}✖ Dependency update failed${NC}"
    exit 1
fi

echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
if [ -d "migrations" ]; then
    MIGRATION_COUNT=0
    for migration in migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo -e "  ${BLUE}Running: $(basename $migration)${NC}"
            if su - postgres -c "psql -d bcinv -f $migration" 2>/dev/null; then
                echo -e "  ${GREEN}✓ Success${NC}"
                ((MIGRATION_COUNT++))
            else
                echo -e "  ${YELLOW}⚠️  Already applied or failed${NC}"
            fi
        fi
    done
    if [ $MIGRATION_COUNT -gt 0 ]; then
        echo -e "${GREEN}✓ Applied $MIGRATION_COUNT migration(s)${NC}"
    else
        echo -e "${BLUE}No new migrations to apply${NC}"
    fi
else
    echo -e "${BLUE}No migrations directory found${NC}"
fi

echo -e "${YELLOW}🔄 Starting services...${NC}"
# Start API service (required)
systemctl start bcinv-api
# Start worker service if it exists
if [ "$WORKER_EXISTS" = "yes" ]; then
    systemctl start bcinv-worker 2>/dev/null || echo -e "${YELLOW}  Worker service not started (optional)${NC}"
fi
echo -e "${GREEN}✓ Services started${NC}"

echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 5

# Verify services
API_STATUS=$(systemctl is-active bcinv-api 2>/dev/null)
if [ "$WORKER_EXISTS" = "yes" ]; then
    WORKER_STATUS=$(systemctl is-active bcinv-worker 2>/dev/null)
else
    WORKER_STATUS="not installed"
fi

# Check if API is running (required)
if [ "$API_STATUS" = "active" ]; then
    echo -e "${GREEN}✓ API service started successfully${NC}"
    # Worker is optional, just inform
    if [ "$WORKER_EXISTS" = "yes" ]; then
        if [ "$WORKER_STATUS" = "active" ]; then
            echo -e "${GREEN}✓ Worker service started successfully${NC}"
        else
            echo -e "${YELLOW}⚠️  Worker service not active (this is optional)${NC}"
        fi
    else
        echo -e "${BLUE}ℹ️  Worker service not installed (See Issue #2)${NC}"
    fi
else
    echo -e "${RED}✖ API service startup failed${NC}"
    echo -e "${YELLOW}API Status: $API_STATUS${NC}"
    echo -e "${YELLOW}Check logs: journalctl -u bcinv-api -n 50${NC}"
    exit 1
fi

echo
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Update Complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo

# Get new version info
NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null)
NEW_MESSAGE=$(git log -1 --pretty=%B 2>/dev/null | head -1)
IP=$(hostname -I | awk '{print $1}')

echo -e "${BLUE}📊 New Status${NC}"
echo -e "  Branch: ${MAGENTA}${CURRENT_BRANCH}${NC}"
echo -e "  Commit: ${MAGENTA}${NEW_COMMIT}${NC}"
echo -e "  Message: ${MAGENTA}${NEW_MESSAGE}${NC}"
if [ "$API_STATUS" = "active" ]; then
    echo -e "  API Service: ${GREEN}${API_STATUS}${NC}"
else
    echo -e "  API Service: ${YELLOW}${API_STATUS}${NC}"
fi
if [ "$WORKER_EXISTS" = "yes" ]; then
    if [ "$WORKER_STATUS" = "active" ]; then
        echo -e "  Worker Service: ${GREEN}${WORKER_STATUS}${NC}"
    else
        echo -e "  Worker Service: ${YELLOW}${WORKER_STATUS}${NC}"
    fi
else
    echo -e "  Worker Service: ${BLUE}${WORKER_STATUS}${NC}"
fi
echo
echo -e "${GREEN}💡 Access your application:${NC}"
echo -e "  ${CYAN}http://${IP}:3000${NC}"
echo
echo -e "${BLUE}💡 Useful commands:${NC}"
echo -e "  View logs: ${CYAN}journalctl -u bcinv-api -f${NC}"
if [ "$WORKER_EXISTS" = "yes" ]; then
    echo -e "  Restart: ${CYAN}systemctl restart bcinv-api bcinv-worker${NC}"
    echo -e "  Status: ${CYAN}systemctl status bcinv-api bcinv-worker${NC}"
else
    echo -e "  Restart: ${CYAN}systemctl restart bcinv-api${NC}"
    echo -e "  Status: ${CYAN}systemctl status bcinv-api${NC}"
fi
echo
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo