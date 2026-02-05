const API_URL = '/api';

// Global data storage
let allStockData = [];
let currentProduct = null;
let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
let perPage = 50;

// Expiring items data
let allExpiringItems = [];
let filteredExpiringItems = [];
let expiringDaysFilter = 7;
let expiringSortColumn = 'days';
let expiringSortOrder = 'asc';

// Activity log data
let allActivityLogs = [];
let filteredActivityLogs = [];
let activityCurrentPage = 1;
let activityPerPage = 50;
let activityTypeFilter = '';

document.addEventListener('DOMContentLoaded', () => { showDashboard(); });

function hideAllViews() {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-link, .dropdown-item').forEach(l => l.classList.remove('active'));
}

function clearCache() {
    if (window.performanceOptimizer) {
        window.performanceOptimizer.clearCache();
    }
}

// Navigation functions
function showDashboard() { hideAllViews(); document.getElementById('dashboardView').style.display = 'block'; document.querySelector('a[onclick*="showDashboard"]').classList.add('active'); loadDashboard(); }
function showProducts() { hideAllViews(); document.getElementById('productsView').style.display = 'block'; document.querySelector('a[onclick*="showProducts"]').classList.add('active'); loadProducts(); }
function showExpiring() { hideAllViews(); document.getElementById('expiringView').style.display = 'block'; document.querySelector('a[onclick*="showExpiring"]').classList.add('active'); loadExpiring(); }
function showActivityLog() { hideAllViews(); document.getElementById('activityLogView').style.display = 'block'; loadActivityLog(); }
function showDepartments() { hideAllViews(); document.getElementById('departmentsView').style.display = 'block'; loadDepartments(); }
function showSuppliers() { hideAllViews(); document.getElementById('suppliersView').style.display = 'block'; loadSuppliers(); }
function showLocations() { hideAllViews(); document.getElementById('locationsView').style.display = 'block'; loadLocations(); }

// === EXPIRING SOON PAGE ===

async function loadExpiring() {
    try {
        const response = await fetch(`${API_URL}/stock?status=active`);
        const stock = await response.json();
        
        // Filter items with expiry dates and calculate days left
        allExpiringItems = stock
            .filter(s => s.expiry_date)
            .map(s => {
                const daysLeft = Math.ceil((new Date(s.expiry_date) - new Date()) / 86400000);
                return { ...s, days_until_expiry: daysLeft };
            })
            .filter(s => s.days_until_expiry <= 365); // Show all within a year
        
        // Apply initial filter (7 days)
        filterExpiringDays(7);
    } catch (error) {
        console.error('Expiring items fetch error:', error);
        document.getElementById('expiringTable').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load expiring items</td></tr>';
    }
}

function filterExpiringDays(days) {
    expiringDaysFilter = days;
    
    // Update button states
    ['expiring7', 'expiring14', 'expiring30', 'expiringAll'].forEach(id => {
        document.getElementById(id).classList.remove('btn-primary');
        document.getElementById(id).classList.add('btn-outline-primary');
    });
    
    const btnId = days === 365 ? 'expiringAll' : `expiring${days}`;
    document.getElementById(btnId).classList.remove('btn-outline-primary');
    document.getElementById(btnId).classList.add('btn-primary');
    
    // Filter items
    filteredExpiringItems = allExpiringItems.filter(item => item.days_until_expiry <= days);
    
    // Apply search if any
    filterExpiringTable();
}

function filterExpiringTable() {
    const searchText = document.getElementById('expiringSearch').value.toLowerCase();
    
    let items = allExpiringItems.filter(item => item.days_until_expiry <= expiringDaysFilter);
    
    if (searchText) {
        items = items.filter(item => 
            item.product_name.toLowerCase().includes(searchText) ||
            (item.location_name && item.location_name.toLowerCase().includes(searchText))
        );
    }
    
    filteredExpiringItems = items;
    sortExpiringTable(expiringSortColumn, true);
}

function sortExpiringTable(column, keepOrder = false) {
    if (!keepOrder) {
        if (expiringSortColumn === column) {
            expiringSortOrder = expiringSortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            expiringSortColumn = column;
            expiringSortOrder = 'asc';
        }
    }
    
    filteredExpiringItems.sort((a, b) => {
        let valA, valB;
        
        switch(column) {
            case 'product':
                valA = a.product_name.toLowerCase();
                valB = b.product_name.toLowerCase();
                break;
            case 'location':
                valA = (a.location_name || '').toLowerCase();
                valB = (b.location_name || '').toLowerCase();
                break;
            case 'quantity':
                valA = parseFloat(a.quantity);
                valB = parseFloat(b.quantity);
                break;
            case 'expiry':
                valA = new Date(a.expiry_date).getTime();
                valB = new Date(b.expiry_date).getTime();
                break;
            case 'days':
                valA = a.days_until_expiry;
                valB = b.days_until_expiry;
                break;
            default:
                return 0;
        }
        
        if (valA < valB) return expiringSortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return expiringSortOrder === 'asc' ? 1 : -1;
        return 0;
    });
    
    renderExpiringTable();
}

function renderExpiringTable() {
    const table = document.getElementById('expiringTable');
    
    if (filteredExpiringItems.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="text-center">No expiring items found</td></tr>';
        return;
    }
    
    table.innerHTML = filteredExpiringItems.map(item => {
        const daysClass = item.days_until_expiry <= 3 ? 'text-danger fw-bold' : 
                         item.days_until_expiry <= 7 ? 'text-danger' : 
                         item.days_until_expiry <= 14 ? 'text-warning' : '';
        
        return `<tr>
            <td>${item.product_name}</td>
            <td>${item.location_name || 'No location'}</td>
            <td>${parseFloat(item.quantity).toFixed(2)}</td>
            <td class="${daysClass}">${new Date(item.expiry_date).toLocaleDateString()}</td>
            <td class="${daysClass}">${item.days_until_expiry} days</td>
            <td>
                <button class="btn btn-sm btn-warning btn-icon" onclick="adjustStock(${item.id}, '${item.product_name.replace(/'/g, "\\'")}'Edits, ${item.quantity})" title="Adjust Stock">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger btn-icon" onclick="discardStock(${item.id}, '${item.product_name.replace(/'/g, "\\'")}'Edits, ${item.quantity})" title="Discard">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// === ACTIVITY LOG PAGE ===

async function loadActivityLog() {
    try {
        const response = await fetch(`${API_URL}/audit?limit=1000`);
        allActivityLogs = await response.json();
        filteredActivityLogs = allActivityLogs;
        activityCurrentPage = 1;
        
        // Set default filter button
        document.getElementById('activityAll').classList.add('btn-primary');
        document.getElementById('activityAll').classList.remove('btn-outline-primary');
        
        filterActivityTable();
    } catch (error) {
        console.error('Activity log fetch error:', error);
        document.getElementById('activityTable').innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load activity log</td></tr>';
    }
}

function filterActivityType(type) {
    activityTypeFilter = type;
    
    // Update button states
    ['activityAll', 'activityAdded', 'activityAdjusted', 'activityDiscarded'].forEach(id => {
        const btn = document.getElementById(id);
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline-primary');
    });
    
    const btnMap = {
        '': 'activityAll',
        'stock_added': 'activityAdded',
        'stock_adjusted': 'activityAdjusted',
        'stock_discarded': 'activityDiscarded'
    };
    
    const btnId = btnMap[type] || 'activityAll';
    document.getElementById(btnId).classList.remove('btn-outline-primary');
    document.getElementById(btnId).classList.add('btn-primary');
    
    activityCurrentPage = 1;
    filterActivityTable();
}

function filterActivityTable() {
    const searchText = document.getElementById('activitySearch').value.toLowerCase();
    
    filteredActivityLogs = allActivityLogs.filter(log => {
        // Type filter
        if (activityTypeFilter && log.action !== activityTypeFilter) return false;
        
        // Search filter
        if (searchText && !log.product_name.toLowerCase().includes(searchText)) return false;
        
        return true;
    });
    
    renderActivityTable();
}

function renderActivityTable() {
    const start = (activityCurrentPage - 1) * activityPerPage;
    const end = start + parseInt(activityPerPage);
    const pageLogs = filteredActivityLogs.slice(start, end);
    
    const table = document.getElementById('activityTable');
    
    if (pageLogs.length === 0) {
        table.innerHTML = '<tr><td colspan="5" class="text-center">No activity found</td></tr>';
    } else {
        table.innerHTML = pageLogs.map(log => {
            const actionBadge = {
                'stock_added': '<span class="badge bg-success">Added</span>',
                'add_stock': '<span class="badge bg-success">Added</span>',
                'stock_adjusted': '<span class="badge bg-warning">Adjusted</span>',
                'adjust_stock': '<span class="badge bg-warning">Adjusted</span>',
                'stock_discarded': '<span class="badge bg-danger">Discarded</span>',
                'discard': '<span class="badge bg-danger">Discarded</span>',
                'add_batch': '<span class="badge bg-success">Batch Added</span>',
                'discard_batch': '<span class="badge bg-danger">Batch Discarded</span>'
            };
            
            const badge = actionBadge[log.action] || `<span class="badge bg-secondary">${log.action}</span>`;
            const qtyChange = log.quantity_change > 0 ? `+${log.quantity_change}` : log.quantity_change;
            const qtyClass = log.quantity_change > 0 ? 'text-success' : 'text-danger';
            
            return `<tr>
                <td><small>${new Date(log.created_at).toLocaleString()}</small></td>
                <td>${badge}</td>
                <td>${log.product_name}<br><small class="text-muted">${log.sku || 'No SKU'}</small></td>
                <td class="${qtyClass} fw-bold">${qtyChange || '-'}</td>
                <td><small>${log.reason || '-'}<br>${log.notes || ''}</small></td>
            </tr>`;
        }).join('');
    }
    
    // Update pagination info
    const actualStart = pageLogs.length === 0 ? 0 : start + 1;
    const actualEnd = Math.min(end, filteredActivityLogs.length);
    document.getElementById('activityPaginationInfo').textContent = `Showing ${actualStart}-${actualEnd} of ${filteredActivityLogs.length} entries`;
    
    renderActivityPaginationButtons();
}

function renderActivityPaginationButtons() {
    const totalPages = Math.ceil(filteredActivityLogs.length / parseInt(activityPerPage));
    let html = '';
    
    // Previous button
    html += `<button class="btn btn-sm btn-outline-primary" onclick="changeActivityPage(${activityCurrentPage - 1})" ${activityCurrentPage === 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>`;
    
    // Page numbers (show max 5 pages)
    const startPage = Math.max(1, activityCurrentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    if (startPage > 1) {
        html += `<button class="btn btn-sm btn-outline-primary" onclick="changeActivityPage(1)">1</button>`;
        if (startPage > 2) html += `<span style="padding: 0 8px;">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="btn btn-sm ${i === activityCurrentPage ? 'btn-primary active' : 'btn-outline-primary'}" onclick="changeActivityPage(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding: 0 8px;">...</span>`;
        html += `<button class="btn btn-sm btn-outline-primary" onclick="changeActivityPage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button class="btn btn-sm btn-outline-primary" onclick="changeActivityPage(${activityCurrentPage + 1})" ${activityCurrentPage === totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>`;
    
    document.getElementById('activityPaginationButtons').innerHTML = html;
}

function changeActivityPage(page) {
    const totalPages = Math.ceil(filteredActivityLogs.length / parseInt(activityPerPage));
    if (page < 1 || page > totalPages) return;
    activityCurrentPage = page;
    renderActivityTable();
}

function changeActivityPerPage() {
    activityPerPage = document.getElementById('activityPerPage').value;
    activityCurrentPage = 1;
    renderActivityTable();
}

// === EXISTING FUNCTIONS (keeping all previous code) ===

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

async function showProductDetails(productId) {
    try {
        console.log('Loading product details for ID:', productId);
        
        const allProductsResp = await fetch(`${API_URL}/products?limit=1000`);
        const allData = await allProductsResp.json();
        
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
        
        document.getElementById('detailProductName').textContent = currentProduct.name || 'N/A';
        document.getElementById('detailProductSku').textContent = currentProduct.sku || 'N/A';
        document.getElementById('detailProductDepartment').textContent = currentProduct.department_name || 'N/A';
        document.getElementById('detailProductSupplier').textContent = currentProduct.supplier_name || 'N/A';
        document.getElementById('detailProductUnit').textContent = currentProduct.unit || 'N/A';
        document.getElementById('detailProductPrice').textContent = currentProduct.cost_price ? '$' + parseFloat(currentProduct.cost_price).toFixed(2) : 'N/A';
        
        await loadProductBatches(productId);
        
        new bootstrap.Modal(document.getElementById('productDetailsModal')).show();
    } catch (error) {
        console.error('Error loading product details:', error);
        alert('Failed to load product details: ' + error.message);
    }
}

async function loadProductBatches(productId) {
    try {
        console.log('Loading batches for product ID:', productId);
        
        if (!currentProduct) {
            console.error('currentProduct is not set');
            document.getElementById('batchesTable').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error: Product information not available</td></tr>';
            return;
        }
        
        const response = await fetch(`${API_URL}/products/${productId}/batches`);
        const batchesData = await response.json();
        
        console.log('Batches data response:', batchesData);
        
        let batches = [];
        if (Array.isArray(batchesData)) {
            batches = batchesData;
        } else if (batchesData.batches && Array.isArray(batchesData.batches)) {
            batches = batchesData.batches;
        } else if (batchesData.data && Array.isArray(batchesData.data)) {
            batches = batchesData.data;
        }
        
        console.log('Parsed batches:', batches);
        
        batches = batches.map(b => ({ ...b, _productName: currentProduct.name }));
        
        renderBatchesTable(batches, currentProduct.name);
    } catch (error) {
        console.error('Error loading batches:', error);
        document.getElementById('batchesTable').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load batches</td></tr>';
    }
}

function renderBatchesTable(batches, productName) {
    if (batches.length === 0) {
        document.getElementById('batchesTable').innerHTML = '<tr><td colspan="6" class="text-center text-muted">No stock batches for this product. Click "Add Batch" to add stock.</td></tr>';
        return;
    }
    
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

async function showAddBatchModal() {
    if (!currentProduct) {
        alert('No product selected');
        return;
    }
    
    const locations = await fetch(`${API_URL}/locations`).then(r => r.json());
    
    document.getElementById('stockProductSelect').innerHTML = `<option value="${currentProduct.id}" selected>${currentProduct.name} (${currentProduct.sku || 'No Barcode'})</option>`;
    document.getElementById('stockLocationSelect').innerHTML = '<option value="">No location</option>' + locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    document.getElementById('addStockForm').reset();
    document.getElementById('stockProductSelect').value = currentProduct.id;
    
    bootstrap.Modal.getInstance(document.getElementById('productDetailsModal')).hide();
    
    const addStockModal = new bootstrap.Modal(document.getElementById('addStockModal'));
    addStockModal.show();
    
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

function editProductFromDetails() {
    if (!currentProduct) {
        alert('No product selected');
        return;
    }
    
    bootstrap.Modal.getInstance(document.getElementById('productDetailsModal')).hide();
    
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
        const response = await fetch(`${API_URL}/products?limit=10000`);
        const data = await response.json();
        allProducts = data.products || [];
        
        await loadFilterDropdowns();
        
        applyProductFilters();
        
        renderMobileProductCards(allProducts);
    } catch (error) { console.error('Products error:', error); }
}

async function loadFilterDropdowns() {
    try {
        const [depts, suppliers] = await Promise.all([
            fetch(`${API_URL}/departments`).then(r => r.json()),
            fetch(`${API_URL}/suppliers`).then(r => r.json())
        ]);
        
        document.getElementById('departmentFilter').innerHTML = '<option value="">All Departments</option>' + 
            depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        
        document.getElementById('supplierFilter').innerHTML = '<option value="">All Suppliers</option>' + 
            suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading filter dropdowns:', error);
    }
}

function applyProductFilters() {
    const searchText = document.getElementById('productSearchInput').value.toLowerCase();
    const departmentId = document.getElementById('departmentFilter').value;
    const supplierId = document.getElementById('supplierFilter').value;
    const expiryFilter = document.getElementById('expiryFilter').value;
    const sortBy = document.getElementById('sortByFilter').value;
    const sortOrder = document.getElementById('sortOrderFilter').value;
    
    filteredProducts = allProducts.filter(p => {
        if (searchText) {
            const matchName = p.name.toLowerCase().includes(searchText);
            const matchSku = (p.sku || '').toLowerCase().includes(searchText);
            const matchDept = (p.department_name || '').toLowerCase().includes(searchText);
            const matchSupplier = (p.supplier_name || '').toLowerCase().includes(searchText);
            if (!matchName && !matchSku && !matchDept && !matchSupplier) return false;
        }
        
        if (departmentId && p.department_id != departmentId) return false;
        
        if (supplierId && p.supplier_id != supplierId) return false;
        
        if (expiryFilter) {
            if (expiryFilter === 'no_expiry' && p.next_expiry_date) return false;
            if (expiryFilter === 'expiring_soon' && p.next_expiry_date) {
                const daysLeft = Math.ceil((new Date(p.next_expiry_date) - new Date()) / 86400000);
                if (daysLeft > 7) return false;
            }
            if (expiryFilter === 'expiring_month' && p.next_expiry_date) {
                const daysLeft = Math.ceil((new Date(p.next_expiry_date) - new Date()) / 86400000);
                if (daysLeft > 30) return false;
            }
        }
        
        return true;
    });
    
    filteredProducts.sort((a, b) => {
        let valA, valB;
        
        switch(sortBy) {
            case 'name':
                valA = (a.name || '').toLowerCase();
                valB = (b.name || '').toLowerCase();
                break;
            case 'sku':
                valA = (a.sku || '').toLowerCase();
                valB = (b.sku || '').toLowerCase();
                break;
            case 'department':
                valA = (a.department_name || '').toLowerCase();
                valB = (b.department_name || '').toLowerCase();
                break;
            case 'supplier':
                valA = (a.supplier_name || '').toLowerCase();
                valB = (b.supplier_name || '').toLowerCase();
                break;
            case 'price':
                valA = parseFloat(a.cost_price || 0);
                valB = parseFloat(b.cost_price || 0);
                break;
            case 'stock':
                valA = parseFloat(a.total_quantity || 0);
                valB = parseFloat(b.total_quantity || 0);
                break;
            case 'expiry':
                valA = a.next_expiry_date ? new Date(a.next_expiry_date).getTime() : Infinity;
                valB = b.next_expiry_date ? new Date(b.next_expiry_date).getTime() : Infinity;
                break;
            default:
                return 0;
        }
        
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
    
    currentPage = 1;
    
    renderProductsTable();
    updateActiveFilterBadges();
}

function renderProductsTable() {
    const start = (currentPage - 1) * perPage;
    const end = perPage === 'all' ? filteredProducts.length : start + parseInt(perPage);
    const pageProducts = perPage === 'all' ? filteredProducts : filteredProducts.slice(start, end);
    
    document.getElementById('productsTable').innerHTML = pageProducts.length === 0 ? '<tr><td colspan="7" class="text-center">No products found</td></tr>' :
        pageProducts.map(p => `<tr><td>${p.name}</td><td>${p.sku || '-'}</td><td>${p.department_name || '-'}</td><td>${p.supplier_name || '-'}</td><td>${p.unit || '-'}</td><td>$${parseFloat(p.cost_price || 0).toFixed(2)}</td><td><button class="btn btn-sm btn-info btn-icon" onclick="showProductDetails(${p.id})" title="View Details"><i class="bi bi-eye"></i></button> <button class="btn btn-sm btn-primary btn-icon" onclick='editProduct(${JSON.stringify(p).replace(/'/g, "&apos;")})'><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-danger btn-icon" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')" ><i class="bi bi-trash"></i></button></td></tr>`).join('');
    
    const actualStart = pageProducts.length === 0 ? 0 : start + 1;
    const actualEnd = Math.min(end, filteredProducts.length);
    document.getElementById('paginationInfo').textContent = `Showing ${actualStart}-${actualEnd} of ${filteredProducts.length} products`;
    document.getElementById('resultInfo').textContent = `${filteredProducts.length} of ${allProducts.length} products`;
    
    renderPaginationButtons();
}

function renderPaginationButtons() {
    if (perPage === 'all') {
        document.getElementById('paginationButtons').innerHTML = '';
        return;
    }
    
    const totalPages = Math.ceil(filteredProducts.length / parseInt(perPage));
    let html = '';
    
    html += `<button class="btn btn-sm btn-outline-primary" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>`;
    
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    if (startPage > 1) {
        html += `<button class="btn btn-sm btn-outline-primary" onclick="changePage(1)">1</button>`;
        if (startPage > 2) html += `<span style="padding: 0 8px;">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary active' : 'btn-outline-primary'}" onclick="changePage(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding: 0 8px;">...</span>`;
        html += `<button class="btn btn-sm btn-outline-primary" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    
    html += `<button class="btn btn-sm btn-outline-primary" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>`;
    
    document.getElementById('paginationButtons').innerHTML = html;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredProducts.length / parseInt(perPage));
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderProductsTable();
}

function changePerPage() {
    perPage = document.getElementById('perPageSelect').value;
    currentPage = 1;
    renderProductsTable();
}

function updateActiveFilterBadges() {
    const badges = [];
    
    const searchText = document.getElementById('productSearchInput').value;
    const departmentId = document.getElementById('departmentFilter').value;
    const supplierId = document.getElementById('supplierFilter').value;
    const expiryFilter = document.getElementById('expiryFilter').value;
    
    if (searchText) badges.push(`Search: "${searchText}"`);
    if (departmentId) {
        const deptName = document.querySelector(`#departmentFilter option[value="${departmentId}"]`).textContent;
        badges.push(`Department: ${deptName}`);
    }
    if (supplierId) {
        const supplierName = document.querySelector(`#supplierFilter option[value="${supplierId}"]`).textContent;
        badges.push(`Supplier: ${supplierName}`);
    }
    if (expiryFilter) {
        const expiryName = document.querySelector(`#expiryFilter option[value="${expiryFilter}"]`).textContent;
        badges.push(`Expiry: ${expiryName}`);
    }
    
    document.getElementById('activeFilterBadges').innerHTML = badges.map(b => 
        `<span class="filter-badge">${b} <i class="bi bi-x-circle" onclick="clearAllFilters()"></i></span>`
    ).join('');
}

function clearAllFilters() {
    document.getElementById('productSearchInput').value = '';
    document.getElementById('departmentFilter').value = '';
    document.getElementById('supplierFilter').value = '';
    document.getElementById('expiryFilter').value = '';
    document.getElementById('sortByFilter').value = 'name';
    document.getElementById('sortOrderFilter').value = 'asc';
    applyProductFilters();
}

function renderMobileProductCards(products) {
    const container = document.getElementById('mobileProductCards');
    if (!container) return;
    
    if (products.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">No products found</div>';
        return;
    }
    
    container.innerHTML = products.map(p => {
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
            const stockTable = document.getElementById('stockTable');
            if (stockTable) {
                await loadStock();
            }
            if (currentProduct && data.product_id == currentProduct.id) {
                await loadProductBatches(currentProduct.id);
            }
            // Reload expiring view if open
            if (document.getElementById('expiringView').style.display === 'block') {
                await loadExpiring();
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
        
        const stockTable = document.getElementById('stockTable');
        if (stockTable) {
            await loadStock();
        }
        
        if (currentProduct) {
            await loadProductBatches(currentProduct.id);
        }
        
        // Reload expiring view if open
        if (document.getElementById('expiringView').style.display === 'block') {
            await loadExpiring();
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
        
        const stockTable = document.getElementById('stockTable');
        if (stockTable) {
            await loadStock();
        }
        
        if (currentProduct) {
            await loadProductBatches(currentProduct.id);
        }
        
        // Reload expiring view if open
        if (document.getElementById('expiringView').style.display === 'block') {
            await loadExpiring();
        }
        
        alert('Discarded');
    } catch (error) { 
        console.error('Discard error:', error);
        alert('Failed to discard stock: ' + error.message);
    }
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
