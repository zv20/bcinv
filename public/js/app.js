const API_URL = '/api';

// Global stock data for filtering
let allStockData = [];
// Store current product being viewed in details
let currentProduct = null;

document.addEventListener('DOMContentLoaded', () => { showDashboard(); });

function hideAllViews() {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-link, .dropdown-item').forEach(l => l.classList.remove('active'));
}

// Helper to clear performance cache before refreshing data
function clearCache() {
    if (window.performanceOptimizer) {
        window.performanceOptimizer.clearCache();
    }
}

function showDashboard() { hideAllViews(); document.getElementById('dashboardView').style.display = 'block'; document.querySelector('a[onclick*="showDashboard"]').classList.add('active'); loadDashboard(); }
function showProducts() { hideAllViews(); document.getElementById('productsView').style.display = 'block'; document.querySelector('a[onclick*="showProducts"]').classList.add('active'); loadProducts(); }
function showStock() { hideAllViews(); document.getElementById('stockView').style.display = 'block'; document.querySelector('a[onclick*="showStock"]').classList.add('active'); loadStock(); }
function showExpiring() { hideAllViews(); document.getElementById('expiringView').style.display = 'block'; document.querySelector('a[onclick*="showExpiring"]').classList.add('active'); loadExpiring(); }
function showDepartments() { hideAllViews(); document.getElementById('departmentsView').style.display = 'block'; loadDepartments(); }
function showSuppliers() { hideAllViews(); document.getElementById('suppliersView').style.display = 'block'; loadSuppliers(); }
function showLocations() { hideAllViews(); document.getElementById('locationsView').style.display = 'block'; loadLocations(); }

// Filter stock by product name (called from barcode scanner)
function filterStockByProduct(productName) {
    if (!allStockData || allStockData.length === 0) {
        console.log('No stock data available for filtering');
        return;
    }
    
    const filtered = allStockData.filter(s => 
        s.product_name.toLowerCase().includes(productName.toLowerCase())
    );
    
    console.log(`Filtered ${filtered.length} items matching "${productName}"`);
    renderStockTable(filtered);
}

// Render stock table (extracted from loadStock)
function renderStockTable(stock) {
    const stockTable = document.getElementById('stockTable');
    if (!stockTable) {
        console.warn('Stock table element not found - Stock view may have been removed');
        return;
    }
    
    stockTable.innerHTML = stock.length === 0 ? '<tr><td colspan="7" class="text-center">No stock</td></tr>' :
        stock.map(s => {
            const daysLeft = s.expiry_date ? Math.ceil((new Date(s.expiry_date) - new Date()) / 86400000) : null;
            const cls = daysLeft !== null && daysLeft <= 7 ? 'text-danger' : daysLeft !== null && daysLeft <= 14 ? 'text-warning' : '';
            return `<tr><td>${s.product_name}</td><td>${s.sku || '-'}</td><td>${s.location_name || '-'}</td><td>${parseFloat(s.quantity).toFixed(2)} ${s.unit}</td><td class="${cls}">${s.expiry_date ? new Date(s.expiry_date).toLocaleDateString() : '-'}</td><td class="${cls}">${daysLeft !== null ? daysLeft + ' days' : '-'}</td><td><button class="btn btn-sm btn-warning btn-icon" onclick="adjustStock(${s.id}, '${s.product_name.replace(/'/g, "\\'")}', ${s.quantity})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-danger btn-icon" onclick="discardStock(${s.id}, '${s.product_name.replace(/'/g, "\\'")}', ${s.quantity})"><i class="bi bi-trash"></i></button></td></tr>`;
        }).join('');
}

// Show product details with batches
async function showProductDetails(productId) {
    try {
        console.log('Loading product details for ID:', productId);
        
        // Fetch all products and find the one we need
        const allProductsResp = await fetch(`${API_URL}/products?limit=1000`);
        const allData = await allProductsResp.json();
        
        // Handle different response formats
        let products = [];
        if (Array.isArray(allData)) {
            products = allData;
        } else if (allData.products && Array.isArray(allData.products)) {
            products = allData.products;
        } else if (allData.data && Array.isArray(allData.data)) {
            products = allData.data;
        }
        
        currentProduct = products.find(p => p.id == productId);
        
        console.log('Found product:', currentProduct);
        
        if (!currentProduct) {
            alert('Product not found');
            console.error('Product not found with ID:', productId);
            return;
        }
        
        // Fill product details
        document.getElementById('detailProductName').textContent = currentProduct.name || 'N/A';
        document.getElementById('detailProductSku').textContent = currentProduct.sku || 'N/A';
        document.getElementById('detailProductDepartment').textContent = currentProduct.department_name || 'N/A';
        document.getElementById('detailProductSupplier').textContent = currentProduct.supplier_name || 'N/A';
        document.getElementById('detailProductUnit').textContent = currentProduct.unit || 'N/A';
        document.getElementById('detailProductPrice').textContent = currentProduct.cost_price ? '$' + parseFloat(currentProduct.cost_price).toFixed(2) : 'N/A';
        
        // Load batches for this product
        await loadProductBatches(productId);
        
        // Show modal
        new bootstrap.Modal(document.getElementById('productDetailsModal')).show();
    } catch (error) {
        console.error('Error loading product details:', error);
        alert('Failed to load product details: ' + error.message);
    }
}

// Load batches for current product
async function loadProductBatches(productId) {
    try {
        console.log('Loading batches for product ID:', productId);
        
        // Make sure we have current product info
        if (!currentProduct) {
            console.error('currentProduct is not set');
            document.getElementById('batchesTable').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error: Product information not available</td></tr>';
            return;
        }
        
        // Use the correct endpoint that filters by product ID
        const response = await fetch(`${API_URL}/products/${productId}/batches`);
        const batchesData = await response.json();
        
        console.log('Batches data response:', batchesData);
        
        // Handle different response formats
        let batches = [];
        if (Array.isArray(batchesData)) {
            batches = batchesData;
        } else if (batchesData.batches && Array.isArray(batchesData.batches)) {
            batches = batchesData.batches;
        } else if (batchesData.data && Array.isArray(batchesData.data)) {
            batches = batchesData.data;
        }
        
        console.log('Parsed batches:', batches);
        
        // Add product name to each batch for safer rendering
        batches = batches.map(b => ({ ...b, _productName: currentProduct.name }));
        
        renderBatchesTable(batches, currentProduct.name);
    } catch (error) {
        console.error('Error loading batches:', error);
        document.getElementById('batchesTable').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load batches</td></tr>';
    }
}

// Render batches table with product name parameter for safety
function renderBatchesTable(batches, productName) {
    if (batches.length === 0) {
        document.getElementById('batchesTable').innerHTML = '<tr><td colspan="6" class="text-center text-muted">No stock batches for this product. Click "Add Batch" to add stock.</td></tr>';
        return;
    }
    
    // Use passed productName or fall back to currentProduct or batch data
    const safeName = productName || (currentProduct ? currentProduct.name : (batches[0]._productName || 'Product'));
    const escapedName = safeName.replace(/'/g, "\\'");
    
    console.log('Rendering batches with product name:', safeName);
    
    document.getElementById('batchesTable').innerHTML = batches.map(batch => {
        const daysLeft = batch.expiry_date ? Math.ceil((new Date(batch.expiry_date) - new Date()) / 86400000) : null;
        const expiryClass = daysLeft !== null && daysLeft <= 7 ? 'text-danger' : daysLeft !== null && daysLeft <= 14 ? 'text-warning' : '';
        
        return `<tr>
            <td>${batch.location_name || 'No location'}</td>
            <td>${parseFloat(batch.quantity).toFixed(2)}</td>
            <td class="${expiryClass}">${batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : 'N/A'}</td>
            <td class="${expiryClass}">${daysLeft !== null ? daysLeft + ' days' : 'N/A'}</td>
            <td><small>${batch.notes || '-'}</small></td>
            <td>
                <button class="btn btn-sm btn-warning btn-icon" onclick="adjustStock(${batch.id}, '${escapedName}', ${batch.quantity})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger btn-icon" onclick="discardStock(${batch.id}, '${escapedName}', ${batch.quantity})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// Open add batch modal for current product
async function showAddBatchModal() {
    if (!currentProduct) {
        alert('No product selected');
        return;
    }
    
    // Load locations
    const locations = await fetch(`${API_URL}/locations`).then(r => r.json());
    
    // Pre-fill product selection
    document.getElementById('stockProductSelect').innerHTML = `<option value="${currentProduct.id}" selected>${currentProduct.name} (${currentProduct.sku || 'No Barcode'})</option>`;
    document.getElementById('stockLocationSelect').innerHTML = '<option value="">No location</option>' + locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    document.getElementById('addStockForm').reset();
    document.getElementById('stockProductSelect').value = currentProduct.id;
    
    // Hide product details modal temporarily
    bootstrap.Modal.getInstance(document.getElementById('productDetailsModal')).hide();
    
    // Show add stock modal
    const addStockModal = new bootstrap.Modal(document.getElementById('addStockModal'));
    addStockModal.show();
    
    // When add stock modal closes, reopen product details
    document.getElementById('addStockModal').addEventListener('hidden.bs.modal', function handler() {
        if (currentProduct) {
            setTimeout(() => {
                new bootstrap.Modal(document.getElementById('productDetailsModal')).show();
                loadProductBatches(currentProduct.id);
            }, 300);
        }
        document.getElementById('addStockModal').removeEventListener('hidden.bs.modal', handler);
    }, { once: true });
}

// Edit product info from details view
function editProductFromDetails() {
    if (!currentProduct) {
        alert('No product selected');
        return;
    }
    
    // Hide product details modal
    bootstrap.Modal.getInstance(document.getElementById('productDetailsModal')).hide();
    
    // Small delay then open edit modal
    setTimeout(() => {
        editProduct(currentProduct);
    }, 300);
}

async function loadDashboard() {
    try {
        const [statsResp, expiringResp, auditResp] = await Promise.all([
            fetch(`${API_URL}/dashboard`), fetch(`${API_URL}/expiring`), fetch(`${API_URL}/audit?limit=5`)
        ]);
        const [stats, expiring, audit] = await Promise.all([statsResp.json(), expiringResp.json(), auditResp.json()]);
        
        document.getElementById('statsCards').innerHTML = `
            <div class="col-md-3"><div class="card stat-card"><div class="card-body"><h6 class="text-muted">Total Products</h6><div class="stat-value">${stats.total_products || 0}</div></div></div></div>
            <div class="col-md-3"><div class="card stat-card"><div class="card-body"><h6 class="text-muted">Total Stock</h6><div class="stat-value">${parseFloat(stats.total_stock || 0).toFixed(0)}</div></div></div></div>
            <div class="col-md-3"><div class="card stat-card border-warning"><div class="card-body"><h6 class="text-muted">Expiring Soon</h6><div class="stat-value text-warning">${stats.expiring_soon || 0}</div></div></div></div>
            <div class="col-md-3"><div class="card stat-card border-danger"><div class="card-body"><h6 class="text-muted">Expired</h6><div class="stat-value text-danger">${stats.expired || 0}</div></div></div></div>
        `;
        
        document.getElementById('expiringList').innerHTML = expiring.length === 0 ? '<p class="text-muted">No items expiring soon</p>' :
            '<ul class="list-unstyled">' + expiring.slice(0, 5).map(item => `<li class="mb-2"><strong>${item.product_name}</strong><br><small class="text-muted">${item.location_name || 'No location'} • ${item.days_until_expiry} days left</small></li>`).join('') + '</ul>';
        
        document.getElementById('recentActivity').innerHTML = audit.length === 0 ? '<p class="text-muted">No recent activity</p>' :
            '<ul class="list-unstyled">' + audit.map(log => `<li class="mb-2"><strong>${log.action.replace(/_/g, ' ').toUpperCase()}</strong><br><small class="text-muted">${log.product_name} • ${new Date(log.created_at).toLocaleString()}</small></li>`).join('') + '</ul>';
    } catch (error) { console.error('Dashboard error:', error); }
}

async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products?limit=100`);
        const data = await response.json();
        
        // Render desktop table
        document.getElementById('productsTable').innerHTML = data.products.length === 0 ? '<tr><td colspan="7" class="text-center">No products found</td></tr>' :
            data.products.map(p => `<tr><td>${p.name}</td><td>${p.sku || '-'}</td><td>${p.department_name || '-'}</td><td>${p.supplier_name || '-'}</td><td>${p.unit || '-'}</td><td>$${parseFloat(p.cost_price || 0).toFixed(2)}</td><td><button class="btn btn-sm btn-info btn-icon" onclick="showProductDetails(${p.id})" title="View Details"><i class="bi bi-eye"></i></button> <button class="btn btn-sm btn-primary btn-icon" onclick='editProduct(${JSON.stringify(p).replace(/'/g, "&apos;")})'><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-danger btn-icon" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')" ><i class="bi bi-trash"></i></button></td></tr>`).join('');
        
        // Render mobile cards
        renderMobileProductCards(data.products);
    } catch (error) { console.error('Products error:', error); }
}

// Render mobile product cards
function renderMobileProductCards(products) {
    const container = document.getElementById('mobileProductCards');
    if (!container) return;
    
    if (products.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">No products found</div>';
        return;
    }
    
    container.innerHTML = products.map(p => {
        // Calculate expiry info
        let expiryInfo = '';
        let expiryBadge = '';
        
        if (p.next_expiry_date) {
            const daysLeft = Math.ceil((new Date(p.next_expiry_date) - new Date()) / 86400000);
            const expiryDate = new Date(p.next_expiry_date).toLocaleDateString();
            
            if (daysLeft <= 7) {
                expiryBadge = '<span class="product-card-badge badge-danger">⚠️ Expiring Soon</span>';
                expiryInfo = `<div class="product-card-expiry text-danger">Expires: ${expiryDate} (${daysLeft} days)</div>`;
            } else if (daysLeft <= 14) {
                expiryInfo = `<div class="product-card-expiry text-warning">Expires: ${expiryDate} (${daysLeft} days)</div>`;
            } else {
                expiryInfo = `<div class="product-card-expiry">Expires: ${expiryDate}</div>`;
            }
        }
        
        return `
            <div class="product-card" onclick="showProductDetails(${p.id})" role="button" tabindex="0">
                ${expiryBadge}
                <button class="product-card-edit" onclick="event.stopPropagation(); editProduct(${JSON.stringify(p).replace(/'/g, '&apos;')})" aria-label="Edit product">
                    <i class="bi bi-pencil"></i>
                </button>
                <div class="product-card-header">
                    <h3 class="product-card-name">${p.name}</h3>
                </div>
                <div class="product-card-meta">
                    ${p.department_name ? `<span>${p.department_name}</span>` : ''}
                    ${p.department_name && p.supplier_name ? '<span>•</span>' : ''}
                    ${p.supplier_name ? `<span>${p.supplier_name}</span>` : ''}
                </div>
                <div class="product-card-details">
                    <div class="product-card-detail-row">
                        <span class="product-card-label">SKU:</span>
                        <span class="product-card-value">${p.sku || 'N/A'}</span>
                    </div>
                    <div class="product-card-detail-row">
                        <span class="product-card-label">Stock:</span>
                        <span class="product-card-value">📦 ${p.total_quantity || 0} cases</span>
                    </div>
                </div>
                ${expiryInfo}
            </div>
        `;
    }).join('');
}

async function searchProducts() {
    const search = document.getElementById('productSearch').value;
    try {
        const response = await fetch(`${API_URL}/products?search=${encodeURIComponent(search)}&limit=100`);
        const data = await response.json();
        
        // Render desktop table
        document.getElementById('productsTable').innerHTML = data.products.length === 0 ? '<tr><td colspan="7" class="text-center">No products found</td></tr>' :
            data.products.map(p => `<tr><td>${p.name}</td><td>${p.sku || '-'}</td><td>${p.department_name || '-'}</td><td>${p.supplier_name || '-'}</td><td>${p.unit || '-'}</td><td>$${parseFloat(p.cost_price || 0).toFixed(2)}</td><td><button class="btn btn-sm btn-info btn-icon" onclick="showProductDetails(${p.id})" title="View Details"><i class="bi bi-eye"></i></button> <button class="btn btn-sm btn-primary btn-icon" onclick='editProduct(${JSON.stringify(p).replace(/'/g, "&apos;")})'><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-danger btn-icon" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')" ><i class="bi bi-trash"></i></button></td></tr>`).join('');
        
        // Render mobile cards
        renderMobileProductCards(data.products);
    } catch (error) { console.error('Search error:', error); }
}

async function showAddProductModal() {
    const [depts, suppliers] = await Promise.all([fetch(`${API_URL}/departments`).then(r => r.json()), fetch(`${API_URL}/suppliers`).then(r => r.json())]);
    document.getElementById('addProductDepartment').innerHTML = '<option value="">Select department...</option>' + depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    document.getElementById('addProductSupplier').innerHTML = '<option value="">Select supplier...</option>' + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    document.getElementById('addProductForm').reset();
    new bootstrap.Modal(document.getElementById('addProductModal')).show();
}

async function addProduct() {
    const form = document.getElementById('addProductForm');
    const data = Object.fromEntries(new FormData(form));
    try {
        const response = await fetch(`${API_URL}/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (response.ok) { 
            bootstrap.Modal.getInstance(document.getElementById('addProductModal')).hide();
            clearCache();
            await loadProducts();
            alert('Product added!');
        }
        else { alert('Error: ' + (await response.json()).error); }
    } catch (error) { alert('Failed to add product'); }
}

async function editProduct(product) {
    const [depts, suppliers] = await Promise.all([fetch(`${API_URL}/departments`).then(r => r.json()), fetch(`${API_URL}/suppliers`).then(r => r.json())]);
    document.getElementById('editProductDepartment').innerHTML = '<option value="">Select department...</option>' + depts.map(d => `<option value="${d.id}" ${d.id == product.department_id ? 'selected' : ''}>${d.name}</option>`).join('');
    document.getElementById('editProductSupplier').innerHTML = '<option value="">Select supplier...</option>' + suppliers.map(s => `<option value="${s.id}" ${s.id == product.supplier_id ? 'selected' : ''}>${s.name}</option>`).join('');
    document.getElementById('editProductId').value = product.id;
    document.getElementById('editProductName').value = product.name;
    document.getElementById('editProductSku').value = product.sku || '';
    
    // Parse unit value - convert text to empty or extract number
    let unitValue = '';
    if (product.unit) {
        const parsed = parseFloat(product.unit);
        if (!isNaN(parsed)) {
            unitValue = parsed;
        }
    }
    document.getElementById('editProductUnit').value = unitValue;
    
    document.getElementById('editProductPrice').value = product.cost_price || '';
    new bootstrap.Modal(document.getElementById('editProductModal')).show();
}

async function updateProduct() {
    const form = document.getElementById('editProductForm');
    const data = Object.fromEntries(new FormData(form));
    const id = data.id; delete data.id;
    try {
        const response = await fetch(`${API_URL}/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (response.ok) { 
            bootstrap.Modal.getInstance(document.getElementById('editProductModal')).hide();
            clearCache();
            await loadProducts();
            // If we were in product details, reload it
            if (currentProduct && currentProduct.id == id) {
                setTimeout(() => showProductDetails(id), 300);
            }
            alert('Product updated!');
        }
        else { alert('Error: ' + (await response.json()).error); }
    } catch (error) { alert('Failed to update product'); }
}

async function deleteProduct(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
        await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
        clearCache();
        await loadProducts();
        alert('Deleted');
    } catch (error) { console.error('Delete error:', error); }
}

async function loadStock() {
    try {
        const stock = await fetch(`${API_URL}/stock`).then(r => r.json());
        allStockData = stock; // Store for filtering
        renderStockTable(stock);
    } catch (error) { console.error('Stock error:', error); }
}

async function showAddStockModal() {
    const [productsData, locations] = await Promise.all([fetch(`${API_URL}/products?limit=1000`).then(r => r.json()), fetch(`${API_URL}/locations`).then(r => r.json())]);
    document.getElementById('stockProductSelect').innerHTML = '<option value="">Select product...</option>' + productsData.products.map(p => `<option value="${p.id}">${p.name} (${p.sku || 'No Barcode'})</option>`).join('');
    document.getElementById('stockLocationSelect').innerHTML = '<option value="">No location</option>' + locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    document.getElementById('addStockForm').reset();
    new bootstrap.Modal(document.getElementById('addStockModal')).show();
}

async function addStock() {
    const data = Object.fromEntries(new FormData(document.getElementById('addStockForm')));
    Object.keys(data).forEach(k => !data[k] && delete data[k]);
    try {
        const response = await fetch(`${API_URL}/stock/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (response.ok) { 
            bootstrap.Modal.getInstance(document.getElementById('addStockModal')).hide();
            clearCache();
            // Only reload stock view if it exists
            const stockTable = document.getElementById('stockTable');
            if (stockTable) {
                await loadStock();
            }
            // If we were viewing product details, reload batches
            if (currentProduct && data.product_id == currentProduct.id) {
                await loadProductBatches(currentProduct.id);
            }
            alert('Stock added!');
        }
        else { alert('Error: ' + (await response.json()).error); }
    } catch (error) { alert('Failed to add stock'); }
}

async function adjustStock(batchId, productName, currentQty) {
    const newQty = prompt(`Adjust "${productName}"\nCurrent: ${currentQty}\nNew quantity:`, currentQty);
    if (newQty === null) return;
    const notes = prompt('Reason (optional):');
    try {
        const response = await fetch(`${API_URL}/stock/adjust`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch_id: batchId, quantity: parseFloat(newQty), reason: 'manual_audit', notes }) });
        
        if (!response.ok) {
            const error = await response.json();
            alert('Error adjusting stock: ' + (error.error || 'Unknown error'));
            return;
        }
        
        clearCache();
        
        // Only reload stock view if it exists
        const stockTable = document.getElementById('stockTable');
        if (stockTable) {
            await loadStock();
        }
        
        // If we were viewing product details, reload batches
        if (currentProduct) {
            await loadProductBatches(currentProduct.id);
        }
        
        alert('Adjusted');
    } catch (error) { 
        console.error('Adjust error:', error);
        alert('Failed to adjust stock: ' + error.message);
    }
}

async function discardStock(batchId, productName, quantity) {
    const reason = prompt(`Discard "${productName}" (${quantity})\n1. Expired\n2. Damaged\n3. Other\n\nEnter 1-3:`);
    if (!reason) return;
    const qtyToDiscard = prompt('Quantity:', quantity);
    if (!qtyToDiscard) return;
    try {
        const response = await fetch(`${API_URL}/stock/discard`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch_id: batchId, quantity: parseFloat(qtyToDiscard), reason: {'1': 'expired', '2': 'damaged', '3': 'other'}[reason] || 'other', notes: '' }) });
        
        if (!response.ok) {
            const error = await response.json();
            alert('Error discarding stock: ' + (error.error || 'Unknown error'));
            return;
        }
        
        clearCache();
        
        // Only reload stock view if it exists
        const stockTable = document.getElementById('stockTable');
        if (stockTable) {
            await loadStock();
        }
        
        // If we were viewing product details, reload batches
        if (currentProduct) {
            await loadProductBatches(currentProduct.id);
        }
        
        alert('Discarded');
    } catch (error) { 
        console.error('Discard error:', error);
        alert('Failed to discard stock: ' + error.message);
    }
}

async function loadExpiring() {
    try {
        const expiring = await fetch(`${API_URL}/expiring`).then(r => r.json());
        document.getElementById('expiringTable').innerHTML = expiring.length === 0 ? '<tr><td colspan="7" class="text-center text-success">No items expiring soon! 🎉</td></tr>' :
            expiring.map(item => {
                const cls = item.days_until_expiry <= 3 ? 'text-danger' : 'text-warning';
                return `<tr><td>${item.product_name}</td><td>${item.sku || '-'}</td><td>${item.location_name || '-'}</td><td>${parseFloat(item.quantity).toFixed(2)}</td><td class="${cls}">${new Date(item.expiry_date).toLocaleDateString()}</td><td class="${cls}"><strong>${Math.floor(item.days_until_expiry)} days</strong></td><td><button class="btn btn-sm btn-danger btn-icon" onclick="discardStock(${item.batch_id}, '${item.product_name.replace(/'/g, "\\'")}', ${item.quantity})"><i class="bi bi-trash"></i> Discard</button></td></tr>`;
            }).join('');
    } catch (error) { console.error('Expiring error:', error); }
}

async function loadDepartments() {
    try {
        const depts = await fetch(`${API_URL}/departments`).then(r => r.json());
        document.getElementById('departmentsTable').innerHTML = depts.length === 0 ? '<tr><td colspan="4" class="text-center">No departments</td></tr>' :
            depts.map(d => `<tr><td><strong>${d.name}</strong></td><td>${d.description || '-'}</td><td>${new Date(d.created_at).toLocaleDateString()}</td><td><button class="btn btn-sm btn-primary btn-icon" onclick='editDepartment(${JSON.stringify(d).replace(/'/g, "&apos;")})'><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-danger btn-icon" onclick="deleteDepartment(${d.id}, '${d.name.replace(/'/g, "\\'")}')" ><i class="bi bi-trash"></i></button></td></tr>`).join('');
    } catch (error) { console.error('Departments error:', error); }
}

function showAddDepartmentModal() { document.getElementById('addDepartmentForm').reset(); new bootstrap.Modal(document.getElementById('addDepartmentModal')).show(); }

async function addDepartment() {
    const data = Object.fromEntries(new FormData(document.getElementById('addDepartmentForm')));
    try {
        const response = await fetch(`${API_URL}/departments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (response.ok) { 
            bootstrap.Modal.getInstance(document.getElementById('addDepartmentModal')).hide();
            clearCache();
            await loadDepartments();
            alert('Department added!');
        }
        else { alert('Error: ' + (await response.json()).error); }
    } catch (error) { alert('Failed to add department'); }
}

function editDepartment(dept) {
    document.getElementById('editDepartmentId').value = dept.id;
    document.getElementById('editDepartmentName').value = dept.name;
    document.getElementById('editDepartmentDescription').value = dept.description || '';
    new bootstrap.Modal(document.getElementById('editDepartmentModal')).show();
}

async function updateDepartment() {
    const id = document.getElementById('editDepartmentId').value;
    const data = { name: document.getElementById('editDepartmentName').value, description: document.getElementById('editDepartmentDescription').value };
    try {
        await fetch(`${API_URL}/departments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        bootstrap.Modal.getInstance(document.getElementById('editDepartmentModal')).hide();
        clearCache();
        await loadDepartments();
        alert('Updated!');
    } catch (error) { alert('Failed to update'); }
}

async function deleteDepartment(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try { 
        await fetch(`${API_URL}/departments/${id}`, { method: 'DELETE' });
        clearCache();
        await loadDepartments();
        alert('Deleted'); 
    }
    catch (error) { console.error('Delete error:', error); }
}

async function loadSuppliers() {
    try {
        const suppliers = await fetch(`${API_URL}/suppliers`).then(r => r.json());
        document.getElementById('suppliersTable').innerHTML = suppliers.length === 0 ? '<tr><td colspan="5" class="text-center">No suppliers</td></tr>' :
            suppliers.map(s => `<tr><td><strong>${s.name}</strong></td><td>${s.contact_name || '-'}</td><td>${s.phone || '-'}</td><td>${s.email || '-'}</td><td><button class="btn btn-sm btn-primary btn-icon" onclick='editSupplier(${JSON.stringify(s).replace(/'/g, "&apos;")})'><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-danger btn-icon" onclick="deleteSupplier(${s.id}, '${s.name.replace(/'/g, "\\'")}')" ><i class="bi bi-trash"></i></button></td></tr>`).join('');
    } catch (error) { console.error('Suppliers error:', error); }
}

function showAddSupplierModal() { document.getElementById('addSupplierForm').reset(); new bootstrap.Modal(document.getElementById('addSupplierModal')).show(); }

async function addSupplier() {
    const data = Object.fromEntries(new FormData(document.getElementById('addSupplierForm')));
    try {
        const response = await fetch(`${API_URL}/suppliers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (response.ok) { 
            bootstrap.Modal.getInstance(document.getElementById('addSupplierModal')).hide();
            clearCache();
            await loadSuppliers();
            alert('Supplier added!');
        }
        else { alert('Error: ' + (await response.json()).error); }
    } catch (error) { alert('Failed to add supplier'); }
}

function editSupplier(s) {
    document.getElementById('editSupplierId').value = s.id;
    document.getElementById('editSupplierName').value = s.name;
    document.getElementById('editSupplierContact').value = s.contact_name || '';
    document.getElementById('editSupplierPhone').value = s.phone || '';
    document.getElementById('editSupplierEmail').value = s.email || '';
    document.getElementById('editSupplierAddress').value = s.address || '';
    document.getElementById('editSupplierNotes').value = s.notes || '';
    new bootstrap.Modal(document.getElementById('editSupplierModal')).show();
}

async function updateSupplier() {
    const id = document.getElementById('editSupplierId').value;
    const data = { name: document.getElementById('editSupplierName').value, contact_name: document.getElementById('editSupplierContact').value, phone: document.getElementById('editSupplierPhone').value, email: document.getElementById('editSupplierEmail').value, address: document.getElementById('editSupplierAddress').value, notes: document.getElementById('editSupplierNotes').value };
    try {
        await fetch(`${API_URL}/suppliers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        bootstrap.Modal.getInstance(document.getElementById('editSupplierModal')).hide();
        clearCache();
        await loadSuppliers();
        alert('Updated!');
    } catch (error) { alert('Failed to update'); }
}

async function deleteSupplier(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try { 
        await fetch(`${API_URL}/suppliers/${id}`, { method: 'DELETE' });
        clearCache();
        await loadSuppliers();
        alert('Deleted'); 
    }
    catch (error) { console.error('Delete error:', error); }
}

async function loadLocations() {
    try {
        const locs = await fetch(`${API_URL}/locations`).then(r => r.json());
        document.getElementById('locationsTable').innerHTML = locs.length === 0 ? '<tr><td colspan="5" class="text-center">No locations</td></tr>' :
            locs.map(l => `<tr><td><strong>${l.name}</strong></td><td>${l.section || '-'}</td><td>${l.description || '-'}</td><td>${new Date(l.created_at).toLocaleDateString()}</td><td><button class="btn btn-sm btn-primary btn-icon" onclick='editLocation(${JSON.stringify(l).replace(/'/g, "&apos;")})'><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-danger btn-icon" onclick="deleteLocation(${l.id}, '${l.name.replace(/'/g, "\\'")}')" ><i class="bi bi-trash"></i></button></td></tr>`).join('');
    } catch (error) { console.error('Locations error:', error); }
}

function showAddLocationModal() { document.getElementById('addLocationForm').reset(); new bootstrap.Modal(document.getElementById('addLocationModal')).show(); }

async function addLocation() {
    const data = Object.fromEntries(new FormData(document.getElementById('addLocationForm')));
    try {
        const response = await fetch(`${API_URL}/locations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (response.ok) { 
            bootstrap.Modal.getInstance(document.getElementById('addLocationModal')).hide();
            clearCache();
            await loadLocations();
            alert('Location added!');
        }
        else { alert('Error: ' + (await response.json()).error); }
    } catch (error) { alert('Failed to add location'); }
}

function editLocation(loc) {
    document.getElementById('editLocationId').value = loc.id;
    document.getElementById('editLocationName').value = loc.name;
    document.getElementById('editLocationSection').value = loc.section || '';
    document.getElementById('editLocationDescription').value = loc.description || '';
    new bootstrap.Modal(document.getElementById('editLocationModal')).show();
}

async function updateLocation() {
    const id = document.getElementById('editLocationId').value;
    const data = { name: document.getElementById('editLocationName').value, section: document.getElementById('editLocationSection').value, description: document.getElementById('editLocationDescription').value };
    try {
        await fetch(`${API_URL}/locations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        bootstrap.Modal.getInstance(document.getElementById('editLocationModal')).hide();
        clearCache();
        await loadLocations();
        alert('Updated!');
    } catch (error) { alert('Failed to update'); }
}

async function deleteLocation(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try { 
        await fetch(`${API_URL}/locations/${id}`, { method: 'DELETE' });
        clearCache();
        await loadLocations();
        alert('Deleted'); 
    }
    catch (error) { console.error('Delete error:', error); }
}
