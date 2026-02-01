-- BC Inventory Database Schema
-- Optimized for 10,000-20,000 products with audit tracking

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    sku VARCHAR(50) UNIQUE,
    unit VARCHAR(20) DEFAULT 'units',
    description TEXT,
    cost_price DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Locations/Shelves table
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    section VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock batches (each time stock is added/audited)
CREATE TABLE IF NOT EXISTS stock_batches (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    expiry_date DATE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_audit_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT
);

-- Audit log (track all stock changes)
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    batch_id INTEGER REFERENCES stock_batches(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    quantity_change DECIMAL(10,2),
    reason VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Damaged/Expired items tracking
CREATE TABLE IF NOT EXISTS discarded_items (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER REFERENCES stock_batches(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2) NOT NULL,
    reason VARCHAR(50) NOT NULL,
    discarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Create indexes for performance (important for 10k-20k products)
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_stock_product ON stock_batches(product_id);
CREATE INDEX idx_stock_location ON stock_batches(location_id);
CREATE INDEX idx_stock_expiry ON stock_batches(expiry_date);
CREATE INDEX idx_stock_status ON stock_batches(status);
CREATE INDEX idx_audit_product ON audit_log(product_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- View: Current stock summary by product
CREATE OR REPLACE VIEW v_current_stock AS
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

-- View: Expiring items (within warning period)
CREATE OR REPLACE VIEW v_expiring_items AS
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