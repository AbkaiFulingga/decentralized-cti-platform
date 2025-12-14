#!/bin/bash

# Fix duplicate page warning in Next.js
# Run this on server to remove duplicate visualization page files

echo "🔧 Fixing duplicate page warning..."
echo ""

cd ~/blockchain-dev/cti-frontend

# Remove duplicate .js file (keep .jsx)
if [ -f "app/visualization/page.js" ]; then
    echo "Removing duplicate: app/visualization/page.js"
    rm app/visualization/page.js
    echo "✅ Removed"
else
    echo "ℹ️  app/visualization/page.js not found"
fi

echo ""
echo "✅ Fix applied!"
echo ""
echo "Now restart the website:"
echo "  cd ~/blockchain-dev/cti-frontend"
echo "  npm run dev"
