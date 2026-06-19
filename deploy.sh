#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# RioPoly — Unified Deployment Helper
# Builds the 3D Studio React app and places its output
# inside the RioPoly marketing site folder so both
# can be deployed together from a single directory.
# ─────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STUDIO_DIR="$(cd "$SCRIPT_DIR/../3D Model House Painting" && pwd)"
DEST_DIR="$SCRIPT_DIR/color-studio"

# ── Locate npm via nvm or common install paths ──────────
find_npm() {
    # 1. Already on PATH
    if command -v npm &>/dev/null; then
        echo "$(command -v npm)"
        return
    fi

    # 2. nvm — pick the highest version available
    local NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ -d "$NVM_DIR/versions/node" ]; then
        local LATEST
        LATEST=$(ls -v "$NVM_DIR/versions/node" | tail -1)
        if [ -n "$LATEST" ] && [ -f "$NVM_DIR/versions/node/$LATEST/bin/npm" ]; then
            echo "$NVM_DIR/versions/node/$LATEST/bin/npm"
            return
        fi
    fi

    # 3. Homebrew (Apple Silicon / Intel)
    for p in /opt/homebrew/bin/npm /usr/local/bin/npm; do
        [ -f "$p" ] && echo "$p" && return
    done

    echo ""
}

NPM="$(find_npm)"

if [ -z "$NPM" ]; then
    echo ""
    echo "✗ ERROR: npm not found."
    echo "  Please install Node.js (https://nodejs.org) or run:"
    echo "  nvm install --lts && nvm use --lts"
    echo ""
    exit 1
fi

# Add the directory containing npm to PATH so vite/tsc can also be found
export PATH="$(dirname "$NPM"):$PATH"

echo "  Using npm: $NPM  ($("$NPM" --version))"

echo ""
echo "────────────────────────────────────────"
echo "  RioPoly · Build & Assemble"
echo "────────────────────────────────────────"

# 1. Build the React Color Studio app
echo ""
echo "► Building RioPoly 3D Studio…"
cd "$STUDIO_DIR"
NODE_ENV=production "$NPM" run build

# 2. Clear previous studio build in marketing site
echo ""
echo "► Copying build to marketing site…"
rm -rf "$DEST_DIR"
cp -r "$STUDIO_DIR/dist" "$DEST_DIR"

echo ""
echo "✓ Build complete!"
echo ""
echo "  Deployment folder:  $SCRIPT_DIR"
echo "  Marketing site:     /  (index.html, styles.css, etc.)"
echo "  Color Studio:       /color-studio/"
echo ""
echo "  Deploy the folder above to Vercel / any static host."
echo "  See vercel.json for routing configuration."
echo "────────────────────────────────────────"
