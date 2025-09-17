#!/bin/bash

echo "Setting up contracts..."

# Wait for Anvil to be ready
echo "Waiting for Anvil to be ready..."
while ! curl -s http://localhost:8545 > /dev/null; do
  sleep 1
done

echo "Anvil is ready!"

# Deploy contracts
echo "Deploying contracts..."
docker-compose exec anvil /workspace/deploy-and-save.sh

# Read the deployed address
if [ -f "./anvil/deployments.env" ]; then
  source ./anvil/deployments.env
  echo "CONTRACT_ADDRESS=$CONTRACT_ADDRESS" >> .env.local
  echo "Contract address updated in .env.local: $CONTRACT_ADDRESS"
else
  echo "Failed to find deployments.env file"
  exit 1
fi

echo "Contract setup complete!"