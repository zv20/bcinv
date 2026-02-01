#!/usr/bin/env bash

# BC Inventory - Proxmox Automated Installer
# This script creates an LXC container and installs BC Inventory automatically

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default configuration
DEFAULT_CTID="600"
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

# Branch selection (will be set during configuration)
SELECTED_BRANCH=""

# Banner
function banner() {
    clear
    echo -e "${CYAN}"
    echo "═══════════════════════════════════════════════════════════"
    echo "    📦 BC Inventory - Proxmox Installer"
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

# Fetch available branches from GitHub
function fetch_branches() {
    echo -e "\n${YELLOW}🌿 Fetching available branches from GitHub...${NC}"
    
    local api_url="https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO_NAME}/branches"
    
    if ! command -v curl &> /dev/null; then
        echo -e "${YELLOW}⚠️  curl not found, installing...${NC}"
        apt-get update -qq && apt-get install -y curl -qq
    fi
    
    local branch_data=$(curl -s "$api_url" 2>/dev/null)
    
    if [ -z "$branch_data" ] || echo "$branch_data" | grep -q "API rate limit"; then
        echo -e "${YELLOW}⚠️  Unable to fetch branches from GitHub API${NC}"
        echo -e "${BLUE}Using fallback method...${NC}"
        
        if command -v git &> /dev/null || (apt-get update -qq && apt-get install -y git -qq); then
            AVAILABLE_BRANCHES=($(git ls-remote --heads "$GITHUB_REPO" | awk '{print $2}' | sed 's|refs/heads/||' | sort))
        else
            echo -e "${RED}✖ Unable to fetch branches. Using default 'main' branch.${NC}"
            AVAILABLE_BRANCHES=("main")
        fi
    else
        AVAILABLE_BRANCHES=($(echo "$branch_data" | grep '"name"' | cut -d'"' -f4 | sort))
    fi
    
    if [ ${#AVAILABLE_BRANCHES[@]} -eq 0 ]; then
        echo -e "${RED}✖ No branches found. Using default 'main' branch.${NC}"
        AVAILABLE_BRANCHES=("main")
    else
        echo -e "${GREEN}✓ Found ${#AVAILABLE_BRANCHES[@]} branch(es)${NC}"
    fi
}

# Select branch interactively
function select_branch() {
    echo -e "\n${YELLOW}🌿 Branch Selection${NC}"
    echo -e "${BLUE}Available branches for ${GITHUB_USER}/${GITHUB_REPO_NAME}:${NC}\n"
    
    local index=1
    for branch in "${AVAILABLE_BRANCHES[@]}"; do
        if [ "$branch" = "main" ]; then
            echo -e "  ${GREEN}${index})${NC} ${CYAN}${branch}${NC} ${MAGENTA}(default)${NC}"
        else
            echo -e "  ${GREEN}${index})${NC} ${branch}"
        fi
        ((index++))
    done
    
    echo -e "  ${GREEN}${index})${NC} ${YELLOW}Enter custom branch name${NC}"
    echo
    
    local main_index=1
    for i in "${!AVAILABLE_BRANCHES[@]}"; do
        if [ "${AVAILABLE_BRANCHES[$i]}" = "main" ]; then
            main_index=$((i + 1))
            break
        fi
    done
    
    while true; do
        read -p "Select branch [${main_index}]: " branch_choice
        branch_choice=${branch_choice:-$main_index}
        
        if [ "$branch_choice" = "${index}" ]; then
            read -p "Enter custom branch name: " SELECTED_BRANCH
            if [ -z "$SELECTED_BRANCH" ]; then
                echo -e "${RED}✖ Branch name cannot be empty${NC}"
                continue
            fi
            echo -e "${YELLOW}⚠️  Custom branch '${SELECTED_BRANCH}' will be used (not validated)${NC}"
            break
        fi
        
        if [[ "$branch_choice" =~ ^[0-9]+$ ]] && [ "$branch_choice" -ge 1 ] && [ "$branch_choice" -lt "$index" ]; then
            SELECTED_BRANCH="${AVAILABLE_BRANCHES[$((branch_choice - 1))]}"
            echo -e "${GREEN}✓ Selected branch: ${CYAN}${SELECTED_BRANCH}${NC}"
            break
        else
            echo -e "${RED}✖ Invalid selection. Please choose 1-${index}${NC}"
        fi
    done
}

# Get user input with defaults
function get_user_input() {
    echo -e "\n${YELLOW}📝 Container Configuration${NC}"
    echo -e "${BLUE}Press Enter to use default values shown in [brackets]${NC}\n"
    
    while true; do
        read -p "Container ID [$DEFAULT_CTID]: " CTID
        CTID=${CTID:-$DEFAULT_CTID}
        
        if pct status $CTID &>/dev/null; then
            echo -e "${RED}✖ Container $CTID already exists!${NC}"
        else
            break
        fi
    done
    
    read -p "Hostname [$DEFAULT_HOSTNAME]: " HOSTNAME
    HOSTNAME=${HOSTNAME:-$DEFAULT_HOSTNAME}
    
    echo -e "\n${YELLOW}🔐 Set Root Password for Container${NC}"
    echo -e "${BLUE}This will allow you to log in to the container${NC}"
    while true; do
        read -s -p "Enter root password (leave empty to skip): " ROOT_PASSWORD
        echo
        if [ -z "$ROOT_PASSWORD" ]; then
            echo -e "${YELLOW}⚠️  No password set. Use 'pct enter $CTID' to access container${NC}"
            break
        fi
        read -s -p "Confirm root password: " ROOT_PASSWORD_CONFIRM
        echo
        if [ "$ROOT_PASSWORD" = "$ROOT_PASSWORD_CONFIRM" ]; then
            echo -e "${GREEN}✓ Password set successfully${NC}"
            break
        else
            echo -e "${RED}✖ Passwords don't match. Try again.${NC}"
        fi
    done
    
    read -p "Disk Size in GB [$DEFAULT_DISK_SIZE]: " DISK_SIZE
    DISK_SIZE=${DISK_SIZE:-$DEFAULT_DISK_SIZE}
    
    read -p "Memory in MB [$DEFAULT_MEMORY]: " MEMORY
    MEMORY=${MEMORY:-$DEFAULT_MEMORY}
    
    read -p "CPU Cores [$DEFAULT_CORES]: " CORES
    CORES=${CORES:-$DEFAULT_CORES}
    
    read -p "Network Bridge [$DEFAULT_BRIDGE]: " BRIDGE
    BRIDGE=${BRIDGE:-$DEFAULT_BRIDGE}
    
    echo -e "\n${YELLOW}🌐 Network Configuration${NC}"
    echo -e "${BLUE}Choose IP address assignment method${NC}"
    echo -e "  ${GREEN}1)${NC} DHCP (automatic)"
    echo -e "  ${GREEN}2)${NC} Static IP (manual)"
    
    while true; do
        read -p "Select option [1]: " NET_CHOICE
        NET_CHOICE=${NET_CHOICE:-1}
        
        case $NET_CHOICE in
            1)
                IP_CONFIG="dhcp"
                GATEWAY=""
                echo -e "${GREEN}✓ Using DHCP${NC}"
                break
                ;;
            2)
                echo -e "\n${BLUE}Static IP Configuration${NC}"
                read -p "IP Address/CIDR (e.g., 192.168.1.100/24): " STATIC_IP
                
                if [[ ! $STATIC_IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
                    echo -e "${RED}✖ Invalid IP format. Use format: 192.168.1.100/24${NC}"
                    continue
                fi
                
                read -p "Gateway (e.g., 192.168.1.1): " GATEWAY
                
                if [[ ! $GATEWAY =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
                    echo -e "${RED}✖ Invalid gateway format. Use format: 192.168.1.1${NC}"
                    continue
                fi
                
                IP_CONFIG="$STATIC_IP,gw=$GATEWAY"
                echo -e "${GREEN}✓ Static IP configured: $STATIC_IP via $GATEWAY${NC}"
                break
                ;;
            *)
                echo -e "${RED}✖ Invalid choice. Please select 1 or 2${NC}"
                ;;
        esac
    done
    
    echo -e "\n${YELLOW}Available Storage:${NC}"
    pvesm status | grep -E '^[^ ]+' | awk 'NR>1 {print "  • " $1}'
    read -p "Storage for container [local-lvm]: " STORAGE
    STORAGE=${STORAGE:-local-lvm}
    
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Configuration Summary:${NC}"
    echo -e "  Container ID: ${MAGENTA}$CTID${NC}"
    echo -e "  Hostname: ${MAGENTA}$HOSTNAME${NC}"
    echo -e "  Root Password: ${MAGENTA}$([ -n "$ROOT_PASSWORD" ] && echo "Set" || echo "Not Set")${NC}"
    echo -e "  Disk: ${MAGENTA}${DISK_SIZE}GB${NC}"
    echo -e "  Memory: ${MAGENTA}${MEMORY}MB${NC}"
    echo -e "  CPU Cores: ${MAGENTA}$CORES${NC}"
    echo -e "  Network Bridge: ${MAGENTA}$BRIDGE${NC}"
    if [ "$IP_CONFIG" = "dhcp" ]; then
        echo -e "  IP Configuration: ${MAGENTA}DHCP${NC}"
    else
        echo -e "  IP Configuration: ${MAGENTA}Static - $STATIC_IP${NC}"
        echo -e "  Gateway: ${MAGENTA}$GATEWAY${NC}"
    fi
    echo -e "  Storage: ${MAGENTA}$STORAGE${NC}"
    echo -e "  Branch: ${MAGENTA}${SELECTED_BRANCH}${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"
    
    read -p "Proceed with installation? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Installation cancelled.${NC}"
        exit 0
    fi
}

# Download Debian template if not exists
function download_template() {
    echo -e "\n${YELLOW}📥 Checking for Debian template...${NC}"
    
    echo -e "${YELLOW}Updating template list...${NC}"
    pveam update
    
    TEMPLATE_NAME=$(pveam available | grep "^system" | grep "debian-12-standard" | awk '{print $2}' | head -1)
    
    if [ -z "$TEMPLATE_NAME" ]; then
        echo -e "${YELLOW}Debian 12 not found, trying Debian 13...${NC}"
        TEMPLATE_NAME=$(pveam available | grep "^system" | grep "debian-13-standard" | awk '{print $2}' | head -1)
    fi
    
    if [ -z "$TEMPLATE_NAME" ]; then
        echo -e "${RED}✖ Could not find a suitable Debian template${NC}"
        echo -e "${YELLOW}Available templates:${NC}"
        pveam available | grep "^system" | grep "debian"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Selected template: $TEMPLATE_NAME${NC}"
    
    if pveam list local | grep -q "$TEMPLATE_NAME"; then
        echo -e "${GREEN}✓ Template already downloaded${NC}"
        TEMPLATE_PATH="local:vztmpl/$TEMPLATE_NAME"
    else
        echo -e "${YELLOW}Downloading template: $TEMPLATE_NAME${NC}"
        echo -e "${BLUE}This may take a few minutes...${NC}"
        
        if pveam download local "$TEMPLATE_NAME"; then
            echo -e "${GREEN}✓ Template downloaded successfully${NC}"
            TEMPLATE_PATH="local:vztmpl/$TEMPLATE_NAME"
        else
            echo -e "${RED}✖ Failed to download template${NC}"
            exit 1
        fi
    fi
}

# Create LXC container  
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
    sleep 5
    
    local MAX_WAIT=30
    local WAITED=0
    while [ $WAITED -lt $MAX_WAIT ]; do
        if pct exec $CTID -- ip addr show eth0 2>/dev/null | grep -q "inet "; then
            echo -e "${GREEN}✓ Container network is ready${NC}"
            break
        fi
        sleep 2
        WAITED=$((WAITED + 2))
    done
}

# Install application in container
function install_application() {
    echo -e "\n${YELLOW}📦 Installing BC Inventory in container...${NC}"
    
    cat > /tmp/install_bcinv_${CTID}.sh << 'EOFSCRIPT'
#!/bin/bash

set -e

echo "Updating system..."
apt update && apt upgrade -y

echo "Installing prerequisites..."
apt install -y curl git ca-certificates gnupg postgresql postgresql-contrib

echo "Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

echo "Configuring PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Create database and user
su - postgres -c "psql -c \"CREATE DATABASE bcinv;\""
su - postgres -c "psql -c \"CREATE USER bcinv WITH PASSWORD 'bcinv123';\""
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE bcinv TO bcinv;\""
su - postgres -c "psql -d bcinv -c \"GRANT ALL ON SCHEMA public TO bcinv;\""

echo "Cloning BC Inventory repository (branch: SELECTED_BRANCH)..."
cd /opt
git clone -b SELECTED_BRANCH GITHUB_REPO bcinv
cd bcinv

echo "Installing application dependencies..."
npm install --production

echo "Setting up database schema..."
su - postgres -c "psql -d bcinv -f /opt/bcinv/database/schema.sql"

echo "Creating systemd service..."
cat > /etc/systemd/system/bcinv-api.service << 'EOF'
[Unit]
Description=BC Inventory API Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/bcinv
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="DB_HOST=localhost"
Environment="DB_PORT=5432"
Environment="DB_NAME=bcinv"
Environment="DB_USER=bcinv"
Environment="DB_PASSWORD=bcinv123"
ExecStart=/usr/bin/node /opt/bcinv/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/bcinv-worker.service << 'EOF'
[Unit]
Description=BC Inventory Background Worker
After=network.target postgresql.service bcinv-api.service
Requires=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/bcinv
Environment="NODE_ENV=production"
Environment="DB_HOST=localhost"
Environment="DB_PORT=5432"
Environment="DB_NAME=bcinv"
Environment="DB_USER=bcinv"
Environment="DB_PASSWORD=bcinv123"
ExecStart=/usr/bin/node /opt/bcinv/worker.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "Enabling and starting services..."
systemctl daemon-reload
systemctl enable bcinv-api.service bcinv-worker.service
systemctl start bcinv-api.service bcinv-worker.service

echo "Waiting for services to start..."
sleep 3

if systemctl is-active --quiet bcinv-api && systemctl is-active --quiet bcinv-worker; then
    echo "✓ Services started successfully"
else
    echo "✗ Service failed to start"
    journalctl -u bcinv-api -n 20
    exit 1
fi

echo "Creating update script..."
cat > /usr/local/bin/update-bcinv << 'UPDATEEOF'
#!/bin/bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╭─────────────────────────────────────────────╮${NC}"
echo -e "${BLUE}│      🔄 BC Inventory Update Manager         │${NC}"
echo -e "${BLUE}╰─────────────────────────────────────────────╯${NC}"
echo

cd /opt/bcinv || exit 1

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${BLUE}Current branch: ${CURRENT_BRANCH}${NC}"

echo -e "${YELLOW}⏳ Stopping services...${NC}"
systemctl stop bcinv-api bcinv-worker

echo -e "${YELLOW}📥 Fetching latest updates from GitHub...${NC}"
git fetch origin

LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ $LOCAL = $REMOTE ]; then
    echo -e "${GREEN}✓ Already up to date!${NC}"
    systemctl start bcinv-api bcinv-worker
    exit 0
fi

echo -e "${BLUE}📥 Creating database backup...${NC}"
su - postgres -c "pg_dump bcinv > /tmp/bcinv_backup_$(date +%Y%m%d_%H%M%S).sql"

echo -e "${BLUE}🔽 Pulling latest changes...${NC}"
git pull origin $CURRENT_BRANCH

echo -e "${YELLOW}📦 Updating dependencies...${NC}"
npm install --production

echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
if [ -d "migrations" ]; then
    for migration in migrations/*.sql; do
        [ -f "$migration" ] && su - postgres -c "psql -d bcinv -f $migration" || true
    done
fi

echo -e "${YELLOW}▶️ Starting services...${NC}"
systemctl start bcinv-api bcinv-worker

echo -e "${YELLOW}⏳ Waiting for services...${NC}"
sleep 3

if systemctl is-active --quiet bcinv-api && systemctl is-active --quiet bcinv-worker; then
    echo -e "${GREEN}✓ Update completed successfully!${NC}"
    IP=$(hostname -I | awk '{print $1}')
    echo -e "${GREEN}Access at: http://${IP}:3000${NC}"
else
    echo -e "${RED}✗ Services failed to start!${NC}"
    echo -e "${YELLOW}Check logs: journalctl -u bcinv-api -n 50${NC}"
    exit 1
fi
UPDATEEOF

chmod +x /usr/local/bin/update-bcinv
echo "alias update='update-bcinv'" >> /root/.bashrc

echo "Creating MOTD..."
mkdir -p /etc/update-motd.d
chmod -x /etc/update-motd.d/* 2>/dev/null || true

cat > /etc/update-motd.d/10-bcinv << 'MOTDEOF'
#!/bin/bash

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

BRANCH=$(cd /opt/bcinv && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
IP=$(hostname -I | awk '{print $1}')
API_STATUS=$(systemctl is-active bcinv-api 2>/dev/null || echo "inactive")
WORKER_STATUS=$(systemctl is-active bcinv-worker 2>/dev/null || echo "inactive")

if [ "$API_STATUS" = "active" ] && [ "$WORKER_STATUS" = "active" ]; then
    STATUS_TEXT="${GREEN}✓ Running${NC}"
    STATUS_ICON="🟢"
else
    STATUS_TEXT="${YELLOW}✗ Issues Detected${NC}"
    STATUS_ICON="🔴"
fi

echo -e "${CYAN}"
echo "╭──────────────────────────────────────────────────────────────────────╮"
echo -e "│     ${MAGENTA}🏪 BC Inventory - Grocery Store Management${CYAN}               │"
echo "╰──────────────────────────────────────────────────────────────────────╯"
echo -e "${NC}"
echo -e "  ${BLUE}Branch:${NC}   ${GREEN}${BRANCH}${NC}"
echo -e "  ${BLUE}Status:${NC}   ${STATUS_ICON} ${STATUS_TEXT}"
echo -e "  ${BLUE}API:${NC}      $([ "$API_STATUS" = "active" ] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}") ${API_STATUS}"
echo -e "  ${BLUE}Worker:${NC}   $([ "$WORKER_STATUS" = "active" ] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}") ${WORKER_STATUS}"
echo -e "  ${BLUE}IP Addr:${NC}  ${YELLOW}${IP}${NC}"
echo -e "  ${BLUE}URL:${NC}      ${CYAN}http://${IP}:3000${NC}"
echo
echo -e "  ${MAGENTA}🛠️  Commands:${NC}"
echo -e "    ${GREEN}update${NC}                    - Update to latest version"
echo -e "    ${GREEN}systemctl status bcinv-api${NC}     - Check API status"
echo -e "    ${GREEN}journalctl -fu bcinv-api${NC}       - View API logs"
echo
MOTDEOF

chmod +x /etc/update-motd.d/10-bcinv
echo "" > /etc/motd

echo "Installation complete!"
EOFSCRIPT

    sed -i "s|GITHUB_REPO|$GITHUB_REPO|g" /tmp/install_bcinv_${CTID}.sh
    sed -i "s|SELECTED_BRANCH|$SELECTED_BRANCH|g" /tmp/install_bcinv_${CTID}.sh
    
    pct push $CTID /tmp/install_bcinv_${CTID}.sh /tmp/install_bcinv.sh
    pct exec $CTID -- chmod +x /tmp/install_bcinv.sh
    
    echo -e "${BLUE}Running installation inside container (5-10 minutes)...${NC}"
    if pct exec $CTID -- /tmp/install_bcinv.sh; then
        echo -e "${GREEN}✓ BC Inventory installed successfully${NC}"
    else
        echo -e "${RED}✖ Installation failed${NC}"
        exit 1
    fi
    
    rm -f /tmp/install_bcinv_${CTID}.sh
    pct exec $CTID -- rm -f /tmp/install_bcinv.sh
}

# Get container IP
function get_container_ip() {
    echo -e "\n${YELLOW}🔍 Getting container IP address...${NC}"
    sleep 2
    
    CONTAINER_IP=$(pct exec $CTID -- hostname -I | awk '{print $1}' 2>/dev/null || echo "")
    
    if [ -z "$CONTAINER_IP" ]; then
        CONTAINER_IP=$(pct exec $CTID -- ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' 2>/dev/null || echo "")
    fi
    
    if [ -z "$CONTAINER_IP" ]; then
        echo -e "${YELLOW}⚠️  Could not detect IP address${NC}"
    else
        echo -e "${GREEN}✓ Container IP: $CONTAINER_IP${NC}"
    fi
}

# Display completion message
function completion_message() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ Installation Complete!${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"
    
    echo -e "${MAGENTA}📊 Container Details:${NC}"
    echo -e "  Container ID: ${CYAN}$CTID${NC}"
    echo -e "  Hostname: ${CYAN}$HOSTNAME${NC}"
    echo -e "  Branch: ${CYAN}${SELECTED_BRANCH}${NC}"
    
    if [ -n "${ROOT_PASSWORD:-}" ]; then
        echo -e "  Root Password: ${GREEN}Set${NC}"
        echo -e "\n${GREEN}🔐 Login Methods:${NC}"
        echo -e "  From Proxmox: ${CYAN}pct enter $CTID${NC}"
        [ -n "$CONTAINER_IP" ] && echo -e "  SSH: ${CYAN}ssh root@$CONTAINER_IP${NC}"
    else
        echo -e "\n${GREEN}🔐 Login:${NC} ${CYAN}pct enter $CTID${NC}"
    fi
    
    if [ -n "$CONTAINER_IP" ]; then
        echo -e "\n${GREEN}🌐 Access BC Inventory:${NC}"
        echo -e "  ${BLUE}http://$CONTAINER_IP:$APP_PORT${NC}\n"
    fi
    
    echo -e "${MAGENTA}🔄 Update:${NC} ${CYAN}update${NC} (inside container)"
    echo -e "\n${MAGENTA}🔧 Management:${NC}"
    echo -e "  Status: ${CYAN}pct exec $CTID -- systemctl status bcinv-api${NC}"
    echo -e "  Logs: ${CYAN}pct exec $CTID -- journalctl -u bcinv-api -f${NC}"
    echo -e "  Restart: ${CYAN}pct exec $CTID -- systemctl restart bcinv-api${NC}\n"
    
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"
}

function error_handler() {
    echo -e "\n${RED}✖ Installation error!${NC}"
    if pct status $CTID &>/dev/null; then
        echo -e "  Remove: ${CYAN}pct stop $CTID && pct destroy $CTID${NC}"
    fi
    exit 1
}

trap error_handler ERR

function main() {
    banner
    check_root
    check_proxmox
    fetch_branches
    select_branch
    get_user_input
    download_template
    create_container
    install_application
    get_container_ip
    completion_message
}

main