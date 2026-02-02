/**
 * PDF Export Utility
 * Exports inventory data to PDF format
 */

const PDFDocument = require('pdfkit');

class PDFExporter {
    /**
     * Export expiring soon items to PDF
     */
    static async exportExpiringSoon(pool, days = 7) {
        const query = `
            SELECT 
                p.name,
                p.sku,
                p.quantity,
                p.unit,
                p.expiration_date,
                EXTRACT(DAY FROM (p.expiration_date - CURRENT_DATE)) as days_until_expiry,
                l.name as location
            FROM products p
            LEFT JOIN locations l ON p.location_id = l.id
            WHERE p.expiration_date IS NOT NULL
            AND p.expiration_date <= CURRENT_DATE + INTERVAL '${days} days'
            ORDER BY p.expiration_date ASC
        `;

        const result = await pool.query(query);
        return this.generatePDF('Expiring Soon Items', result.rows);
    }

    /**
     * Export low stock items to PDF
     */
    static async exportLowStock(pool) {
        const query = `
            SELECT 
                p.name,
                p.sku,
                p.quantity,
                p.unit,
                p.min_stock_level,
                (p.min_stock_level - p.quantity) as quantity_needed
            FROM products p
            WHERE p.quantity < p.min_stock_level
            ORDER BY (p.min_stock_level - p.quantity) DESC
        `;

        const result = await pool.query(query);
        return this.generatePDF('Low Stock Items', result.rows);
    }

    /**
     * Generate PDF document
     */
    static generatePDF(title, data) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument();
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));

                // Title
                doc.fontSize(20).text(title, { align: 'center' });
                doc.moveDown();
                doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
                doc.moveDown(2);

                // Table headers
                doc.fontSize(12);
                const startY = doc.y;
                let currentY = startY;

                // Simple table
                data.forEach((row, index) => {
                    if (currentY > 700) {
                        doc.addPage();
                        currentY = 50;
                    }

                    doc.fontSize(10);
                    let text = `${index + 1}. ${row.name} (${row.sku})`;
                    if (row.quantity !== undefined) {
                        text += ` - Stock: ${row.quantity}`;
                    }
                    if (row.days_until_expiry !== undefined) {
                        text += ` - Expires in ${row.days_until_expiry} days`;
                    }
                    
                    doc.text(text);
                    currentY = doc.y;
                    doc.moveDown(0.5);
                });

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = PDFExporter;
