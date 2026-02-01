# BC Inventory - Proxmox LXC Deployment

Automated scripts for deploying BC Inventory in Proxmox LXC containers.

## Prerequisites

- Proxmox VE 7.x or 8.x
- Root or sudo access to Proxmox host
- Debian or Ubuntu container template downloaded

## Quick Start

### Option 1: Automated Creation (Recommended)

Run on your Proxmox host:

```bash
wget https://raw.githubusercontent.com/zv20/bcinv/main/proxmox/create-lxc.sh
chmod +x create-lxc.sh
bash create-lxc.sh
```

### Option 2: Interactive Creation

For custom configuration:

```bash
wget https://raw.githubusercontent.com/zv20/bcinv/main/proxmox/create-lxc-interactive.sh
chmod +x create-lxc-interactive.sh
bash create-lxc-interactive.sh
```

## Manual Creation

If you prefer to create the container manually:

```bash
# Get next available ID
NEXT_ID=$(pvesh get /cluster/nextid)

# Create container
pct create $NEXT_ID \
  /var/lib/vz/template/cache/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname bcinv \
  --storage local-lxc \
  --rootfs local-lxc:16 \
  --cores 4 \
  --memory 4096 \
  --swap 512 \
  --net0 name=eth0,bridge=vmbr0,firewall=1,ip=dhcp,type=veth \
  --features keyctl=1,nesting=1 \
  --unprivileged 1 \
  --onboot 1 \
  --description "BC Inventory Management System"

# Start container
pct start $NEXT_ID
```

## Post-Creation Setup

Once the container is created and started:

```bash
# Enter the container
pct enter <CT_ID>

# Install git
apt update && apt install -y git

# Clone repository
git clone https://github.com/zv20/bcinv.git /opt/bcinv
cd /opt/bcinv

# Run setup
bash setup.sh
```

The setup script will:
- Install Node.js 20 LTS
- Install and configure PostgreSQL
- Create database and user
- Install application dependencies
- Create systemd services
- Start the application

## Configuration Options

Edit the script variables before running:

```bash
# Container specs
CT_ID=""          # Leave empty for auto-assign
CT_HOSTNAME="bcinv"
ROOTFS_SIZE="16"  # GB
CORES="4"
MEMORY="4096"     # MB
SWAP="512"        # MB

# Network
BRIDGE="vmbr0"
IP_MODE="dhcp"    # or "static"
STATIC_IP=""      # e.g., "192.168.1.100/24"
GATEWAY=""        # e.g., "192.168.1.1"

# Storage
STORAGE="local-lxc"  # Your storage name
TEMPLATE="debian-12-standard_12.7-1_amd64.tar.zst"
```

## Recommended Container Resources

### Minimum (Testing)
- 2 CPU cores
- 2GB RAM
- 8GB storage
- Suitable for: < 5,000 products

### Recommended (Production)
- 4 CPU cores
- 4GB RAM
- 16GB storage
- Suitable for: 10,000-20,000 products

### High Volume
- 6-8 CPU cores
- 8GB RAM
- 32GB storage
- Suitable for: 20,000+ products

## Container Management

```bash
# Start/Stop
pct start <CT_ID>
pct stop <CT_ID>
pct restart <CT_ID>

# Status
pct status <CT_ID>

# Enter container shell
pct enter <CT_ID>

# Execute command in container
pct exec <CT_ID> -- <command>

# View logs
pct exec <CT_ID> -- journalctl -u bcinv-api -f

# Backup container
vzdump <CT_ID> --compress zstd --mode snapshot

# Delete container
pct stop <CT_ID>
pct destroy <CT_ID>
```

## Networking

### DHCP (Default)
Container gets IP automatically from your network DHCP server.

### Static IP
Edit the script and set:
```bash
IP_MODE="static"
STATIC_IP="192.168.1.100/24"
GATEWAY="192.168.1.1"
```

### Port Forwarding
If you need to expose BC Inventory to external networks:

```bash
# Add to Proxmox host firewall
iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to <CT_IP>:3000
iptables -t nat -A POSTROUTING -j MASQUERADE
```

Or use Nginx Proxy Manager in a separate container.

## Troubleshooting

### Container won't start
```bash
# Check status
pct status <CT_ID>

# View errors
pct start <CT_ID>
journalctl -xe
```

### Can't connect to application
```bash
# Check if services are running
pct exec <CT_ID> -- systemctl status bcinv-api
pct exec <CT_ID> -- systemctl status bcinv-worker

# Check logs
pct exec <CT_ID> -- journalctl -u bcinv-api -n 50
```

### Database issues
```bash
# Enter container
pct enter <CT_ID>

# Check PostgreSQL
systemctl status postgresql
su - postgres
psql -l
```

## Backup & Restore

### Backup Container
```bash
# Full container backup
vzdump <CT_ID> --dumpdir /var/lib/vz/dump --mode snapshot

# Application-only backup (inside container)
pct exec <CT_ID> -- bash /opt/bcinv/update.sh
```

### Restore Container
```bash
# Restore from Proxmox backup
pct restore <CT_ID> /var/lib/vz/dump/vzdump-lxc-<CT_ID>-*.tar.zst
```

## Updates

Inside the container:

```bash
cd /opt/bcinv
bash update.sh
```

The update script automatically:
- Creates PostgreSQL backup
- Pulls latest code
- Updates dependencies
- Runs migrations
- Restarts services

## Security Notes

- Container runs unprivileged by default (more secure)
- Features `keyctl=1,nesting=1` enable systemd and containers inside container
- Firewall enabled on network interface
- PostgreSQL only listens on container IP (not exposed)
- Use Nginx reverse proxy with SSL for production

## Support

- Issues: https://github.com/zv20/bcinv/issues
- Proxmox Docs: https://pve.proxmox.com/wiki/Linux_Container
