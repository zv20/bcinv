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
        return this.generateExcel('Expiring Soon Items', result.rows);
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
        return this.generateExcel('Low Stock Items', result.rows);
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
        return this.generateExcel('Full Inventory', result.rows);
    }

    /**
     * Generate Excel workbook
     */
    static async generateExcel(sheetName, data) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        if (data.length === 0) {
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
