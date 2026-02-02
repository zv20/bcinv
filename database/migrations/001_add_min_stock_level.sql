-- Add min_stock_level column to products table for low stock alerts
-- Sprint 2 - Issue #1

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 10;

COMMENT ON COLUMN products.min_stock_level IS 'Minimum stock level threshold for low stock alerts';
