-- BC Inventory Management System - Clean Database Schema
-- Fresh installation (no migrations needed)

DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS stock_batches CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP VIEW IF EXISTS v_expiring_items CASCADE;

-- Departments (Product Categories)
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Locations (Warehouse locations)
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    section VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    sku VARCHAR(100),
    barcode VARCHAR(100),
    unit INTEGER,
    description TEXT,
    cost_price DECIMAL(10,2),
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    items_per_case INTEGER,
    price_per_case DECIMAL(10,2),
    min_stock_level INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock Batches
CREATE TABLE stock_batches (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    expiry_date DATE,
    batch_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_audit_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    batch_id INTEGER REFERENCES stock_batches(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    quantity DECIMAL(10,2),
    quantity_change DECIMAL(10,2),
    reason VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_products_department ON products(department_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_stock_product ON stock_batches(product_id);
CREATE INDEX idx_stock_location ON stock_batches(location_id);
CREATE INDEX idx_stock_expiry ON stock_batches(expiry_date);
CREATE INDEX idx_stock_status ON stock_batches(status);
CREATE INDEX idx_audit_product ON audit_log(product_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- Expiring Items View
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

-- Insert default data
INSERT INTO departments (name, description) VALUES 
    ('General', 'General products'),
    ('Food', 'Food items'),
    ('Beverages', 'Drinks and beverages'),
    ('Supplies', 'General supplies');

INSERT INTO locations (name, section, description) VALUES 
    ('Warehouse A', 'Main', 'Main warehouse storage'),
    ('Warehouse B', 'Cold', 'Refrigerated storage'),
    ('Retail Floor', 'Front', 'Store display area');

COMMIT;
