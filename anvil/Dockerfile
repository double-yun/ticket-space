FROM ghcr.io/foundry-rs/foundry:latest

WORKDIR /workspace
COPY contracts ./contracts

ENTRYPOINT ["anvil"]
CMD ["--host", "0.0.0.0", "--port", "8545", "--chain-id", "31337"]
