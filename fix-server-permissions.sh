#!/bin/bash
# Fix Git permissions on server
# Run this script ON THE SERVER (192.168.1.11)

echo "🔧 Fixing Git permissions for blockchain-dev directory..."

# Change to project directory
cd ~/blockchain-dev || cd ~/decentralized-cti-platform || cd ~/decentralized-cti-platform-2 || {
    echo "❌ Error: Project directory not found"
    echo "Available directories:"
    ls -la ~/
    exit 1
}

PROJECT_DIR=$(pwd)
echo "📁 Working in: $PROJECT_DIR"

# Fix ownership of .git directory
echo "🔐 Fixing .git directory ownership..."
sudo chown -R $USER:$USER .git/

# Fix permissions on .git/objects
echo "📝 Fixing .git/objects permissions..."
sudo chmod -R u+rwX .git/objects/

# Fix permissions on entire .git directory
echo "🔑 Fixing entire .git directory permissions..."
sudo chmod -R u+rwX .git/

# Check current user
echo "👤 Current user: $(whoami)"
echo "📊 Git directory ownership:"
ls -la .git/ | head -20

# Try git pull again
echo ""
echo "🔄 Attempting git pull..."
git pull

if [ $? -eq 0 ]; then
    echo "✅ Git pull successful!"
    echo ""
    echo "📦 Installing dependencies..."
    npm install
    
    echo ""
    echo "🔨 Compiling contracts..."
    npx hardhat compile
    
    echo ""
    echo "🚀 Ready to deploy!"
    echo ""
    echo "Run this command to deploy contracts:"
    echo "npx hardhat run scripts/deployComplete.js --network sepolia"
else
    echo "❌ Git pull still failing. Manual intervention needed."
    echo ""
    echo "Try these commands manually:"
    echo "  sudo chown -R sc:sc $PROJECT_DIR"
    echo "  sudo chmod -R 755 $PROJECT_DIR"
    echo "  git config --global --add safe.directory $PROJECT_DIR"
fi
