/**
 * CSV Export Utility
 * Exports inventory data to CSV format
 */

const { Parser } = require('json2csv');

class CSVExporter {
    /**
     * Export expiring soon items
     */
    static async exportExpiringSoon(pool, days = 7) {
        const query = `
            SELECT 
                p.name,
                p.sku,
                p.barcode,
                p.quantity,
                p.unit,
                p.expiration_date,
                EXTRACT(DAY FROM (p.expiration_date - CURRENT_DATE)) as days_until_expiry,
                d.name as department,
                l.name as location,
                s.name as supplier
            FROM products p
            LEFT JOIN departments d ON p.department_id = d.id
            LEFT JOIN locations l ON p.location_id = l.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.expiration_date IS NOT NULL
            AND p.expiration_date <= CURRENT_DATE + INTERVAL '${days} days'
            ORDER BY p.expiration_date ASC
        `;

        const result = await pool.query(query);
        return this.generateCSV(result.rows);
    }

    /**
     * Export low stock items
     */
    static async exportLowStock(pool) {
        const query = `
            SELECT 
                p.name,
                p.sku,
                p.barcode,
                p.quantity,
                p.unit,
                p.min_stock_level,
                (p.min_stock_level - p.quantity) as quantity_needed,
                d.name as department,
                l.name as location,
                s.name as supplier
            FROM products p
            LEFT JOIN departments d ON p.department_id = d.id
            LEFT JOIN locations l ON p.location_id = l.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.quantity < p.min_stock_level
            ORDER BY (p.min_stock_level - p.quantity) DESC
        `;

        const result = await pool.query(query);
        return this.generateCSV(result.rows);
    }

    /**
     * Export full inventory
     */
    static async exportFullInventory(pool) {
        const query = `
            SELECT 
                p.name,
                p.sku,
                p.barcode,
                p.quantity,
                p.unit,
                p.min_stock_level,
                p.expiration_date,
                d.name as department,
                l.name as location,
                s.name as supplier,
                p.created_at
            FROM products p
            LEFT JOIN departments d ON p.department_id = d.id
            LEFT JOIN locations l ON p.location_id = l.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            ORDER BY p.name ASC
        `;

        const result = await pool.query(query);
        return this.generateCSV(result.rows);
    }

    /**
     * Generate CSV from data
     */
    static generateCSV(data) {
        try {
            const parser = new Parser();
            return parser.parse(data);
        } catch (error) {
            console.error('CSV generation error:', error);
            throw new Error('Failed to generate CSV');
        }
    }
}

module.exports = CSVExporter;
