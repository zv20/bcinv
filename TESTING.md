# BC Inventory - Testing Guide

## Overview

This document provides comprehensive testing procedures for the BC Inventory Management System, focusing on the device-specific UI enhancements from Issue #1.

## Testing Environments

### Browsers to Test
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ⚠️ Mobile Safari (iOS)
- ⚠️ Chrome Mobile (Android)

### Devices to Test
- **Desktop**: 1920x1080, 1366x768
- **Tablet**: iPad (768x1024), iPad Pro (1024x1366)
- **Mobile**: iPhone (375x667), Android (360x640)

### Test User Roles
- Administrator (full access)
- Manager (read/write)
- Staff (read-only)

---

## Sprint 1: Device Detection & Mobile Navigation

### Device Detection
- [ ] Desktop viewport (>991px) detected correctly
- [ ] Tablet viewport (768-991px) detected correctly
- [ ] Mobile viewport (<768px) detected correctly
- [ ] Device type stored in cookie
- [ ] Device preference persists across sessions

### Mobile Navigation
- [ ] Hamburger menu appears on mobile
- [ ] Nav menu opens smoothly
- [ ] Nav links are tappable (44px+ touch targets)
- [ ] Active page highlighted
- [ ] Menu closes when link clicked
- [ ] No horizontal scroll on any page

### Mobile Search
- [ ] Search bar prominent on mobile
- [ ] Auto-focus on tap
- [ ] Search results display correctly
- [ ] "No results" message shows when appropriate
- [ ] Clear button works

---

## Sprint 2: Camera Integration & Scanner

### Camera Access
- [ ] Camera permission requested on first use
- [ ] Permission denied handled gracefully
- [ ] Rear camera selected by default
- [ ] Camera stream displays correctly
- [ ] No black screen issues
- [ ] Stream stops when scanner closed

### Barcode Scanning
- [ ] QR codes detected and decoded
- [ ] EAN-13 barcodes detected
- [ ] Code 128 barcodes detected
- [ ] Scan success feedback (beep/vibration)
- [ ] Product looked up automatically
- [ ] Unknown products handled correctly

### Scanner UI
- [ ] Scan area overlay visible
- [ ] Instructions clear
- [ ] Close button accessible
- [ ] Works in portrait and landscape
- [ ] No performance issues

---

## Sprint 3: Scanner Actions & Workflows

### Quick Actions
- [ ] Add stock action works
- [ ] Remove stock action works
- [ ] Adjust stock action works
- [ ] Discard stock action works
- [ ] All actions show confirmation
- [ ] Quantities validated correctly

### Low Stock Alerts
- [ ] Low stock badge appears when below threshold
- [ ] Low stock list accurate
- [ ] Supplier info shown for reordering
- [ ] Export low stock works

### Recent Scans
- [ ] Last 10 scans tracked
- [ ] Scan history persists
- [ ] Re-scan from history works
- [ ] Clear history works

---

## Sprint 4: Batch Tracking

### Batch Display
- [ ] All batches shown in table
- [ ] Sorted by expiration date (FIFO)
- [ ] Status colors correct (Good/Warning/Expired)
- [ ] "NEXT" badge on oldest batch
- [ ] Days left calculated correctly

### Batch Operations
- [ ] Add batch creates new record
- [ ] Auto-generated batch numbers work
- [ ] Custom batch numbers accepted
- [ ] FIFO deduction from oldest batch first
- [ ] Multiple batch cascade works
- [ ] Discard batch marks as discarded
- [ ] Sync quantity updates total

### Batch Summary
- [ ] Total batches count correct
- [ ] Total quantity sum correct
- [ ] Expiring soon count correct (7 days)
- [ ] Expired count correct

---

## Sprint 5: Desktop Export Menu

### Export Menu Display
- [ ] Export button visible on desktop only
- [ ] Hidden on mobile/tablet (<992px)
- [ ] Menu opens on click
- [ ] Menu closes on outside click
- [ ] Menu closes on ESC key
- [ ] Smooth animations

### Export Functionality
- [ ] Expiring Soon CSV exports
- [ ] Expiring Soon PDF exports
- [ ] Expiring Soon Excel exports
- [ ] Low Stock CSV exports
- [ ] Low Stock PDF exports
- [ ] Low Stock Excel exports
- [ ] Full Inventory CSV exports
- [ ] Full Inventory Excel exports

### Export Files
- [ ] Files download automatically
- [ ] Filenames are descriptive
- [ ] File extensions correct
- [ ] CSV opens in Excel/Sheets
- [ ] PDF formatting correct
- [ ] Excel formatting correct
- [ ] Data complete and accurate

### Export Settings
- [ ] Days setting adjusts expiring soon export
- [ ] Settings persist during session
- [ ] Loading spinner shows during export
- [ ] Success message displays
- [ ] Error handling works

---

## Sprint 6: Accessibility & Performance

### Keyboard Navigation
- [ ] Tab order logical
- [ ] All interactive elements focusable
- [ ] Focus indicators visible
- [ ] ESC closes modals/menus
- [ ] Enter/Space activates buttons
- [ ] Skip to content link works

### Screen Reader Support
- [ ] All images have alt text
- [ ] ARIA labels present
- [ ] ARIA roles assigned correctly
- [ ] Form labels associated
- [ ] Required fields marked
- [ ] Error messages announced
- [ ] Loading states announced

### Performance
- [ ] Page load < 3 seconds
- [ ] No layout shifts (CLS < 0.1)
- [ ] API requests deduplicated
- [ ] Images lazy loaded
- [ ] No memory leaks
- [ ] Smooth scrolling
- [ ] No janky animations

---

## Cross-Cutting Tests

### Responsive Design
- [ ] All pages responsive on all devices
- [ ] Tables scroll horizontally on mobile
- [ ] Touch targets 44px+ on mobile
- [ ] Text readable without zoom
- [ ] No content cut off
- [ ] Images scale correctly

### Data Integrity
- [ ] CRUD operations work correctly
- [ ] Transactions rollback on error
- [ ] Concurrent edits handled
- [ ] Data validation prevents bad input
- [ ] Audit log entries created

### Error Handling
- [ ] Network errors shown to user
- [ ] API errors handled gracefully
- [ ] Form validation errors clear
- [ ] 404 pages styled
- [ ] 500 errors logged
- [ ] Retry mechanisms work

### Security
- [ ] SQL injection prevented
- [ ] XSS attacks prevented
- [ ] CSRF tokens present
- [ ] Input sanitized
- [ ] Sensitive data not logged
- [ ] HTTPS enforced (production)

---

## Manual Test Scenarios

### Scenario 1: New Product Scan
1. Open mobile scanner
2. Scan unknown barcode
3. Add new product form appears
4. Fill in product details
5. Submit form
6. Product created successfully
7. Can immediately add stock

**Expected**: Smooth workflow, no errors

### Scenario 2: Stock Removal (FIFO)
1. Navigate to product with multiple batches
2. Note oldest batch quantity
3. Remove stock greater than oldest batch
4. Verify oldest batch depleted first
5. Verify remaining deducted from next batch
6. Check audit log entries

**Expected**: FIFO logic applied, audit trail correct

### Scenario 3: Export Workflow
1. Open export menu (desktop)
2. Select "Expiring Soon"
3. Change days to 14
4. Click CSV export
5. Wait for download
6. Open CSV file
7. Verify data matches screen

**Expected**: File downloads, data accurate

### Scenario 4: Mobile Product Search
1. Open app on mobile device
2. Tap search bar
3. Type product name
4. Verify autocomplete suggestions
5. Tap suggestion
6. Product details load

**Expected**: Fast, responsive, accurate

### Scenario 5: Batch Expiration Alert
1. Add batch expiring in 3 days
2. Check dashboard
3. Verify "Expiring Soon" count increased
4. Navigate to expiring items
5. Verify batch appears in list
6. Status shows yellow warning

**Expected**: Alerts appear, colors correct

---

## Automated Testing

### Unit Tests
- API endpoints (using Jest/Mocha)
- Utility functions
- Data validation logic
- Date calculations
- FIFO algorithm

### Integration Tests
- Database transactions
- API request/response cycles
- File exports
- Camera integration

### E2E Tests (Playwright/Cypress)
- Complete user workflows
- Multi-page journeys
- Scanner functionality
- Export processes

---

## Performance Benchmarks

### Page Load Times
- Dashboard: < 1.5s
- Products List: < 2s
- Product Detail: < 1s
- Export Generation: < 5s

### API Response Times
- GET requests: < 500ms
- POST requests: < 1s
- Search queries: < 300ms
- Export endpoints: < 3s

---

## Bug Tracking

### Priority Levels
- **P0 Critical**: Blocks core functionality
- **P1 High**: Major feature broken
- **P2 Medium**: Minor feature issue
- **P3 Low**: Cosmetic/nice-to-have

### Bug Report Template
```
**Title**: [Short description]
**Priority**: P0/P1/P2/P3
**Device**: Desktop/Tablet/Mobile
**Browser**: Chrome/Firefox/Safari/Edge
**Steps to Reproduce**:
1. ...
2. ...
3. ...
**Expected**: [What should happen]
**Actual**: [What actually happens]
**Screenshots**: [If applicable]
```

---

## Sign-Off Checklist

Before marking testing complete:

- [ ] All P0 and P1 bugs fixed
- [ ] All manual test scenarios passed
- [ ] All browsers tested
- [ ] Mobile devices tested
- [ ] Accessibility audit passed
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Deployment plan reviewed

---

## Testing Tools

### Recommended Tools
- **Lighthouse**: Performance and accessibility audits
- **axe DevTools**: Accessibility testing
- **BrowserStack**: Cross-browser testing
- **Postman**: API testing
- **Chrome DevTools**: Network and performance analysis
- **Responsively**: Multi-device preview

---

**Last Updated**: February 2, 2026  
**Version**: 1.0.0  
**Issue**: #1 - Device-Specific UI
