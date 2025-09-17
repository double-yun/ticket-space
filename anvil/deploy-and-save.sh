#!/bin/bash

# Deploy contract and save address
echo "Deploying Ticket contract..."
DEPLOY_OUTPUT=$(forge create --broadcast --unlocked --from 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 /workspace/contracts/src/Ticket.sol:Ticket 2>&1)

# Extract contract address
CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Deployed to:" | awk '{print $3}')

if [ -n "$CONTRACT_ADDRESS" ]; then
    echo "Contract deployed to: $CONTRACT_ADDRESS"

    # Save to deployments file
    echo "CONTRACT_ADDRESS=$CONTRACT_ADDRESS" > /workspace/deployments.env
    echo "DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> /workspace/deployments.env

    echo "Contract address saved to deployments.env"
else
    echo "Failed to extract contract address"
    exit 1
fi