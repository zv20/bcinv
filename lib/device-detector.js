/**
 * Device Detection Middleware
 * Detects device type (desktop/tablet/mobile) from user agent
 */

const deviceDetector = (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  
  // Mobile device patterns
  const mobilePattern = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const tabletPattern = /iPad|Android(?!.*Mobile)|Tablet/i;
  
  // Determine device type
  let deviceType = 'desktop';
  
  if (tabletPattern.test(userAgent)) {
    deviceType = 'tablet';
  } else if (mobilePattern.test(userAgent)) {
    deviceType = 'mobile';
  }
  
  // Check for manual override in query params or cookie
  const override = req.query.device || req.cookies?.device;
  if (override && ['desktop', 'tablet', 'mobile'].includes(override)) {
    deviceType = override;
  }
  
  // Attach to request object
  req.device = {
    type: deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    userAgent: userAgent
  };
  
  next();
};

/**
 * Middleware to set device cookie for persistence
 */
const setDevicePreference = (req, res, next) => {
  const devicePref = req.query.device;
  
  if (devicePref && ['desktop', 'tablet', 'mobile'].includes(devicePref)) {
    res.cookie('device', devicePref, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: false, // Allow JS access for client-side logic
      sameSite: 'lax'
    });
  }
  
  next();
};

module.exports = {
  deviceDetector,
  setDevicePreference
};
