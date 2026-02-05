/**
 * Version utilities for accessing the current application version
 * The version is injected at build time via environment variables
 */

// Get version from environment variable (injected at build time)
// Falls back to package.json version in development
export const getAppVersion = () => {
  return process.env.REACT_APP_VERSION || '1.0.0';
};

// Get build timestamp (injected at build time)
export const getBuildTimestamp = () => {
  return process.env.REACT_APP_BUILD_TIMESTAMP || new Date().toISOString();
};

// Get build ID (injected at build time)
export const getBuildId = () => {
  return process.env.REACT_APP_BUILD_ID || 'local';
};

// Get environment
export const getEnvironment = () => {
  return process.env.REACT_APP_ENVIRONMENT || process.env.NODE_ENV || 'development';
};

// Get full version info object
export const getVersionInfo = () => ({
  version: getAppVersion(),
  buildTimestamp: getBuildTimestamp(),
  buildId: getBuildId(),
  environment: getEnvironment(),
});

// Compare semantic versions
// Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
export const compareVersions = (v1, v2) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  
  return 0;
};

// Check if a new version is available
export const isNewerVersion = (currentVersion, newVersion) => {
  return compareVersions(newVersion, currentVersion) > 0;
};

// Log version info to console (useful for debugging)
export const logVersionInfo = () => {
  const info = getVersionInfo();
  console.log('%c📦 App Version Info', 'font-weight: bold; font-size: 14px;');
  console.log(`   Version: ${info.version}`);
  console.log(`   Build ID: ${info.buildId}`);
  console.log(`   Build Time: ${info.buildTimestamp}`);
  console.log(`   Environment: ${info.environment}`);
};
