# Web3 Lottery Ticketing Justification

## Why a Lottery Matters for Ticketing

- **Oversubscribed inventory**: Premium events regularly attract more buyers than available seats. A lottery smooths demand spikes while preventing fastest-finger wins or bot abuse.
- **Fairness expectations**: Fans increasingly expect provably fair allocation. A transparent raffle reassures them that scarcity was handled honestly.
- **Operational simplicity**: Rather than racing to throttle traffic or manage waitlists, organizers can run batched lottery rounds, making fulfillment predictable.

## Trust Gap in Traditional Lotteries

- **Opaque randomness**: Centralized systems rely on private RNG services; users cannot independently verify draws.
- **Mutable logs**: Participation records and results live in private databases, creating grounds for dispute (“was my entry counted?”).
- **Manual reconciliation**: After winners are chosen, operators still have to notify winners, collect payment, and issue tickets—each step introduces friction/error.
- **Audit burden**: Sponsors and regulators demand evidence that allocations were not manipulated. Traditional solutions require costly external audits.

## How Web3 Closes the Gap

### 1. Verifiable Randomness

- Use on-chain randomness sources (e.g., Chainlink VRF, blockhash commitments) to derive winner sets.
- Every participant can audit the randomness proof, guaranteeing that neither organizers nor validators could bias the outcome after entries close.

### 2. Immutable Participation Ledger

- Entries are recorded as on-chain events (or commitments) tied to wallet addresses.
- Participants can independently verify that their entry hash exists before the draw.
- Disputes reduce to cryptographic proof rather than screenshots or customer support logs.

### 3. Automatic Settlement & Ticket Issuance

- Smart contracts escrow deposits or payment authorizations alongside entries.
- When the draw completes, contracts automatically:
  - mark winners,
  - trigger payment capture (or unlock escrow),
  - mint non-transferable tickets (SBTs) directly to winner wallets.
- Reduces settlement latency from days to minutes and eliminates manual syncing across systems.

### 4. Programmable Secondary Rules

- Soulbound ticket tokens enforce non-transferability or controlled resale without extra databases.
- Contracts can encode refund policies (auto-refund non-winners) or loyalty perks (priority multipliers) transparently.

### 5. Public Audit Trail

- Organizers, sponsors, and regulators get a tamper-evident record of how many tickets existed, who entered, and who won.
- Fans can validate fairness independently, boosting brand trust and reducing PR risk.

## Suggested Architecture

| Layer | Responsibility | Notes |
| --- | --- | --- |
| Frontend | Collect intents, show status | Wallet or custodial flows allowed. |
| Off-chain services | Identity checks, payment tokenization | Integrates with PG for pre-authorization. |
| Smart contracts | Entry registry, randomness request, settlement | Exposes proofs and emits events for each phase. |
| Storage/indexing | Subgraph / DB mirrors | Powers analytics, notifications.

**Flow Overview**
1. User authenticates via custodial wallet (Kakao login → derived wallet) or external wallet.
2. User submits entry with deposit/authorization; contract logs entry and locks funds.
3. Lottery window closes; contract requests randomness; once the proof arrives, winners are chosen on-chain.
4. Contract charges winners, refunds others, and mints soulbound tickets.
5. Frontend queries events to update UI; organizers can export on-chain data for compliance.

## Trade-offs & Mitigations

- **Gas costs**: Batch entries using merkle commitments or layer-2 rollups to keep per-entry fees manageable.
- **Latency**: Randomness proofs introduce delay (tens of seconds). Schedule draws at predictable intervals and communicate windows to users.
- **UX friction**: Custodial smart wallets with sponsored gas (e.g., Alchemy AA) can hide raw on-chain complexity from end users.
- **Privacy**: Storing KYC data off-chain while anchoring hashed commitments on-chain balances compliance and transparency.

## Why It Strengthens the Graduation Project

- Demonstrates a full-stack system where **fairness, transparency, and automation** are inseparable, highlighting the unique value of Web3 beyond simple NFTs.
- Differentiates from Web2 ticket queues by providing cryptographic evidence that the organizer cannot rig draws.
- Opens follow-up research topics: gas-efficient batching, verifiable user weighting, hybrid custody models.
- Aligns with real industry pain points (botting, PR crises around unfair sales) and shows how blockchain provides a measurable improvement.

## Next Steps

- Prototype the on-chain lottery contract (entry registry + randomness hook + settlement logic).
- Integrate with existing Next API to handle entry submission and event listening.
- Prepare analytics dashboards or public explorers to showcase auditability.
- Document edge cases (refunds, no-shows) to prove operational maturity.

By articulating these touchpoints, the project clearly communicates why lottery-based ticket allocation is more credible and robust when backed by verifiable Web3 primitives.
