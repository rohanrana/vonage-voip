import { useState, useEffect, useCallback, useRef } from 'react';
import { getAppVersion, isNewerVersion } from '../utils/version';

/**
 * Custom hook to detect new frontend deployments
 * Works across browser caching, CDN caching, and long-running sessions
 * 
 * @param {Object} options Configuration options
 * @param {number} options.checkInterval - Interval in ms to check for updates (default: 60000 - 1 minute)
 * @param {boolean} options.enabled - Enable/disable version checking (default: true)
 * @param {string} options.versionUrl - URL to fetch version.json (default: '/version.json')
 */
export const useVersionCheck = (options = {}) => {
  const {
    checkInterval = 60000, // 1 minute default
    enabled = true,
    versionUrl = '/version.json',
  } = options;

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [error, setError] = useState(null);
  
  const currentVersion = getAppVersion();
  const intervalRef = useRef(null);
  const documentVisibleRef = useRef(true);
  const isCheckingRef = useRef(false);

  /**
   * Fetch version info from server with cache-busting
   * Uses multiple strategies to bypass browser and CDN caching
   */
  const fetchVersionInfo = useCallback(async () => {
    // Add cache-busting query parameter
    const cacheBuster = `?_=${Date.now()}`;
    const url = `${versionUrl}${cacheBuster}`;

    const response = await fetch(url, {
      method: 'GET',
      // Headers to bypass caching
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      // Don't use cached responses
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch version: ${response.status}`);
    }

    return response.json();
  }, [versionUrl]);

  /**
   * Check for updates - uses ref to prevent re-render loops
   */
  const checkForUpdates = useCallback(async () => {
    if (!enabled || isCheckingRef.current) return;

    isCheckingRef.current = true;
    setIsChecking(true);
    setError(null);

    try {
      const versionInfo = await fetchVersionInfo();
      const serverVersion = versionInfo.version;

      setLastChecked(new Date());

      if (serverVersion && isNewerVersion(currentVersion, serverVersion)) {
        setUpdateAvailable(true);
        setNewVersion(serverVersion);
        console.log(`🔄 New version available: ${serverVersion} (current: ${currentVersion})`);
      }
    } catch (err) {
      // Silently handle errors - don't disrupt user experience
      setError(err);
      console.warn('Version check failed:', err.message);
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [enabled, fetchVersionInfo, currentVersion]);

  /**
   * Reload the page to get the latest version
   * Uses a clean reload approach to ensure fresh assets
   */
  const reloadToUpdate = useCallback(() => {
    // Clear any service worker caches if present
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }

    // Perform a hard reload
    // Using location.reload(true) is deprecated, so we use this approach
    window.location.href = window.location.href.split('?')[0] + '?_reload=' + Date.now();
  }, []);

  /**
   * Dismiss the update notification (user chose not to update now)
   */
  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  /**
   * Handle visibility change - check for updates when tab becomes visible
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      documentVisibleRef.current = !document.hidden;
      
      // Check for updates when user returns to the tab
      if (!document.hidden && enabled) {
        checkForUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, checkForUpdates]);

  /**
   * Set up periodic version checking
   */
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial check after a short delay (don't block initial render)
    const initialTimeout = setTimeout(() => {
      checkForUpdates();
    }, 5000);

    // Set up periodic checks
    intervalRef.current = setInterval(() => {
      // Only check if document is visible
      if (documentVisibleRef.current) {
        checkForUpdates();
      }
    }, checkInterval);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, checkInterval, checkForUpdates]);

  /**
   * Handle online/offline events - check when coming back online
   */
  useEffect(() => {
    const handleOnline = () => {
      if (enabled) {
        checkForUpdates();
      }
    };

    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, checkForUpdates]);

  return {
    // State
    updateAvailable,
    newVersion,
    currentVersion,
    isChecking,
    lastChecked,
    error,
    
    // Actions
    checkForUpdates,
    reloadToUpdate,
    dismissUpdate,
  };
};

export default useVersionCheck;
