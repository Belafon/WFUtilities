#!/bin/bash

# Script to update version and publish to npm
# Usage: ./scripts/publish.sh [major|minor|patch]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Get version type (default to patch if not specified)
VERSION_TYPE=${1:-patch}

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(major|minor|patch)$ ]]; then
    print_error "Invalid version type: $VERSION_TYPE"
    print_error "Usage: $0 [major|minor|patch]"
    exit 1
fi

print_status "Starting publish process with version bump: $VERSION_TYPE"

# Check if git working directory is clean
if ! git diff-index --quiet HEAD --; then
    print_warning "Git working directory is not clean. Uncommitted changes detected."
    read -p "Do you want to continue? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Publish cancelled."
        exit 1
    fi
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Run tests before publishing
print_status "Running tests..."
if ! npm test; then
    print_error "Tests failed. Please fix the tests before publishing."
    exit 1
fi

# Build the project
print_status "Building project..."
if ! npm run build; then
    print_error "Build failed. Please fix the build errors before publishing."
    exit 1
fi

# Update version using npm version (this also creates a git tag)
print_status "Updating version ($VERSION_TYPE)..."
NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version)
print_status "New version: $NEW_VERSION"

# Update package.json with new version
git add package.json

# Create git commit and tag
git commit -m "chore: bump version to $NEW_VERSION"
git tag "$NEW_VERSION"

print_status "Created git commit and tag for version $NEW_VERSION"

# Publish to npm
print_status "Publishing to npm..."
if npm publish; then
    print_status "Successfully published $NEW_VERSION to npm!"
    
    # Push git changes and tags
    print_status "Pushing git changes and tags..."
    git push origin --tags
    
    print_status "🎉 Publish complete!"
    print_status "Version $NEW_VERSION has been published and git changes have been pushed."
    
    # Update the package in WorldsFactorySupport project
    print_status "Updating wfnodeserver in WorldsFactorySupport project..."
    VSCODE_EXTENSION_PATH="$HOME/Documents/projects/WorldsFactoryVscodeExtension/WorldsFactorySupport"
    
    if [ -d "$VSCODE_EXTENSION_PATH" ]; then
        cd "$VSCODE_EXTENSION_PATH"
        if npm update wfnodeserver; then
            print_status "Successfully upgraded wfnodeserver in WorldsFactorySupport project!"
        else
            print_warning "Failed to upgrade wfnodeserver in WorldsFactorySupport project."
            print_warning "You may need to manually run: cd $VSCODE_EXTENSION_PATH && npm update wfnodeserver"
        fi
    else
        print_warning "WorldsFactorySupport project not found at: $VSCODE_EXTENSION_PATH"
        print_warning "You may need to manually upgrade wfnodeserver in your extension project."
    fi
else
    print_error "npm publish failed."
    print_warning "Rolling back version change..."
    
    # Reset the version change
    git reset --hard HEAD~1
    git tag -d "$NEW_VERSION"
    
    print_error "Version change has been rolled back."
    exit 1
fi