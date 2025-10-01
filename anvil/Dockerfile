FROM ghcr.io/foundry-rs/foundry:latest

WORKDIR /workspace
COPY contracts ./contracts
COPY deploy-and-save.sh ./deploy-and-save.sh
COPY entrypoint.sh ./entrypoint.sh

# RUN chmod +x ./deploy-and-save.sh ./entrypoint.sh

ENTRYPOINT ["/workspace/entrypoint.sh"]
CMD ["--host", "0.0.0.0", "--port", "8545", "--chain-id", "31337"]
