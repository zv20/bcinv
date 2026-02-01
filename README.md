# BC Inventory - Proxmox LXC Installer

**One-click automated Proxmox LXC installer for BC Inventory** - the complete grocery store inventory management system.

## 🚀 Quick Start

Run this command on your **Proxmox host** (as root):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/zv20/bcinv/main/install.sh)
```

That's it! The script will:
- ✅ Create a new LXC container
- ✅ Install Debian 12
- ✅ Install Node.js 20 LTS
- ✅ Install and configure PostgreSQL
- ✅ Clone and setup BC Inventory
- ✅ Create systemd services
- ✅ Start everything automatically

## 📋 What You'll Get

### Automated Installation
- **Interactive configuration** - Choose container ID, resources, networking
- **Branch selection** - Pick which version to install
- **Secure by default** - Optional root password, PostgreSQL credentials
- **Production ready** - Systemd services with auto-restart
- **Clean MOTD** - Shows status, IP, and useful commands on login

### System Specifications
**Default Resources:**
- 4 CPU cores
- 4096 MB RAM
- 16 GB disk
- Debian 12 LXC
- PostgreSQL 15
- Node.js 20 LTS

**Adjustable During Install:**
- Container ID
- Hostname
- CPU/Memory/Disk
- Network (DHCP or Static IP)
- Storage location

## 🎯 Features

### BC Inventory Application
- **Product Management** - Track products, prices, expiry dates
- **Barcode Support** - Scan and search products
- **Expiry Tracking** - Automatic notifications for expiring items
- **Sales Recording** - Track sales and inventory movements
- **Web Interface** - Clean, responsive UI accessible from any device
- **API Server** - RESTful API for integrations
- **Background Worker** - Automated expiry checking

### Installation Script Features
- ✓ **Branch selection** - Choose main, development, or custom branches
- ✓ **Template management** - Auto-downloads Debian templates
- ✓ **Network flexibility** - DHCP or static IP configuration
- ✓ **Password setup** - Optional secure container access
- ✓ **Health checks** - Verifies services start correctly
- ✓ **Error handling** - Clear messages and rollback options
- ✓ **Update command** - Built-in `update` command for easy updates

## 📦 Installation Options

### Method 1: One-Line Install (Recommended)
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/zv20/bcinv/main/install.sh)
```

### Method 2: Download and Run
```bash
wget https://raw.githubusercontent.com/zv20/bcinv/main/install.sh
chmod +x install.sh
./install.sh
```

### Method 3: Clone Repository
```bash
git clone https://github.com/zv20/bcinv.git
cd bcinv
bash install.sh
```

## 🔄 Updating

### From Inside Container
```bash
pct enter <container-id>
update  # or: update-bcinv
```

### From Proxmox Host
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/zv20/bcinv/main/update-from-host.sh) <container-id>
```

The update script:
1. ✓ Shows current version and available updates
2. ✓ Warns about uncommitted changes
3. ✓ Creates PostgreSQL backup
4. ✓ Stops services gracefully
5. ✓ Pulls latest code
6. ✓ Updates dependencies
7. ✓ Runs database migrations
8. ✓ Restarts services
9. ✓ Verifies successful startup

## 🎛️ Container Management

### Basic Commands
```bash
# Start/Stop
pct start <container-id>
pct stop <container-id>
pct restart <container-id>

# Status
pct status <container-id>

# Enter container
pct enter <container-id>

# Execute command
pct exec <container-id> -- <command>
```

### Service Management (inside container)
```bash
# Check status
systemctl status bcinv-api
systemctl status bcinv-worker

# View logs
journalctl -u bcinv-api -f
journalctl -u bcinv-worker -f

# Restart
systemctl restart bcinv-api bcinv-worker
```

## 🔧 Configuration

### Database Connection
The installer automatically configures:
- Database: `bcinv`
- User: `bcinv`
- Password: `bcinv123` (change in production)
- Host: `localhost`
- Port: `5432`

### Environment Variables
Systemd service files include:
```ini
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bcinv
DB_USER=bcinv
DB_PASSWORD=bcinv123
```

### Changing Database Password
```bash
pct enter <container-id>

# Change PostgreSQL password
su - postgres
psql
ALTER USER bcinv WITH PASSWORD 'new_password';
\q
exit

# Update service files
sed -i 's/DB_PASSWORD=bcinv123/DB_PASSWORD=new_password/' /etc/systemd/system/bcinv-*.service
systemctl daemon-reload
systemctl restart bcinv-api bcinv-worker
```

## 🌐 Networking

### Access the Application
After installation:
```
http://<container-ip>:3000
```

Find IP address:
```bash
pct exec <container-id> -- hostname -I
```

### Reverse Proxy Setup
For external access with SSL, use Nginx Proxy Manager:

1. Create new proxy host
2. Forward to: `<container-ip>:3000`
3. Enable SSL (Let's Encrypt)
4. Optional: Add authentication

### Port Forwarding (Proxmox Host)
```bash
# Forward host port 80 to container port 3000
iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to <container-ip>:3000
iptables -t nat -A POSTROUTING -j MASQUERADE
```

## 🐛 Troubleshooting

### Database Permission Errors (API Returns 500)

If you see "permission denied for table" errors in logs:

```bash
# Inside container, run the fix script
pct enter <container-id>
bash <(curl -fsSL https://raw.githubusercontent.com/zv20/bcinv/main/fix-permissions.sh)
```

**Or manually:**
```bash
su - postgres -c "psql -d bcinv" << 'EOF'
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bcinv;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bcinv;
GRANT ALL PRIVILEGES ON ALL VIEWS IN SCHEMA public TO bcinv;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bcinv;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bcinv;
EOF

systemctl restart bcinv-api bcinv-worker
```

### Container Won't Start
```bash
pct start <container-id>
journalctl -xe  # Check Proxmox logs
```

### Services Not Running
```bash
pct enter <container-id>
systemctl status bcinv-api bcinv-worker
journalctl -u bcinv-api -n 50
```

### Can't Connect to Application
```bash
# Check if services are listening
pct exec <container-id> -- ss -tlnp | grep 3000

# Check firewall
pct exec <container-id> -- iptables -L

# Test from Proxmox host
curl http://<container-ip>:3000
```

### Database Issues
```bash
pct enter <container-id>
systemctl status postgresql
su - postgres
psql -l  # List databases
psql -d bcinv  # Connect to database

# Test database connection
psql -U bcinv -d bcinv -c "SELECT COUNT(*) FROM products;"
```

### Update Failed
```bash
# Check what changed
cd /opt/bcinv
git status
git diff

# Reset to clean state
git reset --hard origin/main

# Restore database from backup
su - postgres
psql bcinv < /tmp/bcinv_backup_YYYYMMDD_HHMMSS.sql
```

## 💾 Backup & Restore

### Backup Container
```bash
# Full container backup
vzdump <container-id> --dumpdir /var/lib/vz/dump --mode snapshot

# Application data only (inside container)
pct exec <container-id> -- bash -c '
su - postgres -c "pg_dump bcinv > /root/bcinv_backup_$(date +%Y%m%d).sql"
tar -czf /root/bcinv_app_$(date +%Y%m%d).tar.gz /opt/bcinv
'
```

### Restore Container
```bash
# Restore from Proxmox backup
pct restore <container-id> /var/lib/vz/dump/vzdump-lxc-*.tar.zst

# Restore database only
pct exec <container-id> -- su - postgres -c "psql bcinv < /root/bcinv_backup.sql"
```

## 🔒 Security

### Recommendations
1. **Change default passwords** - Database and container root
2. **Use reverse proxy** - Enable SSL with Let's Encrypt
3. **Firewall rules** - Restrict access to port 3000
4. **Regular updates** - Keep system and app updated
5. **Backups** - Schedule regular database backups

### Hardening
```bash
# Change database password
su - postgres -c "psql -c \"ALTER USER bcinv WITH PASSWORD 'strong_password';\""

# Update service environment
vim /etc/systemd/system/bcinv-api.service
systemctl daemon-reload
systemctl restart bcinv-api bcinv-worker

# Enable firewall
apt install ufw
ufw allow 22/tcp  # SSH
ufw allow from <trusted-ip> to any port 3000  # App
ufw enable
```

## 📚 Additional Resources

- **Main Repository**: [github.com/zv20/bcinv](https://github.com/zv20/bcinv)
- **Proxmox Docs**: [pve.proxmox.com](https://pve.proxmox.com/wiki/Linux_Container)
- **Issues**: [github.com/zv20/bcinv/issues](https://github.com/zv20/bcinv/issues)

## 📝 License

MIT License - See repository for details

## 🤝 Contributing

Contributions welcome! Please open an issue or pull request.

---

**Made for grocery stores and small businesses** 🏪