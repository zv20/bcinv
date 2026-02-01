-- Migration: Add departments and suppliers tables
-- Run this migration on existing installations

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    contact_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add supplier_id to products table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='supplier_id') THEN
        ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add department_id to products table and migrate existing category data
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='department_id') THEN
        ALTER TABLE products ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;
        
        -- Migrate existing categories to departments
        INSERT INTO departments (name)
        SELECT DISTINCT category 
        FROM products 
        WHERE category IS NOT NULL AND category != ''
        ON CONFLICT (name) DO NOTHING;
        
        -- Update products with department_id based on category
        UPDATE products p
        SET department_id = d.id
        FROM departments d
        WHERE p.category = d.name AND p.category IS NOT NULL;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_department ON products(department_id);
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- Grant permissions
GRANT ALL PRIVILEGES ON departments TO bcinv;
GRANT ALL PRIVILEGES ON suppliers TO bcinv;
GRANT ALL PRIVILEGES ON SEQUENCE departments_id_seq TO bcinv;
GRANT ALL PRIVILEGES ON SEQUENCE suppliers_id_seq TO bcinv;
