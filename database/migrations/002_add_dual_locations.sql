-- Migration: Add dual-location support to products
-- Adds storage_location_id and shelf_location_id to products table
-- Created: 2026-02-06

-- Add storage location (primary/default location - usually backroom/warehouse)
ALTER TABLE products 
ADD COLUMN storage_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;

-- Add shelf location (display/sales area - usually retail floor/shelf)
ALTER TABLE products 
ADD COLUMN shelf_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX idx_products_storage_location ON products(storage_location_id);
CREATE INDEX idx_products_shelf_location ON products(shelf_location_id);

-- Add comments for documentation
COMMENT ON COLUMN products.storage_location_id IS 'Primary storage location (warehouse, backroom)';
COMMENT ON COLUMN products.shelf_location_id IS 'Display/sales location (retail floor, shelf)';

COMMIT;
