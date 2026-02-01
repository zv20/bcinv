# Deployment Instructions - Departments & Suppliers Feature

## Overview
This update adds:
- **Departments management** - Pre-define departments for product categorization
- **Suppliers management** - Track supplier information
- **Locations management** - Full CRUD operations for warehouse locations
- **Dropdown menus** in product forms for Department, Supplier, and Location selection

## Deployment Steps

### 1. Pull Latest Code
```bash
cd /opt/bcinv
git pull origin main
```

### 2. Run Database Migration
```bash
chmod +x run-migration.sh
sudo ./run-migration.sh
```

This migration will:
- Create `departments` table
- Create `suppliers` table  
- Add `department_id` and `supplier_id` columns to products
- Migrate existing `category` values to the `departments` table
- Set up proper foreign key relationships

### 3. Restart API Server
```bash
sudo systemctl restart bcinv-api
sudo systemctl status bcinv-api
```

### 4. Verify Installation
1. Open your browser and go to `http://your-server-ip:3000`
2. Check the navigation menu - you should see new sections
3. Try adding a new product - Department should now be a dropdown
4. Navigate to Settings to manage Departments, Suppliers, and Locations

## New Features

### Departments
- Navigate to **Settings → Departments**
- Add, edit, and delete department categories
- Departments appear as dropdown options when creating/editing products

### Suppliers  
- Navigate to **Settings → Suppliers**
- Add supplier information: name, contact, phone, email, address, notes
- Select supplier from dropdown when creating/editing products

### Locations (Enhanced)
- Navigate to **Locations** (now with full CRUD)
- Add, edit, and delete warehouse locations
- Locations appear as dropdown options when adding stock

### Product Form Changes
- **Department**: Now a dropdown menu (previously free text "Category")
- **Supplier**: New dropdown menu to select product supplier
- **Items per Case**: Number field (previously "Unit" dropdown)
- **Price per Case**: Renamed from "Cost Price"

## Rollback (if needed)

If you need to rollback:

```bash
cd /opt/bcinv
git checkout 839ec574072cedda23f78b2433a594ff5dfcf421
sudo systemctl restart bcinv-api
```

## Database Changes

New tables:
- `departments` - Product department/category definitions
- `suppliers` - Supplier contact information

Modified tables:
- `products` - Added `department_id` and `supplier_id` foreign keys

The `category` column in products is kept for backward compatibility but is now supplemented by `department_id`.

## Troubleshooting

### Migration fails
```bash
# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Or run migration manually
sudo su - postgres
psql -d bcinv -f /opt/bcinv/database/migrations/001_add_departments_suppliers.sql
```

### API won't start
```bash
# Check API logs
sudo journalctl -u bcinv-api -n 50 -f

# Verify database connection
su - postgres -c "psql -d bcinv -c 'SELECT COUNT(*) FROM departments'"
```

### Frontend not updating
```bash
# Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
# Or clear cache in browser settings
```

## Support

If you encounter issues, check:
1. Database migration completed successfully
2. API server restarted and running
3. Browser cache cleared
4. No errors in: `sudo journalctl -u bcinv-api -n 100`
