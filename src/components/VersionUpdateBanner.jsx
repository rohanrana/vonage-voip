import React from 'react';
import { getAppVersion } from '../utils/version';

/**
 * VersionUpdateBanner - A non-blocking UI banner to notify users of new versions
 * 
 * Features:
 * - Non-intrusive design that doesn't block user interaction
 * - Smooth animations for appearance
 * - Reload button for easy updating
 * - Dismiss option for users who want to continue without updating
 * - Works on all major browsers (Chrome, Firefox, Safari, Edge)
 * - Responsive design for mobile and desktop
 */
const VersionUpdateBanner = ({
  newVersion,
  onReload,
  onDismiss,
  isVisible = true,
}) => {
  const currentVersion = getAppVersion();

  if (!isVisible) return null;

  return (
    <div
      className="version-update-banner"
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        maxWidth: '90%',
        width: '450px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        animation: 'slideUp 0.4s ease-out',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12,16 16,12 12,8" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </div>

      {/* Message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: 'white',
            fontWeight: '600',
            fontSize: '14px',
            marginBottom: '4px',
          }}
        >
          New version available
        </div>
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '12px',
          }}
        >
          {currentVersion} → {newVersion}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={onDismiss}
          aria-label="Dismiss update notification"
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            color: 'white',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          }}
        >
          Later
        </button>
        <button
          onClick={onReload}
          aria-label="Reload to update"
          style={{
            background: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            color: '#667eea',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Reload Now
        </button>
      </div>

      {/* CSS Animation */}
      <style>
        {`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default VersionUpdateBanner;
