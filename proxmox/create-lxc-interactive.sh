#!/bin/bash

# BC Inventory - Interactive Proxmox LXC Container Creator
# This version prompts for all configuration options

set -e

echo "═══════════════════════════════════════════════"
echo "  BC Inventory - Interactive LXC Creator"
echo "═══════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running on Proxmox
if ! command -v pct &> /dev/null; then
    echo -e "${RED}✗ This script must be run on a Proxmox host${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Running on Proxmox host${NC}"
echo ""

# Get next available ID
NEXT_ID=$(pvesh get /cluster/nextid)

# Container ID
read -p "Container ID [$NEXT_ID]: " CT_ID
CT_ID=${CT_ID:-$NEXT_ID}

# Hostname
read -p "Hostname [bcinv]: " CT_HOSTNAME
CT_HOSTNAME=${CT_HOSTNAME:-bcinv}

# Template selection
echo ""
echo "Available templates:"
pveam available | grep -E "debian|ubuntu" | head -5
echo ""
read -p "Template [debian-12-standard_12.7-1_amd64.tar.zst]: " TEMPLATE
TEMPLATE=${TEMPLATE:-debian-12-standard_12.7-1_amd64.tar.zst}

# Storage
echo ""
echo "Available storage:"
pvesm status | awk 'NR>1 {print $1 " (" $2 ")"}'
echo ""
read -p "Storage [local-lxc]: " STORAGE
STORAGE=${STORAGE:-local-lxc}

# Resources
read -p "Root filesystem size in GB [16]: " ROOTFS_SIZE
ROOTFS_SIZE=${ROOTFS_SIZE:-16}

read -p "CPU cores [4]: " CORES
CORES=${CORES:-4}

read -p "Memory in MB [4096]: " MEMORY
MEMORY=${MEMORY:-4096}

read -p "Swap in MB [512]: " SWAP
SWAP=${SWAP:-512}

# Network
echo ""
echo "Network bridges:"
ip link show type bridge | grep -E '^[0-9]+:' | awk '{print $2}' | sed 's/:$//'
echo ""
read -p "Bridge [vmbr0]: " BRIDGE
BRIDGE=${BRIDGE:-vmbr0}

read -p "Use DHCP? [Y/n]: " USE_DHCP
USE_DHCP=${USE_DHCP:-Y}

if [[ $USE_DHCP =~ ^[Nn]$ ]]; then
    read -p "Static IP (CIDR format, e.g., 192.168.1.100/24): " STATIC_IP
    read -p "Gateway: " GATEWAY
    NET_CONFIG="name=eth0,bridge=$BRIDGE,firewall=1,ip=$STATIC_IP,gw=$GATEWAY,type=veth"
else
    NET_CONFIG="name=eth0,bridge=$BRIDGE,firewall=1,ip=dhcp,type=veth"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════"
echo "  Container Configuration Summary"
echo "═══════════════════════════════════════════════"
echo "  ID:        $CT_ID"
echo "  Hostname:  $CT_HOSTNAME"
echo "  Template:  $TEMPLATE"
echo "  Storage:   $STORAGE"
echo "  Root FS:   ${ROOTFS_SIZE}GB"
echo "  CPU Cores: $CORES"
echo "  Memory:    ${MEMORY}MB"
echo "  Swap:      ${SWAP}MB"
echo "  Network:   $BRIDGE ($([[ $USE_DHCP =~ ^[Yy]$ ]] && echo "DHCP" || echo "$STATIC_IP"))"
echo "═══════════════════════════════════════════════"
echo ""

read -p "Proceed with creation? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}✗ Cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Creating container...${NC}"
echo ""

# Download template if needed
if [ ! -f "/var/lib/vz/template/cache/$TEMPLATE" ]; then
    echo -e "${YELLOW}⚠ Downloading template...${NC}"
    pveam download local $TEMPLATE
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
    --net0 "$NET_CONFIG" \
    --features keyctl=1,nesting=1 \
    --unprivileged 1 \
    --onboot 1 \
    --start 0 \
    --description "BC Inventory Management System"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to create container${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Container created${NC}"
echo ""

read -p "Start container now? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    pct start $CT_ID
    echo -e "${BLUE}Waiting for container to boot...${NC}"
    sleep 5
    
    CT_IP=$(pct exec $CT_ID -- hostname -I | awk '{print $1}' 2>/dev/null)
    
    echo ""
    echo -e "${GREEN}✓ Container started${NC}"
    [ -n "$CT_IP" ] && echo -e "${GREEN}✓ IP Address: $CT_IP${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ Setup Complete!"
echo "═══════════════════════════════════════════════"
echo ""
echo "Next: Enter container and run setup"
echo ""
echo "  pct enter $CT_ID"
echo "  apt update && apt install -y git"
echo "  git clone https://github.com/zv20/bcinv.git /opt/bcinv"
echo "  cd /opt/bcinv && bash setup.sh"
echo ""
