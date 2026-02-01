# 🛒 BCInv - Simple Grocery Inventory Management

> Lightweight inventory system for grocery stores - track stock, expiry dates, and shelf locations.

## Features

- 📦 **Product Management** - Add, edit, delete products (supports 10k-20k items)
- 📍 **Multi-location Tracking** - Track stock across multiple shelves/sections
- 📅 **Expiry Monitoring** - Automatic daily checks for expired items
- 🔍 **Stock Audits** - Easy weekly/monthly shelf checks
- 💾 **PostgreSQL Backend** - Reliable, scalable database
- 🐳 **LXC Ready** - Single container deployment

## Quick Start

### Prerequisites

- Node.js 18+ or 20 LTS
- PostgreSQL 14+
- LXC container (Debian/Ubuntu based)

### Installation

```bash
# Clone repository
git clone https://github.com/zv20/bcinv.git
cd bcinv

# Run setup script (installs everything)
sudo bash setup.sh
```

The setup script will:
- Install Node.js 20 LTS
- Install and configure PostgreSQL
- Create database and user
- Install dependencies
- Run database migrations
- Create systemd services
- Start the application

### Manual Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npm run migrate

# Start API server
npm start

# Start worker (in another terminal)
npm run worker
```

## Usage

1. **Access the app**: http://localhost:3000
2. **Products Tab**: Add/edit/delete products
3. **Stock Tab**: Check in new stock, update quantities
4. **Expiring Tab**: View items expiring in 7 days
5. **Audit Mode**: Weekly/monthly shelf checks with damage tracking

## System Architecture

```
bcinv/
├── server.js              # Express API server
├── worker.js              # Background expiry checker
├── package.json           # Dependencies
├── migrations/            # Database schema
│   ├── 001_initial.sql
│   └── migrate.js
├── public/               # Frontend
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── setup.sh              # Installation script
├── update.sh             # Update script
└── README.md
```

## Database Schema

### Products Table
- Product info (name, SKU, category, unit)
- Support for 10k-20k products

### Stock Batches Table
- Track individual stock batches
- Expiry dates per batch
- Shelf/section locations
- Damage tracking
- Discard history

## Systemd Services

```bash
# Start services
sudo systemctl start bcinv-api
sudo systemctl start bcinv-worker

# Check status
sudo systemctl status bcinv-api
sudo systemctl status bcinv-worker

# View logs
journalctl -u bcinv-api -f
journalctl -u bcinv-worker -f
```

## Updates

```bash
# Pull latest changes and restart
bash update.sh
```

The update script automatically:
- Fetches updates from GitHub
- Shows changelog
- Creates database backup
- Runs migrations
- Restarts services

## API Endpoints

### Products
- `GET /api/products` - List all products
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Stock
- `GET /api/stock` - View all stock
- `POST /api/stock/add` - Add new stock batch
- `PUT /api/stock/update/:id` - Update quantity
- `POST /api/stock/discard/:id` - Mark as discarded
- `GET /api/stock/expiring` - Items expiring in 7 days
- `GET /api/stock/expired` - Already expired items

### Dashboard
- `GET /api/dashboard` - Summary stats

## Configuration

Edit `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bcinv
DB_USER=bcinv_user
DB_PASSWORD=your_password
```

## Backup & Restore

### Create Backup
```bash
pg_dump bcinv > backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Backup
```bash
psql bcinv < backups/backup_20260131_220000.sql
```

## LXC Container Deployment

See [docs/LXC_SETUP.md](docs/LXC_SETUP.md) for detailed LXC container setup guide.

## License

MIT License - see LICENSE file for details.

---

**Version**: 1.0.0  
**Status**: Production Ready  
**Support**: [GitHub Issues](https://github.com/zv20/bcinv/issues)