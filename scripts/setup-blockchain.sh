#!/bin/bash
set -e

echo "🚀 Setting up blockchain environment..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Anvil is running
echo "📡 Checking Anvil connection..."
if curl -s -X POST -H "Content-Type: application/json" \
   --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
   http://localhost:8545 > /dev/null; then
    echo -e "${GREEN}✅ Anvil is running${NC}"
else
    echo -e "${RED}❌ Anvil is not running. Please start with: docker-compose up -d anvil${NC}"
    exit 1
fi

# Deploy contract
echo "📄 Deploying TicketSBT contract..."
DEPLOY_OUTPUT=$(docker-compose exec -T anvil sh -c "cd /workspace/contracts && FOUNDRY_DISABLE_NIGHTLY_WARNING=true forge script script/deploy.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast" 2>&1)

# Extract contract address from output
CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "TicketSBT contract deployed at:" | sed 's/.*TicketSBT contract deployed at: //')

if [[ -z "$CONTRACT_ADDRESS" ]]; then
    echo -e "${RED}❌ Failed to deploy contract${NC}"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✅ Contract deployed at: $CONTRACT_ADDRESS${NC}"

# Update .env.local
echo "📝 Updating .env.local with new contract address..."
if [[ -f ".env.local" ]]; then
    # Update existing CONTRACT_ADDRESS line
    sed -i.bak "s/^CONTRACT_ADDRESS=.*/CONTRACT_ADDRESS=$CONTRACT_ADDRESS/" .env.local
    echo -e "${GREEN}✅ Updated .env.local${NC}"
else
    echo -e "${YELLOW}⚠️  .env.local not found, creating new one...${NC}"
    cat > .env.local << EOF
# Blockchain Settings
ANVIL_RPC_URL=http://localhost:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_ADDRESS=$CONTRACT_ADDRESS

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-change-this-in-production

# Database
DATABASE_URL="file:/app/db/prisma/dev.db"
EOF
fi

# Restart web container to load new environment variables
echo "🔄 Restarting web container..."
docker-compose restart web > /dev/null 2>&1

# Wait for web container to start
echo "⏳ Waiting for web container to start..."
sleep 10

# Test the setup
echo "🧪 Testing API connection..."
if curl -s "http://localhost:3000/api/balance?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Setup complete! API is working${NC}"
    echo ""
    echo "📋 Summary:"
    echo "   Contract Address: $CONTRACT_ADDRESS"
    echo "   Test Account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    echo "   RPC URL: http://localhost:8545"
    echo ""
    echo "🌐 Test the API:"
    echo "   curl \"http://localhost:3000/api/balance?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266\""
else
    echo -e "${YELLOW}⚠️  Setup complete but API test failed. Please check manually.${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Blockchain setup completed successfully!${NC}"