#!/bin/bash

# BC Inventory - Update from Proxmox Host
# Run this on your Proxmox host to update BC Inventory in a container

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "═══════════════════════════════════════════════════════════"
echo "    📦 BC Inventory - Host Update Manager"
echo "═══════════════════════════════════════════════════════════"
echo -e "${NC}"
echo

# Check if running on Proxmox
if ! command -v pct &> /dev/null; then
    echo -e "${RED}✖ Error: This script must be run on a Proxmox host${NC}"
    exit 1
fi

# Get container ID
if [ -z "$1" ]; then
    echo -e "${YELLOW}Available BC Inventory containers:${NC}"
    pct list | grep -i "bcinv\|bc-inv\|inventory" || echo "  No containers found"
    echo
    read -p "Enter container ID: " CTID
else
    CTID="$1"
fi

# Validate container exists
if ! pct status $CTID &>/dev/null; then
    echo -e "${RED}✖ Container $CTID does not exist${NC}"
    exit 1
fi

# Check if container is running
if ! pct status $CTID | grep -q "running"; then
    echo -e "${YELLOW}Container $CTID is not running${NC}"
    read -p "Start it now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pct start $CTID
        echo -e "${YELLOW}Waiting for container to boot...${NC}"
        sleep 5
    else
        exit 1
    fi
fi

echo -e "${GREEN}✓ Container $CTID is running${NC}"
echo

# Download update script if it doesn't exist in container
echo -e "${YELLOW}📥 Fetching latest update script...${NC}"
UPDATE_SCRIPT_URL="https://raw.githubusercontent.com/zv20/bcinv/main/update.sh"

if curl -fsSL "$UPDATE_SCRIPT_URL" -o /tmp/bcinv_update.sh; then
    echo -e "${GREEN}✓ Update script downloaded${NC}"
else
    echo -e "${RED}✖ Failed to download update script${NC}"
    exit 1
fi

# Push update script to container
echo -e "${YELLOW}📤 Transferring update script to container...${NC}"
pct push $CTID /tmp/bcinv_update.sh /tmp/update.sh
pct exec $CTID -- chmod +x /tmp/update.sh

# Run update
echo -e "${BLUE}🔄 Running update in container $CTID...${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo

if pct exec $CTID -- /tmp/update.sh; then
    echo
    echo -e "${GREEN}✅ Update completed successfully!${NC}"
    
    # Get container IP
    CONTAINER_IP=$(pct exec $CTID -- hostname -I | awk '{print $1}' 2>/dev/null || echo "")
    if [ -n "$CONTAINER_IP" ]; then
        echo -e "${BLUE}Access BC Inventory: ${CYAN}http://${CONTAINER_IP}:3000${NC}"
    fi
else
    echo -e "${RED}✖ Update failed${NC}"
    echo -e "${YELLOW}Check logs: pct exec $CTID -- journalctl -u bcinv-api -n 50${NC}"
    exit 1
fi

# Cleanup
rm -f /tmp/bcinv_update.sh
pct exec $CTID -- rm -f /tmp/update.sh

echo