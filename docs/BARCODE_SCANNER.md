# 📷 Barcode Scanner Implementation

## Overview
The BC Inventory mobile app now includes a fully functional barcode scanner that uses your device camera to scan barcodes and QR codes.

## Technology
- **Library**: html5-qrcode v2.3.8
- **Supported Formats**: All standard barcodes (UPC, EAN, Code128, etc.) and QR codes
- **Device Compatibility**: Works on modern mobile browsers with camera access

## Features

### 1. **Add New Product** 📦
- Scan a barcode to check if product exists
- If new, opens Add Product modal with barcode pre-filled
- Focus automatically moves to product name field

### 2. **Check Stock** 📊
- Scan to view real-time stock levels
- Shows all batches with locations and expiry dates
- Displays total quantity across all locations

### 3. **Discard Expired Items** 🗑️
- Scan expired products
- Navigate to stock page for removal
- *(Future: Direct discard modal)*

### 4. **Adjust Stock Quantity** ✏️
- Scan items for manual count adjustments
- Navigate to stock page for quantity updates
- *(Future: Direct adjustment modal with reason tracking)*

## How to Use

### Mobile Workflow:
1. Tap **Scan** button (camera icon in center of bottom nav)
2. Select an action from the camera menu
3. Camera opens with live barcode detection
4. Position barcode within the scanning frame
5. Automatic detection and processing

### Manual Entry:
- If camera access fails or barcode won't scan
- Use the manual entry field at the bottom of scanner
- Type barcode and press Submit or Enter

### Permissions:
- First use will request camera permission
- Grant permission to enable scanning
- Denied permission falls back to manual entry only

## User Interface

### Scanner Screen:
```
┌─────────────────────────────┐
│  ✕  Scan Barcode  [Action] │  ← Header with close button
├─────────────────────────────┤
│                             │
│     ┌─────────────┐         │
│     │   Camera    │         │  ← Live camera view
│     │   Preview   │         │
│     └─────────────┘         │
│                             │
├─────────────────────────────┤
│ Position barcode in frame   │  ← Instructions
│                             │
│ [____Manual Entry____] [Go] │  ← Manual input fallback
└─────────────────────────────┘
```

## Technical Details

### File Structure:
```
public/
├── js/
│   ├── barcode-scanner.js    # Scanner component
│   └── mobile-nav.js          # Camera menu integration
├── css/
│   └── mobile.css             # Scanner UI styling
└── index.html                 # Loads html5-qrcode library
```

### Event Flow:
```
User taps Scan button
    ↓
Camera menu opens
    ↓
User selects action (e.g., "Check Stock")
    ↓
mobile-nav.js dispatches 'cameraAction' event
    ↓
barcode-scanner.js receives event
    ↓
Scanner opens with camera
    ↓
Barcode detected
    ↓
Action-specific handler processes barcode
```

### API Integration:
- **Add Item**: `GET /api/products?search={barcode}` → Check existence
- **Check Stock**: `GET /api/products?search={barcode}` → Find product, then `GET /api/stock?product_id={id}`
- **Discard/Adjust**: Same as Check Stock, then navigate to appropriate page

## Configuration

### Scanner Settings (in barcode-scanner.js):
```javascript
const config = {
  fps: 10,                              // Frames per second
  qrbox: { width: 250, height: 150 },  // Scan area size
  aspectRatio: 1.7777778                // 16:9 ratio
};
```

### Camera Selection:
- Default: `{ facingMode: 'environment' }` (back camera on mobile)
- Automatically selects best available camera

## Troubleshooting

### Common Issues:

**Camera won't open:**
- Check browser permissions (Settings → Site Settings → Camera)
- Try HTTPS connection (camera requires secure context)
- Use manual entry as fallback

**Barcode won't scan:**
- Ensure good lighting
- Hold steady, not too close/far
- Clean camera lens
- Try manual entry with barcode numbers

**"html5-qrcode library not loaded" error:**
- Check internet connection (library loads from CDN)
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check browser console for CDN errors

**Permission denied:**
- Clear site data and reload
- Re-grant camera permission in browser settings
- Use manual entry mode

## Future Enhancements

### Planned Features:
- [ ] Direct discard modal from scanner
- [ ] Direct adjustment modal with reason dropdown
- [ ] Batch scan mode (scan multiple items)
- [ ] Sound/vibration feedback on successful scan
- [ ] Scan history log
- [ ] Offline scanning with queue
- [ ] Print barcode labels for new products

### Performance Optimizations:
- [ ] Reduce camera resolution for faster processing
- [ ] Debounce rapid scans
- [ ] Cache product lookups
- [ ] Add loading states during API calls

## Browser Compatibility

✅ **Supported:**
- Chrome/Edge (Android 5+, iOS 11+)
- Safari (iOS 11+)
- Firefox (Android 5+)
- Samsung Internet

❌ **Not Supported:**
- IE 11 or older
- Very old Android/iOS versions (pre-2017)

## Security Notes

- Camera access is only requested when scanner opens
- No camera data is stored or transmitted
- Barcode data is only sent to your own API
- Scanner stops immediately when closed
- All scanning happens client-side

## Developer Notes

### Adding New Actions:

1. Add menu item in `mobile-nav.js`:
```javascript
<div class="camera-action-item" data-action="new-action">
  // ... icon and text ...
</div>
```

2. Add handler in `barcode-scanner.js`:
```javascript
switch(this.currentAction) {
  case 'new-action':
    this.handleNewAction(barcode);
    break;
}
```

3. Implement handler method:
```javascript
async handleNewAction(barcode) {
  // Your logic here
}
```

### Testing:
- Test with various barcode formats (UPC, EAN, QR)
- Test on different devices (Android, iOS)
- Test with poor lighting conditions
- Test permission denial scenarios
- Test manual entry workflow

---

**Last Updated**: February 2026  
**Version**: 1.0  
**Maintainer**: BC Inventory Team
