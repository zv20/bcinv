# BC Inventory Management System

A modern, clean inventory management system with expiry tracking, departments, suppliers, and warehouse locations.

## ✨ Features

- **Product Management** - Track products with barcodes, departments, and suppliers
- **Stock Control** - Add, adjust, and discard stock batches
- **Expiry Tracking** - Monitor items approaching expiration
- **Departments** - Organize products by department/category
- **Suppliers** - Manage supplier information and contacts
- **Locations** - Track stock across multiple warehouse locations
- **Audit Log** - Complete history of all inventory changes
- **Dashboard** - Real-time overview of inventory status

## 🚀 Quick Install

**One-command installation:**

```bash
curl -sSL https://raw.githubusercontent.com/zv20/bcinv/main/install.sh | sudo bash
```

This will:
- Install all dependencies (PostgreSQL, Node.js)
- Create and configure the database
- Set up the application
- Start the service automatically

## 📋 Manual Installation

See [INSTALL.md](INSTALL.md) for detailed manual installation steps.

## 🖥️ System Requirements

- Ubuntu 20.04+ or Debian 11+
- 2GB RAM minimum
- PostgreSQL 12+
- Node.js 18+

## 📱 Usage

After installation, access the system at:

```
http://your-server-ip:3000
```

### Main Features:

**Dashboard** - Overview of inventory status and alerts

**Products** - Add and manage products:
- Name and barcode
- Select department from dropdown
- Select supplier from dropdown
- Items per case
- Price per case

**Stock** - Manage inventory:
- Add new stock batches
- Adjust quantities
- Discard expired/damaged items
- Select warehouse location

**Expiring Items** - View and manage items nearing expiration

**Settings**:
- Departments - Create product categories
- Suppliers - Manage supplier contacts
- Locations - Configure warehouse locations

## 🔧 Management Commands

```bash
# Check service status
sudo systemctl status bcinv-api

# View logs
sudo journalctl -u bcinv-api -f

# Restart service
sudo systemctl restart bcinv-api

# Stop service
sudo systemctl stop bcinv-api
```

## 💾 Backup

```bash
# Backup database
sudo -u postgres pg_dump bcinv > bcinv_backup_$(date +%Y%m%d).sql

# Restore database
sudo -u postgres psql -d bcinv < bcinv_backup_YYYYMMDD.sql
```

## 🗂️ Database Schema

- **departments** - Product categories
- **suppliers** - Supplier information
- **locations** - Warehouse locations
- **products** - Product master data
- **stock_batches** - Inventory batches with expiry dates
- **audit_log** - All inventory transactions

## 🔒 Security

- Database credentials stored in `/opt/bcinv/.env`
- Automatic password generation during installation
- Systemd service runs with restricted permissions

## 🆘 Troubleshooting

**Service won't start:**
```bash
sudo journalctl -u bcinv-api -n 100
```

**Database connection issues:**
```bash
sudo systemctl status postgresql
sudo -u postgres psql -d bcinv -c 'SELECT COUNT(*) FROM products;'
```

**Port already in use:**
```bash
# Change port in .env file
sudo nano /opt/bcinv/.env
# Set PORT=3001
sudo systemctl restart bcinv-api
```

## 📝 License

MIT License - Free to use and modify

## 🤝 Contributing

Contributions welcome! Please open an issue or pull request.

## 📞 Support

For issues and questions, please check:
1. Service logs: `sudo journalctl -u bcinv-api -n 50`
2. Database status: `sudo systemctl status postgresql`
3. GitHub Issues: [https://github.com/zv20/bcinv/issues](https://github.com/zv20/bcinv/issues)
