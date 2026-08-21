# ARCHSEAL

**Consensus-gated architecture compliance for GitHub pull requests, powered by GenLayer.**

Every codebase has laws.  
Merge only what obeys them.

- **Live app:** [archseal.xyz](https://archseal.xyz)
- **Network:** GenLayer Bradbury Testnet
- **Chain ID:** `4221` / `0x107D`
- **Contract:** `0x45f2E002B0980ADD2D82E7146F72cC17CFCc2C2b`
- **Open in GenLayer Studio:** [Import contract](https://studio.genlayer.com/?import-contract=0x45f2E002B0980ADD2D82E7146F72cC17CFCc2C2b)

## The problem

Architectural Decision Records define how a software project should be built, but they are usually enforced manually.

Reviewers must compare every pull request against multiple ADR documents. This process is slow, subjective, and difficult to audit. A pull request can also change while it is being reviewed, creating uncertainty about exactly which version received approval.

ARCHSEAL turns architectural governance into a verifiable on-chain workflow.

## What ARCHSEAL does

ARCHSEAL:

1. Reads a public GitHub pull request.
2. Resolves and records its exact base and head commit hashes.
3. Reads the repository’s Architectural Decision Records.
4. Uses independent GenLayer AI validators to evaluate the change.
5. Reaches consensus on whether the pull request follows the documented architecture.
6. Stores the verdict and supporting evidence on-chain.

The contract records the exact commits being reviewed, preventing a verdict from being reused for a later or modified version of the pull request.

## Why GenLayer is essential

This workflow cannot be implemented reliably with a traditional deterministic smart contract because it requires:

- Reading live GitHub repository data.
- Understanding source-code changes.
- Interpreting natural-language architecture documents.
- Comparing implementation details with architectural constraints.
- Producing a reasoned verdict through independent validator consensus.

The frontend does not generate or modify the verdict. GenLayer contract state is the source of truth.

## Verdict output

A completed review can include:

- `COMPLIANT`
- `NON_COMPLIANT`
- `INCONCLUSIVE`
- Compliance score
- Risk level
- Human-readable explanation
- Violated ADR references
- Exact base commit
- Exact head commit
- Repository and pull-request information
- Number of evaluation attempts
- Sponsor and contributor wallets
- Reward and payout status

## Review lifecycle

### 1. Lock evidence

The user submits:

- GitHub pull-request URL
- ADR directory path
- Optional GEN reward
- Contributor wallet

The `open_review` transaction resolves and stores the exact pull-request commits and review parameters.

### 2. Run AI consensus

The `evaluate_review` transaction asks GenLayer validators to independently inspect the pull request and ADR evidence.

Validators reach consensus on a canonical compliance verdict.

### 3. Seal the result

The final verdict, explanation, risk level, score, commit hashes, and evidence are permanently available through the contract.

## Intelligent Contract

The complete contract source is available at:

```text
contracts/ArchSeal.py
```

### Write methods

```python
open_review(
    repo_owner: str,
    repo_name: str,
    pull_request: u256,
    adr_path: str,
    contributor_wallet: str
)
```

Creates a review and locks its GitHub evidence.

```python
evaluate_review(review_id: u256)
```

Runs the GenLayer AI-consensus architecture evaluation.

```python
refund_review(review_id: u256)
```

Refunds an eligible review reward when the review cannot be completed.

### Read methods

```python
get_review(review_id: u256)
get_recent_reviews(limit: u256)
get_stats()
```

## Verified on-chain example

ARCHSEAL evaluated:

[MITLibraries/timdex pull request #978](https://github.com/MITLibraries/timdex/pull/978)

Result: `COMPLIANT`

The contract locked these commits:

```text
Base: e64bf84681700da4a9b66f37db1098d31e653697
Head: 229f9bf0b0c458c7436c5050e064cf7bbaa77f98
```

On-chain transactions:

- [Lock evidence transaction](https://explorer-bradbury.genlayer.com/transactions/0x28b9c1fd0c9b65da12bd00d7c6a56aaf46654aace2222484111254a4c123a826)
- [AI consensus transaction](https://explorer-bradbury.genlayer.com/transactions/0xd16f9a761e677c6c4a9e4ca28848274c49f87f0d591acda76dc51e63452fa57d)

## Frontend transaction handling

The application handles the full GenLayer transaction lifecycle:

- Wallet connection
- Bradbury network detection
- Network switching
- User signature rejection
- Transaction submission
- Consensus progress
- Accepted transactions
- Accepted transactions containing execution errors
- Missing contract returns
- RPC timeouts
- Retry and refund states
- Explorer evidence links
- Reading the final verdict from contract state

A transaction is never displayed as successful only because its consensus status is `ACCEPTED`. The frontend also verifies that contract execution completed successfully.

## Network configuration

```text
Network: GenLayer Bradbury Testnet
Chain ID: 4221
Hex Chain ID: 0x107D
Currency: GEN
RPC: https://rpc-bradbury.genlayer.com
Explorer: https://explorer-bradbury.genlayer.com
Contract: 0x45f2E002B0980ADD2D82E7146F72cC17CFCc2C2b
```

## Run locally

Requirements:

- Node.js 20+
- pnpm
- Browser wallet with GenLayer Bradbury configured
- Bradbury testnet GEN

```bash
git clone https://github.com/zakazaka95/ArchSeal.git
cd ArchSeal
pnpm install
pnpm dev
```

Create a production build:

```bash
pnpm build
```

## Project structure

```text
contracts/
  ArchSeal.py                 Intelligent Contract

src/
  components/archseal/       Main application interface
  lib/genlayer.ts            Contract client and transaction lifecycle
  lib/github.ts              GitHub pull-request parsing
  lib/wallet.ts              Wallet and Bradbury network handling
  routes/                    Application routes

public/                       Branding and application icons
```

## Trust model

ARCHSEAL does not claim that AI review replaces human maintainers.

It provides an independent, reproducible, and auditable architecture-compliance signal tied to:

- A specific repository
- A specific pull request
- Exact commit hashes
- A declared ADR path
- A GenLayer validator-consensus result

Maintainers retain the final decision over whether a pull request should be merged.

## Current scope

ARCHSEAL currently supports:

- Public GitHub repositories
- Pull requests with accessible base and head commits
- Repository-hosted ADR documents
- GenLayer Bradbury Testnet

Private repositories and authenticated GitHub API access are not currently supported.
