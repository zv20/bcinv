# BC Inventory - Fresh Installation Quick Start

## 🎉 Clean Installation - No Legacy Code!

This repository is now **100% clean** with no legacy code, migrations, or deprecated fields.

## ⚡ Super Quick Install (1 Command)

On a fresh Ubuntu/Debian server, run:

```bash
curl -sSL https://raw.githubusercontent.com/zv20/bcinv/main/install.sh | sudo bash
```

**That's it!** The script will:
1. ✅ Install PostgreSQL & Node.js
2. ✅ Create database with secure password
3. ✅ Clone and setup application  
4. ✅ Start the service automatically
5. ✅ Load default departments & locations

## 💻 Access Your System

After installation completes, open:

```
http://YOUR_SERVER_IP:3000
```

## 🎯 What's Included

### Pre-loaded Data:
- **4 Departments**: General, Food, Beverages, Supplies
- **3 Locations**: Warehouse A, Warehouse B, Retail Floor

### Features:
- **Products** with department & supplier dropdowns
- **Stock batches** with expiry tracking
- **Departments** management (add/edit/delete)
- **Suppliers** management with contact info
- **Locations** management for warehouses
- **Dashboard** with real-time stats
- **Expiring items** alerts
- **Complete audit log**

## 🔑 Database Fields (Clean Schema)

### Products Table:
- `name` - Product name
- `sku` - Barcode/SKU
- `department_id` - **Dropdown**: Link to departments
- `supplier_id` - **Dropdown**: Link to suppliers
- `items_per_case` - **Number**: How many items in one case
- `price_per_case` - **Decimal**: Cost per case

**NO legacy fields like "unit" or "cost_price" - everything is clean!**

## 🔧 Common Commands

```bash
# Check status
sudo systemctl status bcinv-api

# View real-time logs
sudo journalctl -u bcinv-api -f

# Restart service
sudo systemctl restart bcinv-api

# Backup database
sudo -u postgres pg_dump bcinv > backup.sql
```

## 🏗️ Starting Fresh on Existing Server

If you already have the old version running:

```bash
# Stop old service
sudo systemctl stop bcinv-api

# Backup old database (optional)
sudo -u postgres pg_dump bcinv > old_backup.sql

# Drop old database
sudo -u postgres psql -c 'DROP DATABASE IF EXISTS bcinv;'
sudo -u postgres psql -c 'DROP USER IF EXISTS bcinv_user;'

# Remove old installation
sudo rm -rf /opt/bcinv

# Run fresh install
curl -sSL https://raw.githubusercontent.com/zv20/bcinv/main/install.sh | sudo bash
```

## ✨ What's Different from Old Version?

### REMOVED:
- ❌ Migration scripts
- ❌ Legacy "unit" text field
- ❌ Legacy "cost_price" field
- ❌ Legacy "category" text field
- ❌ Backward compatibility code

### ADDED:
- ✅ `items_per_case` (number)
- ✅ `price_per_case` (decimal)
- ✅ `department_id` (dropdown)
- ✅ `supplier_id` (dropdown)
- ✅ Full CRUD for departments, suppliers, locations
- ✅ Clean database schema

## 📚 Documentation

- **Quick Install**: This file
- **Detailed Manual Install**: [INSTALL.md](INSTALL.md)
- **Full README**: [README.md](README.md)

## 🚀 Ready?

Just run the install command and you'll have a clean, modern inventory system in minutes!

```bash
curl -sSL https://raw.githubusercontent.com/zv20/bcinv/main/install.sh | sudo bash
```
