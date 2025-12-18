#!/bin/bash
# Test if encryption toggle appears on submit page

echo "🔍 Testing encryption toggle visibility..."
echo ""

# Fetch the submit page
RESPONSE=$(curl -s http://192.168.1.11:3000/submit)

# Check for encryption-related text
if echo "$RESPONSE" | grep -q "Client-Side Encryption"; then
    echo "✅ FOUND: 'Client-Side Encryption' text"
else
    echo "❌ NOT FOUND: 'Client-Side Encryption' text"
fi

if echo "$RESPONSE" | grep -q "AES-256-GCM"; then
    echo "✅ FOUND: 'AES-256-GCM' algorithm mention"
else
    echo "❌ NOT FOUND: 'AES-256-GCM' mention"
fi

if echo "$RESPONSE" | grep -q "encryptionEnabled"; then
    echo "✅ FOUND: 'encryptionEnabled' state variable (JS code loaded)"
else
    echo "❌ NOT FOUND: 'encryptionEnabled' state (toggle not in build)"
fi

echo ""
echo "📋 Page size: $(echo "$RESPONSE" | wc -c) bytes"
echo "🔗 Visit: http://192.168.1.11:3000/submit"
echo ""
echo "👀 If you don't see the toggle in your browser:"
echo "   1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)"
echo "   2. Clear browser cache"
echo "   3. Try incognito mode"
