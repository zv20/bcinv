// API base URL
const API_URL = '/api';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    showDashboard();
});

// View management
function hideAllViews() {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
}

function showDashboard() {
    hideAllViews();
    document.getElementById('dashboardView').style.display = 'block';
    document.querySelector('a[onclick*="showDashboard"]').classList.add('active');
    loadDashboard();
}

function showProducts() {
    hideAllViews();
    document.getElementById('productsView').style.display = 'block';
    document.querySelector('a[onclick*="showProducts"]').classList.add('active');
    loadProducts();
}

function showStock() {
    hideAllViews();
    document.getElementById('stockView').style.display = 'block';
    document.querySelector('a[onclick*="showStock"]').classList.add('active');
    loadStock();
}

function showExpiring() {
    hideAllViews();
    document.getElementById('expiringView').style.display = 'block';
    document.querySelector('a[onclick*="showExpiring"]').classList.add('active');
    loadExpiring();
}

function showLocations() {
    hideAllViews();
    document.getElementById('locationsView').style.display = 'block';
    document.querySelector('a[onclick*="showLocations"]').classList.add('active');
    loadLocations();
}

// Dashboard
async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/dashboard`);
        const stats = await response.json();
        
        document.getElementById('statsCards').innerHTML = `
            <div class="col-md-3">
                <div class="card stat-card">
                    <div class="card-body">
                        <h6 class="text-muted">Total Products</h6>
                        <div class="stat-value">${stats.total_products || 0}</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stat-card">
                    <div class="card-body">
                        <h6 class="text-muted">Total Stock</h6>
                        <div class="stat-value">${parseFloat(stats.total_stock || 0).toFixed(0)}</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stat-card border-warning">
                    <div class="card-body">
                        <h6 class="text-muted">Expiring Soon</h6>
                        <div class="stat-value text-warning">${stats.expiring_soon || 0}</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stat-card border-danger">
                    <div class="card-body">
                        <h6 class="text-muted">Expired</h6>
                        <div class="stat-value text-danger">${stats.expired || 0}</div>
                    </div>
                </div>
            </div>
        `;
        
        // Load expiring items for dashboard
        const expiringResp = await fetch(`${API_URL}/expiring`);
        const expiring = await expiringResp.json();
        
        if (expiring.length === 0) {
            document.getElementById('expiringList').innerHTML = '<p class="text-muted">No items expiring soon</p>';
        } else {
            document.getElementById('expiringList').innerHTML = `
                <ul class="list-unstyled">
                    ${expiring.slice(0, 5).map(item => `
                        <li class="mb-2">
                            <strong>${item.product_name}</strong><br>
                            <small class="text-muted">${item.location_name || 'No location'} • ${item.days_until_expiry} days left</small>
                        </li>
                    `).join('')}
                </ul>
            `;
        }
        
        // Load recent activity
        const auditResp = await fetch(`${API_URL}/audit?limit=5`);
        const audit = await auditResp.json();
        
        if (audit.length === 0) {
            document.getElementById('recentActivity').innerHTML = '<p class="text-muted">No recent activity</p>';
        } else {
            document.getElementById('recentActivity').innerHTML = `
                <ul class="list-unstyled">
                    ${audit.map(log => `
                        <li class="mb-2">
                            <strong>${log.action.replace(/_/g, ' ').toUpperCase()}</strong><br>
                            <small class="text-muted">${log.product_name} • ${new Date(log.created_at).toLocaleString()}</small>
                        </li>
                    `).join('')}
                </ul>
            `;
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

// Products
async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products?limit=100`);
        const data = await response.json();
        
        if (data.products.length === 0) {
            document.getElementById('productsTable').innerHTML = '<tr><td colspan="6" class="text-center">No products found</td></tr>';
            return;
        }
        
        document.getElementById('productsTable').innerHTML = data.products.map(p => `
            <tr>
                <td>${p.name}</td>
                <td>${p.sku || '-'}</td>
                <td>${p.category || '-'}</td>
                <td>${p.unit}</td>
                <td>$${parseFloat(p.cost_price || 0).toFixed(2)}</td>
                <td>
                    <button class="btn btn-sm btn-danger btn-icon" onclick="deleteProduct(${p.id}, '${p.name}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Products load error:', error);
    }
}

async function searchProducts() {
    const search = document.getElementById('productSearch').value;
    try {
        const response = await fetch(`${API_URL}/products?search=${encodeURIComponent(search)}&limit=100`);
        const data = await response.json();
        
        if (data.products.length === 0) {
            document.getElementById('productsTable').innerHTML = '<tr><td colspan="6" class="text-center">No products found</td></tr>';
            return;
        }
        
        document.getElementById('productsTable').innerHTML = data.products.map(p => `
            <tr>
                <td>${p.name}</td>
                <td>${p.sku || '-'}</td>
                <td>${p.category || '-'}</td>
                <td>${p.unit}</td>
                <td>$${parseFloat(p.cost_price || 0).toFixed(2)}</td>
                <td>
                    <button class="btn btn-sm btn-danger btn-icon" onclick="deleteProduct(${p.id}, '${p.name}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Search error:', error);
    }
}

function showAddProductModal() {
    document.getElementById('addProductForm').reset();
    new bootstrap.Modal(document.getElementById('addProductModal')).show();
}

async function addProduct() {
    const form = document.getElementById('addProductForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('addProductModal')).hide();
            loadProducts();
            alert('Product added successfully!');
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        console.error('Add product error:', error);
        alert('Failed to add product');
    }
}

async function deleteProduct(id, name) {
    if (!confirm(`Delete product "${name}"?`)) return;
    
    try {
        const response = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadProducts();
            alert('Product deleted');
        }
    } catch (error) {
        console.error('Delete error:', error);
    }
}

// Stock
async function loadStock() {
    try {
        const response = await fetch(`${API_URL}/stock`);
        const stock = await response.json();
        
        if (stock.length === 0) {
            document.getElementById('stockTable').innerHTML = '<tr><td colspan="7" class="text-center">No stock found</td></tr>';
            return;
        }
        
        document.getElementById('stockTable').innerHTML = stock.map(s => {
            const daysLeft = s.expiry_date ? Math.ceil((new Date(s.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            const expiryClass = daysLeft !== null && daysLeft <= 7 ? 'text-danger' : daysLeft !== null && daysLeft <= 14 ? 'text-warning' : '';
            
            return `
                <tr>
                    <td>${s.product_name}</td>
                    <td>${s.sku || '-'}</td>
                    <td>${s.location_name || '-'}</td>
                    <td>${parseFloat(s.quantity).toFixed(2)} ${s.unit}</td>
                    <td class="${expiryClass}">${s.expiry_date ? new Date(s.expiry_date).toLocaleDateString() : '-'}</td>
                    <td class="${expiryClass}">${daysLeft !== null ? daysLeft + ' days' : '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-warning btn-icon" onclick="adjustStock(${s.id}, '${s.product_name}', ${s.quantity})" title="Adjust">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger btn-icon" onclick="discardStock(${s.id}, '${s.product_name}', ${s.quantity})" title="Discard">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Stock load error:', error);
    }
}

function showAddStockModal() {
    // Load products and locations for dropdowns
    Promise.all([
        fetch(`${API_URL}/products?limit=1000`).then(r => r.json()),
        fetch(`${API_URL}/locations`).then(r => r.json())
    ]).then(([productsData, locations]) => {
        document.getElementById('stockProductSelect').innerHTML = 
            '<option value="">Select product...</option>' +
            productsData.products.map(p => `<option value="${p.id}">${p.name} (${p.sku || 'No SKU'})</option>`).join('');
        
        document.getElementById('stockLocationSelect').innerHTML = 
            '<option value="">No location</option>' +
            locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
        
        document.getElementById('addStockForm').reset();
        new bootstrap.Modal(document.getElementById('addStockModal')).show();
    });
}

async function addStock() {
    const form = document.getElementById('addStockForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Remove empty values
    Object.keys(data).forEach(key => !data[key] && delete data[key]);
    
    try {
        const response = await fetch(`${API_URL}/stock/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('addStockModal')).hide();
            loadStock();
            alert('Stock added successfully!');
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        console.error('Add stock error:', error);
        alert('Failed to add stock');
    }
}

async function adjustStock(batchId, productName, currentQty) {
    const newQty = prompt(`Adjust stock for "${productName}"\n\nCurrent quantity: ${currentQty}\nEnter new quantity:`, currentQty);
    if (newQty === null) return;
    
    const notes = prompt('Reason for adjustment (optional):');
    
    try {
        const response = await fetch(`${API_URL}/stock/adjust`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                batch_id: batchId,
                quantity: parseFloat(newQty),
                reason: 'manual_audit',
                notes: notes
            })
        });
        
        if (response.ok) {
            loadStock();
            alert('Stock adjusted');
        }
    } catch (error) {
        console.error('Adjust error:', error);
    }
}

async function discardStock(batchId, productName, quantity) {
    const reason = prompt(`Discard stock for "${productName}" (${quantity} units)\n\nReason:\n1. Expired\n2. Damaged\n3. Other\n\nEnter 1, 2, or 3:`);
    if (!reason) return;
    
    const reasonMap = {'1': 'expired', '2': 'damaged', '3': 'other'};
    const qtyToDiscard = prompt('Quantity to discard:', quantity);
    if (!qtyToDiscard) return;
    
    try {
        const response = await fetch(`${API_URL}/stock/discard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                batch_id: batchId,
                quantity: parseFloat(qtyToDiscard),
                reason: reasonMap[reason] || 'other',
                notes: ''
            })
        });
        
        if (response.ok) {
            loadStock();
            alert('Stock discarded');
        }
    } catch (error) {
        console.error('Discard error:', error);
    }
}

// Expiring
async function loadExpiring() {
    try {
        const response = await fetch(`${API_URL}/expiring`);
        const expiring = await response.json();
        
        if (expiring.length === 0) {
            document.getElementById('expiringTable').innerHTML = '<tr><td colspan="7" class="text-center text-success">No items expiring soon! 🎉</td></tr>';
            return;
        }
        
        document.getElementById('expiringTable').innerHTML = expiring.map(item => {
            const daysClass = item.days_until_expiry <= 3 ? 'text-danger' : 'text-warning';
            return `
                <tr>
                    <td>${item.product_name}</td>
                    <td>${item.sku || '-'}</td>
                    <td>${item.location_name || '-'}</td>
                    <td>${parseFloat(item.quantity).toFixed(2)}</td>
                    <td class="${daysClass}">${new Date(item.expiry_date).toLocaleDateString()}</td>
                    <td class="${daysClass}"><strong>${Math.floor(item.days_until_expiry)} days</strong></td>
                    <td>
                        <button class="btn btn-sm btn-danger btn-icon" onclick="discardStock(${item.batch_id}, '${item.product_name}', ${item.quantity})">
                            <i class="bi bi-trash"></i> Discard
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Expiring load error:', error);
    }
}

// Locations
async function loadLocations() {
    try {
        const response = await fetch(`${API_URL}/locations`);
        const locations = await response.json();
        
        if (locations.length === 0) {
            document.getElementById('locationsTable').innerHTML = '<tr><td colspan="4" class="text-center">No locations found</td></tr>';
            return;
        }
        
        document.getElementById('locationsTable').innerHTML = locations.map(l => `
            <tr>
                <td><strong>${l.name}</strong></td>
                <td>${l.section || '-'}</td>
                <td>${l.description || '-'}</td>
                <td>${new Date(l.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Locations load error:', error);
    }
}

function showAddLocationModal() {
    document.getElementById('addLocationForm').reset();
    new bootstrap.Modal(document.getElementById('addLocationModal')).show();
}

async function addLocation() {
    const form = document.getElementById('addLocationForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await fetch(`${API_URL}/locations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('addLocationModal')).hide();
            loadLocations();
            alert('Location added successfully!');
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        console.error('Add location error:', error);
        alert('Failed to add location');
    }
}
