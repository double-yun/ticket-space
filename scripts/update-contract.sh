#!/bin/bash
set -e

echo "🔄 Updating TicketSBT contract..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Get current contract address from .env.local if it exists
CURRENT_ADDRESS=""
if [[ -f ".env.local" ]]; then
    CURRENT_ADDRESS=$(grep "^CONTRACT_ADDRESS=" .env.local | cut -d'=' -f2)
    if [[ -n "$CURRENT_ADDRESS" ]]; then
        echo -e "${BLUE}📋 Current contract address: $CURRENT_ADDRESS${NC}"
    fi
fi

# Compile contracts
echo "🔨 Compiling contracts..."
docker-compose exec -T anvil sh -c "cd /workspace/contracts && FOUNDRY_DISABLE_NIGHTLY_WARNING=true forge build" > /dev/null 2>&1

# Deploy new contract
echo "📄 Deploying updated TicketSBT contract..."
DEPLOY_OUTPUT=$(docker-compose exec -T anvil sh -c "cd /workspace/contracts && FOUNDRY_DISABLE_NIGHTLY_WARNING=true forge script script/deploy.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast" 2>&1)

# Extract contract address from output
NEW_CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "TicketSBT contract deployed at:" | sed 's/.*TicketSBT contract deployed at: //')

if [[ -z "$NEW_CONTRACT_ADDRESS" ]]; then
    echo -e "${RED}❌ Failed to deploy contract${NC}"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✅ New contract deployed at: $NEW_CONTRACT_ADDRESS${NC}"

# Update .env.local
echo "📝 Updating .env.local with new contract address..."
if [[ -f ".env.local" ]]; then
    # Create backup
    cp .env.local .env.local.bak
    # Update existing CONTRACT_ADDRESS line
    sed -i.tmp "s/^CONTRACT_ADDRESS=.*/CONTRACT_ADDRESS=$NEW_CONTRACT_ADDRESS/" .env.local && rm .env.local.tmp
    echo -e "${GREEN}✅ Updated .env.local (backup saved as .env.local.bak)${NC}"
else
    echo -e "${YELLOW}⚠️  .env.local not found, creating new one...${NC}"
    cat > .env.local << EOF
# Blockchain Settings
ANVIL_RPC_URL=http://localhost:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_ADDRESS=$NEW_CONTRACT_ADDRESS

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-change-this-in-production

# Database
DATABASE_URL="file:/app/db/prisma/dev.db"
EOF
fi

# Update ABI files if they exist
echo "📋 Updating ABI files..."
ABI_SOURCE="/workspace/contracts/out/TicketSBT.sol/TicketSBT.json"
if docker-compose exec -T anvil test -f "$ABI_SOURCE" > /dev/null 2>&1; then
    # Copy ABI to web/lib directory
    docker-compose exec -T anvil sh -c "cd /workspace/contracts && cat out/TicketSBT.sol/TicketSBT.json | jq '.abi' > /workspace/../web/lib/ticket-abi.json" 2>/dev/null || true
    echo -e "${GREEN}✅ ABI files updated${NC}"
fi

# Restart web container to load new environment variables
echo "🔄 Restarting web container..."
docker-compose restart web > /dev/null 2>&1

# Wait for web container to start
echo "⏳ Waiting for web container to start..."
sleep 10

# Test the setup
echo "🧪 Testing API with new contract..."
if curl -s "http://localhost:3000/api/balance?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Contract update successful! API is working${NC}"
    echo ""
    echo "📋 Update Summary:"
    if [[ -n "$CURRENT_ADDRESS" ]]; then
        echo "   Old Address: $CURRENT_ADDRESS"
    fi
    echo "   New Address: $NEW_CONTRACT_ADDRESS"
    echo "   Test Account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    echo ""
    echo "🌐 Test the API:"
    echo "   curl \"http://localhost:3000/api/balance?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266\""
else
    echo -e "${YELLOW}⚠️  Contract deployed but API test failed. Please check manually.${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Contract update completed successfully!${NC}"