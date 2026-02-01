#!/usr/bin/env bash

# BC Inventory - Proxmox Automated Installer
# This script creates an LXC container and installs BC Inventory automatically

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Default configuration
DEFAULT_CTID="300"
DEFAULT_HOSTNAME="bcinv"
DEFAULT_DISK_SIZE="16"
DEFAULT_MEMORY="4096"
DEFAULT_CORES="4"
DEFAULT_BRIDGE="vmbr0"
APP_PORT="3000"

# GitHub repository
GITHUB_USER="zv20"
GITHUB_REPO_NAME="bcinv"
GITHUB_REPO="https://github.com/${GITHUB_USER}/${GITHUB_REPO_NAME}.git"

# Banner
function banner() {
    clear
    echo -e "${CYAN}"
    echo "═══════════════════════════════════════════════════════════"
    echo "    📦 BC Inventory System - Proxmox Installer"
    echo "═══════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

# Check if running on Proxmox
function check_proxmox() {
    if ! command -v pveversion &> /dev/null; then
        echo -e "${RED}✖ Error: This script must be run on a Proxmox VE host!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Running on Proxmox VE $(pveversion | grep -oP 'pve-manager/\K[0-9.]+')${NC}"
}

# Check if running as root
function check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}✖ This script must be run as root${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Running with root privileges${NC}"
}

# Get user input with defaults
function get_user_input() {
    echo -e "\n${YELLOW}📝 Container Configuration${NC}"
    echo -e "${BLUE}Press Enter to use default values shown in [brackets]${NC}\n"
    
    # Container ID
    while true; do
        read -p "Container ID [$DEFAULT_CTID]: " CTID
        CTID=${CTID:-$DEFAULT_CTID}
        
        if pct status $CTID &>/dev/null; then
            echo -e "${RED}✖ Container $CTID already exists!${NC}"
        else
            break
        fi
    done
    
    # Hostname
    read -p "Hostname [$DEFAULT_HOSTNAME]: " HOSTNAME
    HOSTNAME=${HOSTNAME:-$DEFAULT_HOSTNAME}
    
    # Root Password
    echo -e "\n${YELLOW}🔐 Set Root Password for Container${NC}"
    while true; do
        read -s -p "Enter root password (leave empty to skip): " ROOT_PASSWORD
        echo
        if [ -z "$ROOT_PASSWORD" ]; then
            echo -e "${YELLOW}⚠️  No password set. Use 'pct enter $CTID' to access${NC}"
            break
        fi
        read -s -p "Confirm root password: " ROOT_PASSWORD_CONFIRM
        echo
        if [ "$ROOT_PASSWORD" = "$ROOT_PASSWORD_CONFIRM" ]; then
            echo -e "${GREEN}✓ Password set successfully${NC}"
            break
        else
            echo -e "${RED}✖ Passwords don't match${NC}"
        fi
    done
    
    # Disk Size
    read -p "Disk Size in GB [$DEFAULT_DISK_SIZE]: " DISK_SIZE
    DISK_SIZE=${DISK_SIZE:-$DEFAULT_DISK_SIZE}
    
    # Memory
    read -p "Memory in MB [$DEFAULT_MEMORY]: " MEMORY
    MEMORY=${MEMORY:-$DEFAULT_MEMORY}
    
    # CPU Cores
    read -p "CPU Cores [$DEFAULT_CORES]: " CORES
    CORES=${CORES:-$DEFAULT_CORES}
    
    # Network Bridge
    read -p "Network Bridge [$DEFAULT_BRIDGE]: " BRIDGE
    BRIDGE=${BRIDGE:-$DEFAULT_BRIDGE}
    
    # Network Configuration
    echo -e "\n${YELLOW}🌐 Network Configuration${NC}"
    echo -e "  ${GREEN}1)${NC} DHCP (automatic)"
    echo -e "  ${GREEN}2)${NC} Static IP (manual)"
    
    while true; do
        read -p "Select option [1]: " NET_CHOICE
        NET_CHOICE=${NET_CHOICE:-1}
        
        case $NET_CHOICE in
            1)
                IP_CONFIG="dhcp"
                echo -e "${GREEN}✓ Using DHCP${NC}"
                break
                ;;
            2)
                while true; do
                    read -p "IP Address/CIDR (e.g., 192.168.1.100/24): " STATIC_IP
                    if [[ ! $STATIC_IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
                        echo -e "${RED}✖ Invalid IP format${NC}"
                        continue
                    fi
                    
                    read -p "Gateway (e.g., 192.168.1.1): " GATEWAY
                    if [ -z "$GATEWAY" ]; then
                        echo -e "${RED}✖ Gateway is required for static IP${NC}"
                        continue
                    fi
                    
                    if [[ ! $GATEWAY =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
                        echo -e "${RED}✖ Invalid gateway format${NC}"
                        continue
                    fi
                    
                    IP_CONFIG="$STATIC_IP,gw=$GATEWAY"
                    echo -e "${GREEN}✓ Static IP configured: $STATIC_IP via $GATEWAY${NC}"
                    break
                done
                break
                ;;
            *)
                echo -e "${RED}✖ Invalid choice${NC}"
                ;;
        esac
    done
    
    # Storage
    echo -e "\n${YELLOW}Available Storage:${NC}"
    pvesm status | grep -E '^[^ ]+' | awk 'NR>1 {print "  • " $1}'
    read -p "Storage for container [local-lvm]: " STORAGE
    STORAGE=${STORAGE:-local-lvm}
    
    # Summary
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Configuration Summary:${NC}"
    echo -e "  Container ID: ${MAGENTA}$CTID${NC}"
    echo -e "  Hostname: ${MAGENTA}$HOSTNAME${NC}"
    echo -e "  Disk: ${MAGENTA}${DISK_SIZE}GB${NC}"
    echo -e "  Memory: ${MAGENTA}${MEMORY}MB${NC}"
    echo -e "  CPU Cores: ${MAGENTA}$CORES${NC}"
    echo -e "  Network: ${MAGENTA}$IP_CONFIG${NC}"
    echo -e "  Storage: ${MAGENTA}$STORAGE${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"
    
    read -p "Proceed with installation? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Installation cancelled.${NC}"
        exit 0
    fi
}

# Download Debian template
function download_template() {
    echo -e "\n${YELLOW}📥 Checking for Debian template...${NC}"
    pveam update
    
    TEMPLATE_NAME=$(pveam available | grep "^system" | grep "debian-12-standard" | awk '{print $2}' | head -1)
    
    if [ -z "$TEMPLATE_NAME" ]; then
        echo -e "${RED}✖ Could not find Debian template${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Selected template: $TEMPLATE_NAME${NC}"
    
    if pveam list local | grep -q "$TEMPLATE_NAME"; then
        echo -e "${GREEN}✓ Template already downloaded${NC}"
        TEMPLATE_PATH="local:vztmpl/$TEMPLATE_NAME"
    else
        echo -e "${YELLOW}Downloading template...${NC}"
        pveam download local "$TEMPLATE_NAME"
        TEMPLATE_PATH="local:vztmpl/$TEMPLATE_NAME"
    fi
}

# Create container
function create_container() {
    echo -e "\n${YELLOW}🔧 Creating LXC container...${NC}"
    
    PASSWORD_ARG=""
    if [ -n "${ROOT_PASSWORD:-}" ]; then
        PASSWORD_ARG="--password '$ROOT_PASSWORD'"
    fi
    
    if eval pct create $CTID $TEMPLATE_PATH \
        --hostname $HOSTNAME \
        --memory $MEMORY \
        --cores $CORES \
        --rootfs $STORAGE:$DISK_SIZE \
        --net0 name=eth0,bridge=$BRIDGE,firewall=1,ip=$IP_CONFIG \
        --features nesting=1 \
        --unprivileged 1 \
        --onboot 1 \
        $PASSWORD_ARG \
        --start 1; then
        echo -e "${GREEN}✓ Container created and started${NC}"
    else
        echo -e "${RED}✖ Failed to create container${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}⏳ Waiting for container to initialize...${NC}"
    sleep 10
}

# Install application
function install_application() {
    echo -e "\n${YELLOW}📦 Installing BC Inventory...${NC}"
    
    # Install dependencies
    echo -e "${BLUE}Installing system packages...${NC}"
    pct exec $CTID -- bash -c "apt update && apt install -y curl git ca-certificates gnupg postgresql postgresql-contrib"
    
    # Install Node.js 20
    echo -e "${BLUE}Installing Node.js 20...${NC}"
    pct exec $CTID -- bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs"
    
    # Clone repository
    echo -e "${BLUE}Cloning BC Inventory repository...${NC}"
    pct exec $CTID -- bash -c "git clone $GITHUB_REPO /opt/bcinv"
    
    # Run the install script
    echo -e "${BLUE}Running BC Inventory installation script...${NC}"
    pct exec $CTID -- bash -c "cd /opt/bcinv && bash install.sh"
    
    echo -e "${GREEN}✓ BC Inventory installed successfully${NC}"
}

# Get container IP
function get_container_ip() {
    echo -e "\n${YELLOW}🔍 Getting container IP...${NC}"
    sleep 3
    
    CONTAINER_IP=$(pct exec $CTID -- hostname -I | awk '{print $1}' 2>/dev/null || echo "")
    
    if [ -n "$CONTAINER_IP" ]; then
        echo -e "${GREEN}✓ Container IP: $CONTAINER_IP${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not detect IP${NC}"
    fi
}

# Completion message
function completion_message() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ Installation Complete!${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"
    
    echo -e "${MAGENTA}📊 Container Details:${NC}"
    echo -e "  Container ID: ${CYAN}$CTID${NC}"
    echo -e "  Hostname: ${CYAN}$HOSTNAME${NC}"
    
    if [ -n "$CONTAINER_IP" ]; then
        echo -e "  IP Address: ${CYAN}$CONTAINER_IP${NC}"
        echo -e "\n${GREEN}🌐 Access BC Inventory:${NC}"
        echo -e "  ${BLUE}http://$CONTAINER_IP:$APP_PORT${NC}\n"
    else
        echo -e "\n${YELLOW}Get IP with: pct exec $CTID -- hostname -I${NC}\n"
    fi
    
    echo -e "${MAGENTA}🔧 Useful Commands:${NC}"
    echo -e "  Check status: ${CYAN}pct exec $CTID -- systemctl status bcinv-api${NC}"
    echo -e "  View logs: ${CYAN}pct exec $CTID -- journalctl -u bcinv-api -f${NC}"
    echo -e "  Enter container: ${CYAN}pct enter $CTID${NC}"
    echo -e "  Stop container: ${CYAN}pct stop $CTID${NC}\n"
    
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"
}

# Error handler
function error_handler() {
    echo -e "\n${RED}✖ Installation failed!${NC}"
    if pct status $CTID &>/dev/null; then
        echo -e "${YELLOW}Remove container: ${CYAN}pct stop $CTID && pct destroy $CTID${NC}"
    fi
    exit 1
}

trap error_handler ERR

# Main
function main() {
    banner
    check_root
    check_proxmox
    get_user_input
    download_template
    create_container
    install_application
    get_container_ip
    completion_message
}

main
