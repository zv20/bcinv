-- Initial database schema for BCInv
-- Products and Stock Batches tables

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  category VARCHAR(100),
  unit VARCHAR(20) DEFAULT 'units',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast product lookups
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sku ON products(sku);

-- Stock batches table
CREATE TABLE IF NOT EXISTS stock_batches (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  expiry_date DATE,
  location VARCHAR(100),
  notes TEXT,
  damaged BOOLEAN DEFAULT FALSE,
  damage_reason TEXT,
  discarded BOOLEAN DEFAULT FALSE,
  discarded_at TIMESTAMP,
  discard_reason TEXT,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for stock queries
CREATE INDEX idx_stock_product ON stock_batches(product_id);
CREATE INDEX idx_stock_expiry ON stock_batches(expiry_date);
CREATE INDEX idx_stock_location ON stock_batches(location);
CREATE INDEX idx_stock_discarded ON stock_batches(discarded);

-- View for active stock (non-discarded)
CREATE OR REPLACE VIEW active_stock AS
SELECT 
  sb.id,
  sb.product_id,
  p.name as product_name,
  p.sku,
  p.category,
  p.unit,
  sb.quantity,
  sb.expiry_date,
  sb.location,
  sb.damaged,
  sb.damage_reason,
  sb.added_at,
  CASE 
    WHEN sb.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN sb.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'expiring_soon'
    ELSE 'ok'
  END as status
FROM stock_batches sb
JOIN products p ON sb.product_id = p.id
WHERE sb.discarded = FALSE
ORDER BY sb.expiry_date ASC NULLS LAST;

-- View for expiring items (within 7 days)
CREATE OR REPLACE VIEW expiring_items AS
SELECT 
  sb.id,
  sb.product_id,
  p.name as product_name,
  p.sku,
  p.category,
  sb.quantity,
  sb.expiry_date,
  sb.location,
  CURRENT_DATE - sb.expiry_date as days_until_expiry
FROM stock_batches sb
JOIN products p ON sb.product_id = p.id
WHERE sb.discarded = FALSE
  AND sb.expiry_date IS NOT NULL
  AND sb.expiry_date <= CURRENT_DATE + INTERVAL '7 days'
  AND sb.expiry_date >= CURRENT_DATE
ORDER BY sb.expiry_date ASC;

-- View for already expired items
CREATE OR REPLACE VIEW expired_items AS
SELECT 
  sb.id,
  sb.product_id,
  p.name as product_name,
  p.sku,
  p.category,
  sb.quantity,
  sb.expiry_date,
  sb.location,
  CURRENT_DATE - sb.expiry_date as days_expired
FROM stock_batches sb
JOIN products p ON sb.product_id = p.id
WHERE sb.discarded = FALSE
  AND sb.expiry_date IS NOT NULL
  AND sb.expiry_date < CURRENT_DATE
ORDER BY sb.expiry_date ASC;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_updated_at BEFORE UPDATE ON stock_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration tracking table
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Record this migration
INSERT INTO migrations (name) VALUES ('001_initial.sql')
ON CONFLICT (name) DO NOTHING;