-- Migration: Add missing columns and views to existing database
-- Run this if you installed before the schema fixes were added
-- Date: 2026-02-02

-- Add missing columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 10;

-- Backfill unit from items_per_case if needed
UPDATE products SET unit = items_per_case WHERE unit IS NULL AND items_per_case IS NOT NULL;

-- Add missing columns to stock_batches table
ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);
ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS last_audit_at TIMESTAMP;

-- Add missing column to audit_log table
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS quantity_change DECIMAL(10,2);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_stock_status ON stock_batches(status);

-- Create or replace the expiring items view
CREATE OR REPLACE VIEW v_expiring_items AS
SELECT
    sb.id AS batch_id,
    p.name AS product_name,
    p.sku AS barcode,
    l.name AS location_name,
    sb.quantity,
    sb.expiry_date,
    (sb.expiry_date - CURRENT_DATE) AS days_left
FROM stock_batches sb
JOIN products p ON p.id = sb.product_id
LEFT JOIN locations l ON l.id = sb.location_id
WHERE sb.expiry_date IS NOT NULL
  AND sb.expiry_date <= CURRENT_DATE + INTERVAL '7 days'
  AND sb.status = 'active';

COMMIT;
