/**
 * Excel Export Utility
 * Exports inventory data to Excel format
 */

const ExcelJS = require('exceljs');

class ExcelExporter {
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
        return this.generateExcel('Expiring Soon Items', result.rows);
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
        return this.generateExcel('Full Inventory', result.rows);
    }

    /**
     * Generate Excel workbook
     */
    static async generateExcel(sheetName, data) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        if (data.length === 0) {
            worksheet.addRow(['No data available']);
            return await workbook.xlsx.writeBuffer();
        }

        // Add headers
        const headers = Object.keys(data[0]);
        worksheet.columns = headers.map(header => ({
            header: header.replace(/_/g, ' ').toUpperCase(),
            key: header,
            width: 15
        }));

        // Style headers
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Add data rows
        data.forEach(row => {
            worksheet.addRow(row);
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            if (column.values) {
                const lengths = column.values.map(v => v ? v.toString().length : 10);
                column.width = Math.max(...lengths) + 2;
            }
        });

        return await workbook.xlsx.writeBuffer();
    }
}

module.exports = ExcelExporter;
