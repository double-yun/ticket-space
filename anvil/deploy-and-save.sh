#!/bin/bash

echo "🚀 Deploying Ticket contract..."

# Change to contracts directory
cd /workspace/contracts

# Deploy contract
forge create \
  --rpc-url http://localhost:8545 \
  --unlocked \
  --from 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  src/Ticket.sol:TicketSBT \
  --constructor-args "EventTicket" "TKT" "https://api.example.com/metadata/" \
  --broadcast \
  > ../deploy-output.txt 2>&1

# Get contract address
CONTRACT_ADDRESS=$(grep "Deployed to:" ../deploy-output.txt | cut -d' ' -f3)

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "❌ Deploy failed!"
    cat ../deploy-output.txt
    exit 1
fi

# Show results
echo "✅ Contract deployed!"
echo "📍 Address: $CONTRACT_ADDRESS"

# Save to file (in workspace root)
echo "$CONTRACT_ADDRESS" > ../contract-address.txt
echo "CONTRACT_ADDRESS=$CONTRACT_ADDRESS" > ../.env.contract

echo "💾 Address saved to:"
echo "  - contract-address.txt (just the address)"
echo "  - .env.contract (for environment variables)"