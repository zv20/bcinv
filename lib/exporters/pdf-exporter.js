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
                p.unit,
                l.name as location,
                sb.quantity,
                sb.expiry_date,
                sb.batch_number,
                EXTRACT(DAY FROM (sb.expiry_date - CURRENT_DATE))::INTEGER as days_until_expiry
            FROM stock_batches sb
            JOIN products p ON sb.product_id = p.id
            LEFT JOIN locations l ON sb.location_id = l.id
            WHERE sb.status = 'active'
            AND sb.expiry_date IS NOT NULL
            AND sb.expiry_date <= CURRENT_DATE + INTERVAL '${days} days'
            AND sb.expiry_date > CURRENT_DATE
            ORDER BY sb.expiry_date ASC, p.name
        `;

        const result = await pool.query(query);
        return this.generateExpiringSoonPDF(result.rows, days);
    }

    /**
     * Export low stock items to PDF
     */
    static async exportLowStock(pool) {
        const query = `
            SELECT 
                p.name,
                p.sku,
                p.unit,
                p.min_stock_level,
                d.name as department,
                s.name as supplier,
                COALESCE(SUM(sb.quantity), 0)::INTEGER as current_quantity,
                (p.min_stock_level - COALESCE(SUM(sb.quantity), 0))::INTEGER as quantity_needed
            FROM products p
            LEFT JOIN stock_batches sb ON p.id = sb.product_id AND sb.status = 'active'
            LEFT JOIN departments d ON p.department_id = d.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.min_stock_level IS NOT NULL
            GROUP BY p.id, p.name, p.sku, p.unit, p.min_stock_level, d.name, s.name
            HAVING COALESCE(SUM(sb.quantity), 0) < p.min_stock_level
            ORDER BY (p.min_stock_level - COALESCE(SUM(sb.quantity), 0)) DESC
        `;

        const result = await pool.query(query);
        return this.generateLowStockPDF(result.rows);
    }

    /**
     * Generate PDF for expiring soon items
     */
    static generateExpiringSoonPDF(data, days) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Title
                doc.fontSize(20).font('Helvetica-Bold').text('Expiring Soon Items', { align: 'center' });
                doc.moveDown(0.5);
                doc.fontSize(12).font('Helvetica').text(`Items expiring within ${days} days`, { align: 'center' });
                doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
                doc.fontSize(10).text(`Total Items: ${data.length}`, { align: 'center' });
                doc.moveDown(2);

                if (data.length === 0) {
                    doc.fontSize(12).text('No items expiring in this timeframe.', { align: 'center' });
                    doc.end();
                    return;
                }

                // Table header
                const tableTop = doc.y;
                const tableHeaders = [
                    { text: 'Product', x: 50, width: 150 },
                    { text: 'SKU', x: 200, width: 70 },
                    { text: 'Location', x: 270, width: 80 },
                    { text: 'Qty', x: 350, width: 40 },
                    { text: 'Expiry Date', x: 390, width: 80 },
                    { text: 'Days Left', x: 470, width: 60 }
                ];

                doc.fontSize(10).font('Helvetica-Bold');
                tableHeaders.forEach(header => {
                    doc.text(header.text, header.x, tableTop, { width: header.width, continued: false });
                });

                // Draw line under header
                doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
                doc.moveDown(1);

                // Table rows
                doc.font('Helvetica').fontSize(9);
                data.forEach((row, index) => {
                    if (doc.y > 720) {
                        doc.addPage();
                        doc.fontSize(10).font('Helvetica-Bold');
                        tableHeaders.forEach(header => {
                            doc.text(header.text, header.x, doc.y, { width: header.width, continued: false });
                        });
                        doc.moveTo(50, doc.y + 15).lineTo(550, doc.y + 15).stroke();
                        doc.moveDown(1);
                        doc.font('Helvetica').fontSize(9);
                    }

                    const rowY = doc.y;
                    
                    // Color code by urgency
                    if (row.days_until_expiry <= 3) {
                        doc.fillColor('#DC2626'); // Red
                    } else if (row.days_until_expiry <= 7) {
                        doc.fillColor('#EA580C'); // Orange
                    } else {
                        doc.fillColor('#000000'); // Black
                    }

                    doc.text(row.name || 'N/A', 50, rowY, { width: 150, continued: false });
                    doc.text(row.sku || 'N/A', 200, rowY, { width: 70, continued: false });
                    doc.text(row.location || 'N/A', 270, rowY, { width: 80, continued: false });
                    doc.text(`${row.quantity} ${row.unit || ''}`, 350, rowY, { width: 40, continued: false });
                    doc.text(row.expiry_date ? new Date(row.expiry_date).toLocaleDateString() : 'N/A', 390, rowY, { width: 80, continued: false });
                    doc.text(row.days_until_expiry !== null ? `${row.days_until_expiry} days` : 'N/A', 470, rowY, { width: 60, continued: false });
                    
                    doc.fillColor('#000000'); // Reset color
                    doc.moveDown(0.8);
                });

                // Footer
                doc.moveDown(2);
                doc.fontSize(8).fillColor('#666666');
                doc.text('BC Inventory Management System', 50, 750, { align: 'center' });

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate PDF for low stock items
     */
    static generateLowStockPDF(data) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Title
                doc.fontSize(20).font('Helvetica-Bold').text('Low Stock Items', { align: 'center' });
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
                doc.fontSize(10).text(`Total Items: ${data.length}`, { align: 'center' });
                doc.moveDown(2);

                if (data.length === 0) {
                    doc.fontSize(12).text('No low stock items found.', { align: 'center' });
                    doc.end();
                    return;
                }

                // Table header
                const tableTop = doc.y;
                const tableHeaders = [
                    { text: 'Product', x: 50, width: 140 },
                    { text: 'SKU', x: 190, width: 70 },
                    { text: 'Current', x: 260, width: 50 },
                    { text: 'Min Level', x: 310, width: 50 },
                    { text: 'Needed', x: 360, width: 50 },
                    { text: 'Supplier', x: 410, width: 120 }
                ];

                doc.fontSize(10).font('Helvetica-Bold');
                tableHeaders.forEach(header => {
                    doc.text(header.text, header.x, tableTop, { width: header.width, continued: false });
                });

                // Draw line under header
                doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
                doc.moveDown(1);

                // Table rows
                doc.font('Helvetica').fontSize(9);
                data.forEach((row, index) => {
                    if (doc.y > 720) {
                        doc.addPage();
                        doc.fontSize(10).font('Helvetica-Bold');
                        tableHeaders.forEach(header => {
                            doc.text(header.text, header.x, doc.y, { width: header.width, continued: false });
                        });
                        doc.moveTo(50, doc.y + 15).lineTo(550, doc.y + 15).stroke();
                        doc.moveDown(1);
                        doc.font('Helvetica').fontSize(9);
                    }

                    const rowY = doc.y;

                    doc.text(row.name || 'N/A', 50, rowY, { width: 140, continued: false });
                    doc.text(row.sku || 'N/A', 190, rowY, { width: 70, continued: false });
                    doc.text(`${row.current_quantity} ${row.unit || ''}`, 260, rowY, { width: 50, continued: false });
                    doc.text(`${row.min_stock_level}`, 310, rowY, { width: 50, continued: false });
                    
                    // Highlight needed quantity in red
                    doc.fillColor('#DC2626');
                    doc.text(`${row.quantity_needed}`, 360, rowY, { width: 50, continued: false });
                    doc.fillColor('#000000');
                    
                    doc.text(row.supplier || 'N/A', 410, rowY, { width: 120, continued: false });
                    
                    doc.moveDown(0.8);
                });

                // Footer
                doc.moveDown(2);
                doc.fontSize(8).fillColor('#666666');
                doc.text('BC Inventory Management System', 50, 750, { align: 'center' });

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = PDFExporter;
