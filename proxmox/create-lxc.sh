#!/bin/bash

# BC Inventory - Proxmox LXC Container Creation Script
# Run this script on your Proxmox host to create an LXC container for BC Inventory

set -e

echo "═══════════════════════════════════════════════"
echo "  BC Inventory - LXC Container Creator"
echo "═══════════════════════════════════════════════"
echo ""

# Configuration
CT_ID=""  # Will prompt if empty
CT_NAME="bcinv"
CT_HOSTNAME="bcinv"
TEMPLATE="debian-12-standard_12.7-1_amd64.tar.zst"
STORAGE="local-lxc"  # Change to your storage name
ROOTFS_SIZE="16"  # GB
CORES="4"
MEMORY="4096"  # MB
SWAP="512"  # MB
BRIDGE="vmbr0"
IP_MODE="dhcp"  # or "static"
STATIC_IP=""  # e.g., "192.168.1.100/24"
GATEWAY=""  # e.g., "192.168.1.1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running on Proxmox host
if ! command -v pct &> /dev/null; then
    echo -e "${RED}✗ This script must be run on a Proxmox host${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Running on Proxmox host${NC}"
echo ""

# Prompt for container ID if not set
if [ -z "$CT_ID" ]; then
    echo -e "${BLUE}Available container IDs:${NC}"
    pvesh get /cluster/nextid
    echo ""
    read -p "Enter container ID (or press Enter for next available): " CT_ID
    
    if [ -z "$CT_ID" ]; then
        CT_ID=$(pvesh get /cluster/nextid)
        echo -e "${GREEN}Using next available ID: $CT_ID${NC}"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  Container Configuration"
echo "═══════════════════════════════════════════════"
echo "  ID:        $CT_ID"
echo "  Hostname:  $CT_HOSTNAME"
echo "  Template:  $TEMPLATE"
echo "  Storage:   $STORAGE"
echo "  Root FS:   ${ROOTFS_SIZE}GB"
echo "  CPU Cores: $CORES"
echo "  Memory:    ${MEMORY}MB"
echo "  Network:   $BRIDGE ($IP_MODE)"
echo "═══════════════════════════════════════════════"
echo ""

read -p "Proceed with creation? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}✗ Cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Creating LXC container...${NC}"
echo ""

# Check if template exists
if [ ! -f "/var/lib/vz/template/cache/$TEMPLATE" ]; then
    echo -e "${YELLOW}⚠ Template not found, downloading...${NC}"
    pveam download local $TEMPLATE
fi

# Build network configuration
if [ "$IP_MODE" = "static" ] && [ -n "$STATIC_IP" ] && [ -n "$GATEWAY" ]; then
    NET_CONFIG="name=eth0,bridge=$BRIDGE,firewall=1,ip=$STATIC_IP,gw=$GATEWAY,type=veth"
else
    NET_CONFIG="name=eth0,bridge=$BRIDGE,firewall=1,ip=dhcp,type=veth"
fi

# Create container
pct create $CT_ID \
    /var/lib/vz/template/cache/$TEMPLATE \
    --hostname $CT_HOSTNAME \
    --storage $STORAGE \
    --rootfs $STORAGE:$ROOTFS_SIZE \
    --cores $CORES \
    --memory $MEMORY \
    --swap $SWAP \
    --net0 $NET_CONFIG \
    --features keyctl=1,nesting=1 \
    --unprivileged 1 \
    --onboot 1 \
    --start 0 \
    --description "BC Inventory Management System - PostgreSQL + Node.js"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to create container${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Container $CT_ID created${NC}"
echo ""

# Start container
echo -e "${BLUE}Starting container...${NC}"
pct start $CT_ID

# Wait for container to be ready
echo -e "${BLUE}Waiting for container to boot...${NC}"
sleep 5

# Check if container is running
if pct status $CT_ID | grep -q "running"; then
    echo -e "${GREEN}✓ Container started${NC}"
else
    echo -e "${RED}✗ Container failed to start${NC}"
    exit 1
fi

echo ""

# Get container IP
echo -e "${BLUE}Getting container IP address...${NC}"
sleep 5
CT_IP=$(pct exec $CT_ID -- hostname -I | awk '{print $1}')

if [ -n "$CT_IP" ]; then
    echo -e "${GREEN}✓ Container IP: $CT_IP${NC}"
else
    echo -e "${YELLOW}⚠ Could not determine IP (may still be initializing)${NC}"
    CT_IP="<pending>"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ Container Created Successfully!"
echo "═══════════════════════════════════════════════"
echo ""
echo "Container ID: $CT_ID"
echo "Hostname:     $CT_HOSTNAME"
echo "IP Address:   $CT_IP"
echo ""
echo "Next Steps:"
echo ""
echo "1. Enter the container:"
echo "   pct enter $CT_ID"
echo ""
echo "2. Clone BC Inventory:"
echo "   apt update && apt install -y git"
echo "   git clone https://github.com/zv20/bcinv.git /opt/bcinv"
echo "   cd /opt/bcinv"
echo ""
echo "3. Run setup:"
echo "   bash setup.sh"
echo ""
echo "4. Access the application:"
echo "   http://$CT_IP:3000"
echo ""
echo "═══════════════════════════════════════════════"
echo ""
echo "Management Commands:"
echo "  • Enter container:  pct enter $CT_ID"
echo "  • Start:            pct start $CT_ID"
echo "  • Stop:             pct stop $CT_ID"
echo "  • Status:           pct status $CT_ID"
echo "  • Logs:             pct exec $CT_ID -- journalctl -f"
echo ""
