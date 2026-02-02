# BC Inventory Database

## Fresh Installation

For a new installation, use the main schema file:

```bash
su - postgres
psql -d bcinv -f /opt/bcinv/database/schema.sql
```

This will create all tables, indexes, views, and insert default data.

## Upgrading Existing Installation

If you installed before 2026-02-02 and are missing database columns, run the migration:

```bash
su - postgres
psql -d bcinv -f /opt/bcinv/database/migrations/001_add_missing_columns.sql
```

Then restart the API service:

```bash
systemctl restart bcinv-api
```

## Database Schema

### Tables

- **departments** - Product categories/departments
- **suppliers** - Supplier information
- **locations** - Warehouse/storage locations
- **products** - Product catalog
- **stock_batches** - Individual stock batches with expiry dates
- **audit_log** - Audit trail of all inventory changes

### Views

- **v_expiring_items** - Products expiring within 7 days

### Key Features

- **FIFO Support**: Stock batches ordered by expiry date
- **Audit Trail**: All changes logged automatically
- **Flexible Schema**: Nullable fields for optional data
- **Performance Indexes**: Optimized for common queries

## Troubleshooting

### Missing Columns Error

If you see errors like `column "status" does not exist`, run the migration script:

```bash
su - postgres
psql -d bcinv -f /opt/bcinv/database/migrations/001_add_missing_columns.sql
```

### Reset Database

To completely reset the database (WARNING: deletes all data):

```bash
su - postgres
psql -d bcinv -f /opt/bcinv/database/schema.sql
```
