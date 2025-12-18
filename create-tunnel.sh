#!/bin/bash
# SSH Tunnel Script - Access server via localhost to enable Web Crypto API

echo "🔐 Creating SSH tunnel to enable Web Crypto API..."
echo ""
echo "Web Crypto API requires HTTPS or localhost!"
echo "This creates a tunnel: http://localhost:3000 → 192.168.1.11:3000"
echo ""
echo "After running this:"
echo "  1. Visit: http://localhost:3000/submit"
echo "  2. Web Crypto API will work!"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

ssh -L 3000:localhost:3000 sc@192.168.1.11 -N
