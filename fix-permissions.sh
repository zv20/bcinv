#!/bin/bash

# BC Inventory - Database Permissions Fix Script
# This script fixes PostgreSQL permission issues for the bcinv user

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔧 Fixing BC Inventory Database Permissions...${NC}\n"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}✖ This script must be run as root${NC}"
   exit 1
fi

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    echo -e "${RED}✖ PostgreSQL is not running${NC}"
    echo "Starting PostgreSQL..."
    systemctl start postgresql
    sleep 2
fi

echo -e "${YELLOW}📋 Granting permissions to bcinv user...${NC}"

# Run the fix as postgres user
su - postgres -c "psql -d bcinv" << 'EOF'
-- Grant all permissions on all tables to bcinv user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bcinv;

-- Grant permissions on sequences (for auto-increment IDs)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bcinv;

-- Grant permissions on views
GRANT ALL PRIVILEGES ON ALL VIEWS IN SCHEMA public TO bcinv;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bcinv;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bcinv;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON VIEWS TO bcinv;

-- Recreate the expiring items view to ensure it exists
DROP VIEW IF EXISTS v_expiring_items;
CREATE VIEW v_expiring_items AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sku,
    sb.id as batch_id,
    sb.quantity,
    sb.expiry_date,
    l.name as location_name,
    EXTRACT(DAY FROM (sb.expiry_date - CURRENT_DATE)) as days_until_expiry
FROM stock_batches sb
JOIN products p ON sb.product_id = p.id
LEFT JOIN locations l ON sb.location_id = l.id
WHERE sb.status = 'active'
    AND sb.expiry_date IS NOT NULL
    AND sb.expiry_date <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY sb.expiry_date ASC;

-- Grant permissions on the view
GRANT ALL PRIVILEGES ON v_expiring_items TO bcinv;

-- Recreate the current stock view
DROP VIEW IF EXISTS v_current_stock;
CREATE VIEW v_current_stock AS
SELECT 
    p.id,
    p.name,
    p.category,
    p.sku,
    p.unit,
    l.name as location_name,
    COALESCE(SUM(sb.quantity), 0) as total_quantity,
    MIN(sb.expiry_date) as earliest_expiry,
    COUNT(DISTINCT sb.id) as batch_count
FROM products p
LEFT JOIN stock_batches sb ON p.id = sb.product_id AND sb.status = 'active'
LEFT JOIN locations l ON sb.location_id = l.id
GROUP BY p.id, p.name, p.category, p.sku, p.unit, l.name;

-- Grant permissions on the view
GRANT ALL PRIVILEGES ON v_current_stock TO bcinv;

-- Show confirmation
\echo '✓ Permissions granted successfully'
\echo ''
\echo 'Tables accessible by bcinv user:'
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

\echo ''
\echo 'Views accessible by bcinv user:'
SELECT schemaname, viewname 
FROM pg_views 
WHERE schemaname = 'public' 
ORDER BY viewname;
EOF

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ Database permissions fixed successfully!${NC}\n"
    
    echo -e "${YELLOW}🔄 Restarting bcinv services...${NC}"
    systemctl restart bcinv-api bcinv-worker
    
    sleep 2
    
    if systemctl is-active --quiet bcinv-api && systemctl is-active --quiet bcinv-worker; then
        echo -e "${GREEN}✓ Services restarted successfully${NC}\n"
        
        IP=$(hostname -I | awk '{print $1}')
        echo -e "${GREEN}✅ All fixed! Try accessing the app now:${NC}"
        echo -e "${GREEN}   http://${IP}:3000${NC}\n"
    else
        echo -e "${RED}✖ Services failed to restart${NC}"
        echo -e "${YELLOW}Check logs: journalctl -u bcinv-api -n 20${NC}\n"
    fi
else
    echo -e "\n${RED}✖ Failed to fix permissions${NC}"
    echo -e "${YELLOW}Check PostgreSQL status: systemctl status postgresql${NC}\n"
    exit 1
fi
