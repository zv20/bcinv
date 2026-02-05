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
                p.name as product_name,
                p.sku,
                p.barcode,
                p.unit,
                l.name as location,
                sb.quantity,
                sb.batch_number,
                TO_CHAR(sb.expiry_date, 'YYYY-MM-DD') as expiry_date,
                EXTRACT(DAY FROM (sb.expiry_date - CURRENT_DATE))::INTEGER as days_until_expiry,
                d.name as department,
                s.name as supplier,
                TO_CHAR(sb.received_at, 'YYYY-MM-DD') as received_date
            FROM stock_batches sb
            JOIN products p ON sb.product_id = p.id
            LEFT JOIN locations l ON sb.location_id = l.id
            LEFT JOIN departments d ON p.department_id = d.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE sb.status = 'active'
            AND sb.expiry_date IS NOT NULL
            AND sb.expiry_date <= CURRENT_DATE + INTERVAL '${days} days'
            AND sb.expiry_date > CURRENT_DATE
            ORDER BY sb.expiry_date ASC, p.name
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
                p.name as product_name,
                p.sku,
                p.barcode,
                p.category,
                p.unit,
                l.name as location,
                sb.quantity as batch_quantity,
                sb.batch_number,
                TO_CHAR(sb.expiry_date, 'YYYY-MM-DD') as expiry_date,
                sb.status as batch_status,
                d.name as department,
                s.name as supplier,
                p.cost_price,
                p.min_stock_level,
                TO_CHAR(sb.received_at, 'YYYY-MM-DD') as received_date,
                TO_CHAR(p.created_at, 'YYYY-MM-DD') as product_created
            FROM stock_batches sb
            JOIN products p ON sb.product_id = p.id
            LEFT JOIN locations l ON sb.location_id = l.id
            LEFT JOIN departments d ON p.department_id = d.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE sb.status = 'active'
            ORDER BY p.name, sb.expiry_date ASC NULLS LAST
        `;

        const result = await pool.query(query);
        return this.generateCSV(result.rows);
    }

    /**
     * Generate CSV from data
     */
    static generateCSV(data) {
        try {
            if (data.length === 0) {
                return 'No data available';
            }
            const parser = new Parser();
            return parser.parse(data);
        } catch (error) {
            console.error('CSV generation error:', error);
            throw new Error('Failed to generate CSV');
        }
    }
}

module.exports = CSVExporter;
