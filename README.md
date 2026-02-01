# BC Inventory Management System

> Simple, focused grocery inventory system for tracking 10,000-20,000 products with expiry monitoring and shelf audits.

## Features

### Core Functionality
- ✅ **Product Management** - Add/edit/delete products with SKU tracking
- 📦 **Stock Tracking** - Monitor inventory across multiple shelf locations
- 📅 **Expiry Management** - Track expiration dates and get 7-day warnings
- 🔍 **Audit System** - Record weekly/monthly shelf checks and adjustments
- ⚠️ **Discard Tracking** - Log expired and damaged items
- 📊 **Simple Dashboard** - View stock levels, expiring items, recent activity

### Optimized for Scale
- Handles 10,000-20,000 products efficiently
- Indexed database queries for fast lookups
- PostgreSQL for reliability and performance

## Quick Start

### Prerequisites
- LXC container (Ubuntu/Debian)
- Root access for initial setup

### Installation

```bash
# Clone repository
git clone https://github.com/zv20/bcinv.git
cd bcinv

# Run automated setup
sudo bash setup.sh
```

The setup script will:
1. Install Node.js 20 LTS
2. Install and configure PostgreSQL
3. Create database and user
4. Install dependencies
5. Run database migrations
6. Create systemd services
7. Start the application

### Access

```
http://your-lxc-ip:3000
```

## Usage

### Product Management
1. Add products with SKU, name, category
2. Assign to shelf locations
3. Track cost price for inventory value

### Stock Audits
1. Navigate to **Audit** section
2. Select location/shelf
3. Update quantities based on physical count
4. System logs all changes automatically

### Expiry Monitoring
- View **Expiring Soon** to see items expiring in 7 days
- Mark items as expired or damaged
- System tracks discard reasons (expired/damaged/other)

## Updates

```bash
# Pull latest changes from GitHub
bash update.sh
```

Update script automatically:
- Creates PostgreSQL backup
- Pulls code updates
- Runs database migrations
- Restarts services
- Shows rollback command if issues occur

## System Services

```bash
# API server
sudo systemctl status bcinv-api
sudo systemctl restart bcinv-api

# Background worker (expiry checks)
sudo systemctl status bcinv-worker
sudo systemctl restart bcinv-worker

# View logs
journalctl -u bcinv-api -f
journalctl -u bcinv-worker -f
```

## Database

### Tables
- `products` - Product catalog
- `locations` - Shelf/section definitions
- `stock_batches` - Individual stock entries with expiry
- `audit_log` - All stock changes
- `discarded_items` - Expired/damaged tracking

### Backups

```bash
# Manual backup
pg_dump -U bcinv_user bcinv > backup_$(date +%Y%m%d).sql

# Restore
psql -U bcinv_user bcinv < backup_20260131.sql
```

## Architecture

```
bcinv/
├── server.js              # Express API server
├── worker.js              # Background expiry checker
├── database/
│   └── schema.sql        # Database schema
├── migrations/
│   └── migrate.js        # Migration runner
├── routes/
│   ├── products.js
│   ├── stock.js
│   └── audit.js
├── public/               # Frontend
│   ├── index.html
│   ├── css/
│   └── js/
├── setup.sh             # Installation script
└── update.sh            # Update script
```

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL 14+
- **Frontend**: Vanilla JavaScript + Bootstrap 5
- **Process Manager**: systemd
- **Container**: LXC

## License

MIT

---

**Version**: 0.1.0  
**Status**: Active Development