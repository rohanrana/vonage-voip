#!/bin/bash

# =============================================================================
# Frontend Version Manager for CI/CD Pipeline
# =============================================================================
# This script manages semantic versioning for the frontend application.
# It determines version increments based on:
#   - Commit message conventions
#   - Branch naming patterns
#   - Git tags
#   - Pipeline variables
#
# Usage:
#   ./version-manager.sh [increment_type]
#
# Where increment_type is one of: major, minor, patch (optional)
# If not provided, it will be determined from commit messages or branch names.
# =============================================================================

set -e

# Configuration
VERSION_FILE="public/version.json"
PACKAGE_JSON="package.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Get Current Version
# =============================================================================

get_current_version() {
    if [ -f "$VERSION_FILE" ]; then
        current_version=$(cat "$VERSION_FILE" | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')
        if [ -n "$current_version" ]; then
            echo "$current_version"
            return
        fi
    fi
    
    if [ -f "$PACKAGE_JSON" ]; then
        current_version=$(cat "$PACKAGE_JSON" | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')
        if [ -n "$current_version" ]; then
            echo "$current_version"
            return
        fi
    fi
    
    # Default starting version
    echo "1.0.0"
}

# =============================================================================
# Determine Increment Type from Commit Messages
# =============================================================================

determine_increment_from_commits() {
    # Get the last commit message
    commit_msg=$(git log -1 --pretty=%B 2>/dev/null || echo "")
    
    # Check for conventional commit patterns
    # BREAKING CHANGE or ! after type = MAJOR
    if echo "$commit_msg" | grep -qiE "^(feat|fix|chore|docs|style|refactor|test|build|ci)(\(.+\))?!:|BREAKING CHANGE:"; then
        echo "major"
        return
    fi
    
    # feat = MINOR
    if echo "$commit_msg" | grep -qiE "^feat(\(.+\))?:"; then
        echo "minor"
        return
    fi
    
    # fix, chore, docs, style, refactor, test, build, ci = PATCH
    if echo "$commit_msg" | grep -qiE "^(fix|chore|docs|style|refactor|test|build|ci)(\(.+\))?:"; then
        echo "patch"
        return
    fi
    
    # Check for version keywords in commit message
    if echo "$commit_msg" | grep -qiE "\[major\]|#major|major:"; then
        echo "major"
        return
    fi
    
    if echo "$commit_msg" | grep -qiE "\[minor\]|#minor|minor:"; then
        echo "minor"
        return
    fi
    
    if echo "$commit_msg" | grep -qiE "\[patch\]|#patch|patch:"; then
        echo "patch"
        return
    fi
    
    # Default to patch
    echo "patch"
}

# =============================================================================
# Determine Increment Type from Branch Name
# =============================================================================

determine_increment_from_branch() {
    branch_name=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    
    # Major version branches
    if echo "$branch_name" | grep -qiE "^(major|release-major|breaking)"; then
        echo "major"
        return
    fi
    
    # Feature branches = minor
    if echo "$branch_name" | grep -qiE "^(feature|feat|develop|enhancement)"; then
        echo "minor"
        return
    fi
    
    # Hotfix, bugfix, fix branches = patch
    if echo "$branch_name" | grep -qiE "^(hotfix|bugfix|fix|patch)"; then
        echo "patch"
        return
    fi
    
    # Release branches - check for version pattern
    if echo "$branch_name" | grep -qiE "^release/"; then
        # Extract any version hints from branch name
        if echo "$branch_name" | grep -qiE "major"; then
            echo "major"
            return
        fi
        echo "minor"
        return
    fi
    
    # Default to patch for main/master and unknown branches
    echo "patch"
}

# =============================================================================
# Increment Version
# =============================================================================

increment_version() {
    local version=$1
    local increment_type=$2
    
    # Parse version components
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)
    local patch=$(echo "$version" | cut -d. -f3)
    
    case $increment_type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            log_error "Unknown increment type: $increment_type"
            exit 1
            ;;
    esac
    
    echo "${major}.${minor}.${patch}"
}

# =============================================================================
# Update Version Files
# =============================================================================

update_version_file() {
    local new_version=$1
    local build_timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local build_id="${BITBUCKET_BUILD_NUMBER:-${CI_BUILD_NUMBER:-local-$(date +%s)}}"
    local environment="${DEPLOY_ENVIRONMENT:-production}"
    
    # Create or update version.json
    cat > "$VERSION_FILE" << EOF
{
  "version": "${new_version}",
  "buildTimestamp": "${build_timestamp}",
  "buildId": "${build_id}",
  "environment": "${environment}"
}
EOF
    
    log_success "Updated $VERSION_FILE with version ${new_version}"
}

update_package_json() {
    local new_version=$1
    
    if [ -f "$PACKAGE_JSON" ]; then
        # Update version in package.json using portable sed approach
        # This works on both Linux and macOS by using a temp file
        local temp_file=$(mktemp)
        sed "s/\"version\": \"[^\"]*\"/\"version\": \"${new_version}\"/" "$PACKAGE_JSON" > "$temp_file"
        mv "$temp_file" "$PACKAGE_JSON"
        log_success "Updated $PACKAGE_JSON with version ${new_version}"
    fi
}

# =============================================================================
# Export Environment Variables for Build
# =============================================================================

export_build_env() {
    local new_version=$1
    local build_timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local build_id="${BITBUCKET_BUILD_NUMBER:-${CI_BUILD_NUMBER:-local-$(date +%s)}}"
    local environment="${DEPLOY_ENVIRONMENT:-production}"
    
    # Export for React build
    echo "REACT_APP_VERSION=${new_version}"
    echo "REACT_APP_BUILD_TIMESTAMP=${build_timestamp}"
    echo "REACT_APP_BUILD_ID=${build_id}"
    echo "REACT_APP_ENVIRONMENT=${environment}"
    
    # Also set them in the current shell
    export REACT_APP_VERSION="${new_version}"
    export REACT_APP_BUILD_TIMESTAMP="${build_timestamp}"
    export REACT_APP_BUILD_ID="${build_id}"
    export REACT_APP_ENVIRONMENT="${environment}"
}

# =============================================================================
# Create Git Tag
# =============================================================================

create_git_tag() {
    local new_version=$1
    local tag_name="v${new_version}"
    
    if [ "${CREATE_GIT_TAG:-false}" = "true" ]; then
        git tag -a "$tag_name" -m "Release ${new_version}"
        log_success "Created git tag: $tag_name"
        
        if [ "${PUSH_GIT_TAG:-false}" = "true" ]; then
            git push origin "$tag_name"
            log_success "Pushed git tag: $tag_name"
        fi
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    log_info "Starting version management..."
    
    # Get current version
    current_version=$(get_current_version)
    log_info "Current version: ${current_version}"
    
    # Determine increment type
    if [ -n "$1" ]; then
        # Use provided increment type
        increment_type="$1"
        log_info "Using provided increment type: ${increment_type}"
    elif [ -n "${VERSION_INCREMENT:-}" ]; then
        # Use pipeline variable
        increment_type="$VERSION_INCREMENT"
        log_info "Using pipeline variable increment type: ${increment_type}"
    else
        # Determine from commits first, then branch
        increment_type=$(determine_increment_from_commits)
        
        # If no clear indication from commits, check branch
        if [ "$increment_type" = "patch" ]; then
            branch_increment=$(determine_increment_from_branch)
            if [ "$branch_increment" != "patch" ]; then
                increment_type="$branch_increment"
            fi
        fi
        
        log_info "Auto-detected increment type: ${increment_type}"
    fi
    
    # Calculate new version
    new_version=$(increment_version "$current_version" "$increment_type")
    log_success "New version: ${new_version}"
    
    # Update files
    update_version_file "$new_version"
    update_package_json "$new_version"
    
    # Export environment variables
    log_info "Exporting build environment variables..."
    export_build_env "$new_version"
    
    # Optionally create git tag
    create_git_tag "$new_version"
    
    # Output for pipeline consumption
    echo ""
    echo "=========================================="
    echo "VERSION_UPDATE_COMPLETE"
    echo "OLD_VERSION=${current_version}"
    echo "NEW_VERSION=${new_version}"
    echo "INCREMENT_TYPE=${increment_type}"
    echo "=========================================="
}

# Run main function
main "$@"
