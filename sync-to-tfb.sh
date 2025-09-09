#!/bin/bash
set -e

echo "🔄 Syncing ToolFlowBuilder to TFB (history-free)..."

# Create a temporary directory for the clean copy
TMP_DIR=$(mktemp -d)
echo "📁 Using temporary directory: $TMP_DIR"

# Copy all files to temp directory, excluding .git
echo "📋 Copying files..."
rsync -av --exclude='.git' . "$TMP_DIR/"

# Initialize fresh git repo in temp directory
cd "$TMP_DIR"
git init
git branch -M main
git remote add origin https://github.com/PahliAi/TFB.git

# Stage all files (gitignore will be respected)
echo "📦 Staging files..."
git add .

# Check if there's anything to commit
if git diff --cached --quiet; then
    echo "⚠️  No changes to commit"
    cd - > /dev/null
    rm -rf "$TMP_DIR"
    exit 0
fi

# Create initial commit
echo "💾 Creating commit..."
git commit -m "Latest version from ToolFlowBuilder

🤖 Generated with Claude Code"

# Force push to tfb (this replaces all history)
echo "🚀 Force pushing to TFB..."
git push -f origin main

# Clean up
cd - > /dev/null
rm -rf "$TMP_DIR"

echo "✅ Successfully synced to TFB repository!"
echo "🌍 Check: https://github.com/PahliAi/TFB"