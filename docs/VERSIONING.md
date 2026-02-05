# Frontend Versioning and Update Notification System

This document describes the automated semantic versioning and update notification system for the frontend application.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [How It Works](#how-it-works)
4. [CI/CD Integration](#cicd-integration)
5. [Version Increment Rules](#version-increment-rules)
6. [Update Detection](#update-detection)
7. [Configuration](#configuration)
8. [Usage](#usage)

## Overview

This system provides:
- **Automated Semantic Versioning**: Version numbers follow MAJOR.MINOR.PATCH format
- **CI/CD-Driven Updates**: Versions increment automatically on each deployment
- **Build-Time Injection**: Versions are embedded during the build process
- **Browser Update Detection**: Active users are notified when new versions are deployed
- **Cross-Browser Compatibility**: Works on Chrome, Firefox, Safari, Edge (desktop & mobile)

## Features

### 1. Automated Semantic Versioning

Versions follow the [Semantic Versioning](https://semver.org/) specification:
- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features (backward-compatible)
- **PATCH** (0.0.x): Bug fixes

### 2. Deployment-Based Version Increment

Version increments are determined by:
- Commit message conventions (Conventional Commits)
- Branch naming patterns
- Git tags
- Pipeline variables

### 3. Build-Time Version Injection

The version is injected via environment variables:
- `REACT_APP_VERSION`: The semantic version string
- `REACT_APP_BUILD_TIMESTAMP`: ISO 8601 build timestamp
- `REACT_APP_BUILD_ID`: Unique build identifier
- `REACT_APP_ENVIRONMENT`: Deployment environment

### 4. Browser Update Detection

Active users receive non-blocking notifications when:
- A new version is deployed to the server
- The browser tab becomes visible (page visibility API)
- The device comes back online

### 5. User Notification & Reload Flow

When an update is available:
- A toast/banner appears at the bottom of the screen
- Users can choose "Reload Now" or "Later"
- Reload clears caches and loads fresh assets

## How It Works

### Version Flow

```
1. Developer commits code
2. Push triggers Bitbucket Pipeline
3. Pipeline runs version-manager.sh
4. Version determined from commits/branches
5. version.json updated
6. React build with REACT_APP_* env vars
7. Build artifacts deployed to CDN/server
8. Active users detect new version.json
9. Update banner shown to users
10. User reloads to get new version
```

### File Structure

```
├── public/
│   └── version.json          # Version manifest (updated by pipeline)
├── src/
│   ├── components/
│   │   └── VersionUpdateBanner.jsx  # Update notification UI
│   ├── hooks/
│   │   └── useVersionCheck.js       # Version checking hook
│   └── utils/
│       └── version.js               # Version utilities
├── scripts/
│   └── version-manager.sh           # CI/CD version script
└── bitbucket-pipelines.yml          # Pipeline configuration
```

## CI/CD Integration

### Bitbucket Pipelines

The `bitbucket-pipelines.yml` provides:

1. **Branch-based deployments**:
   - `main/master` → Production (patch increment)
   - `develop` → Staging (minor increment)
   - `feature/*` → Development (patch increment)
   - `hotfix/*` → Production hotfix (patch increment)
   - `release/*` → Staging/Production (minor increment)

2. **Tag-based deployments**:
   - `v*` tags trigger production builds with the tagged version

3. **Custom/Manual pipelines**:
   - `major-release`: Force major version bump
   - `minor-release`: Force minor version bump
   - `patch-release`: Force patch version bump

### Pipeline Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VERSION_INCREMENT` | Force increment type (major/minor/patch) | auto-detect |
| `DEPLOY_ENVIRONMENT` | Target environment | production |
| `CREATE_GIT_TAG` | Create git tag after versioning | false |
| `PUSH_GIT_TAG` | Push git tag to remote | false |

## Version Increment Rules

### From Commit Messages (Conventional Commits)

| Pattern | Increment |
|---------|-----------|
| `feat!:` or `BREAKING CHANGE:` | MAJOR |
| `feat:` | MINOR |
| `fix:`, `chore:`, `docs:`, etc. | PATCH |
| `[major]` in message | MAJOR |
| `[minor]` in message | MINOR |
| `[patch]` in message | PATCH |

### From Branch Names

| Branch Pattern | Increment |
|----------------|-----------|
| `major/*`, `release-major/*` | MAJOR |
| `feature/*`, `feat/*`, `develop` | MINOR |
| `hotfix/*`, `bugfix/*`, `fix/*` | PATCH |
| `main`, `master` | PATCH |

### Priority

1. Pipeline variable (`VERSION_INCREMENT`)
2. Commit message patterns
3. Branch name patterns
4. Default: PATCH

## Update Detection

### Polling Strategy

The `useVersionCheck` hook:
1. Fetches `version.json` with cache-busting headers
2. Compares server version with bundled version
3. Shows notification if newer version exists

### Cache Bypass

Multiple strategies ensure fresh version data:
- Query parameter: `?_=timestamp`
- Headers: `Cache-Control: no-cache, no-store`
- Fetch option: `cache: 'no-store'`

### Event Triggers

Version checks occur on:
- Initial page load (5 second delay)
- Periodic interval (configurable, default 60 seconds)
- Tab becomes visible (Page Visibility API)
- Device comes online (online/offline events)

## Configuration

### useVersionCheck Options

```javascript
const {
  updateAvailable,
  newVersion,
  currentVersion,
  reloadToUpdate,
  dismissUpdate,
} = useVersionCheck({
  checkInterval: 60000,  // Check every 60 seconds
  enabled: true,         // Enable/disable checking
  versionUrl: '/version.json',  // Version manifest URL
});
```

### Environment Variables

Set during build:
```bash
REACT_APP_VERSION=1.2.3
REACT_APP_BUILD_TIMESTAMP=2024-01-15T10:30:00Z
REACT_APP_BUILD_ID=build-123
REACT_APP_ENVIRONMENT=production
```

## Usage

### NPM Scripts

```bash
# Build with automatic versioning
npm run build:versioned

# Manually bump version (auto-detect type)
npm run version:bump

# Force specific version increment
npm run version:major
npm run version:minor
npm run version:patch
```

### Accessing Version in Code

```javascript
import { getVersionInfo, getAppVersion } from './utils/version';

// Get current version
const version = getAppVersion(); // "1.2.3"

// Get full version info
const info = getVersionInfo();
// {
//   version: "1.2.3",
//   buildTimestamp: "2024-01-15T10:30:00Z",
//   buildId: "build-123",
//   environment: "production"
// }
```

### Displaying Version in UI

```jsx
import { getAppVersion } from './utils/version';

function Footer() {
  return (
    <footer>
      <small>Version {getAppVersion()}</small>
    </footer>
  );
}
```

## Browser Compatibility

The update detection system works on:
- ✅ Chrome (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)
- ✅ Safari (Desktop & Mobile)
- ✅ Edge (Desktop & Mobile)

### Features Used

- Fetch API (widely supported)
- Page Visibility API (widely supported)
- Online/Offline events (widely supported)
- CSS Animations (widely supported)

## Troubleshooting

### Version Not Updating

1. Check `version.json` is being copied to build directory
2. Verify cache headers are set correctly on your CDN
3. Ensure `REACT_APP_VERSION` env var is set during build

### Update Banner Not Showing

1. Check browser console for errors
2. Verify `version.json` returns valid JSON
3. Ensure new version is greater than current version

### False Update Notifications

1. Ensure `version.json` has consistent versioning
2. Check for race conditions in deployment
3. Verify CDN cache invalidation is working
