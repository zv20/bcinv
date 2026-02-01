# Database Migrations

## Overview

This directory contains SQL migration files for the BCInv database schema.

## Migration Files

- `001_initial.sql` - Initial schema (products, stock_batches, views)
- `migrate.js` - Migration runner script

## Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Or directly
node migrations/migrate.js
```

## How Migrations Work

1. Migration runner connects to PostgreSQL
2. Creates `migrations` table if it doesn't exist
3. Checks which migrations have already been executed
4. Runs pending migrations in alphabetical order
5. Records each successful migration in the `migrations` table

## Creating New Migrations

1. Create a new file: `002_description.sql`
2. Add your SQL commands
3. Include at the end:
   ```sql
   INSERT INTO migrations (name) VALUES ('002_description.sql')
   ON CONFLICT (name) DO NOTHING;
   ```
4. Run `npm run migrate`

## Database Schema

### Products Table
```sql
products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  category VARCHAR(100),
  unit VARCHAR(20) DEFAULT 'units',
  description TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Stock Batches Table
```sql
stock_batches (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  quantity DECIMAL(10,2),
  expiry_date DATE,
  location VARCHAR(100),
  notes TEXT,
  damaged BOOLEAN DEFAULT FALSE,
  damage_reason TEXT,
  discarded BOOLEAN DEFAULT FALSE,
  discarded_at TIMESTAMP,
  discard_reason TEXT,
  added_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Views

- `active_stock` - All non-discarded stock with expiry status
- `expiring_items` - Items expiring within 7 days
- `expired_items` - Already expired items

## Rollback

To rollback:
1. Manually drop tables/views
2. Delete entry from `migrations` table
3. Re-run migrations

```sql
-- Example rollback
DELETE FROM migrations WHERE name = '001_initial.sql';
DROP VIEW IF EXISTS expired_items;
DROP VIEW IF EXISTS expiring_items;
DROP VIEW IF EXISTS active_stock;
DROP TABLE IF EXISTS stock_batches;
DROP TABLE IF EXISTS products;
```