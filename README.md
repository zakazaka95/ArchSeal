# Arch Seal Protocol

Build a production-quality single-page dApp named ARCHSEAL.

ARCHSEAL is a GenLayer-powered architecture compliance system. It reads a public GitHub pull request and a repository’s Architectural Decision Records, locks the exact base and head commit hashes, and uses independent GenLayer AI validators to decide whether the pull request complies with the repository architecture.

Tagline:

Every codebase has laws.
Merge only what obeys them.

Do not use mock contract results, a backend, a database, Supabase, or browser-generated AI verdicts. GenLayer contract state is the only source of truth.

GENLAYER CONFIGURATION

Network: GenLayer Bradbury Testnet
Chain ID: 4221 / 0x107D
Currency: GEN
RPC: https://rpc-bradbury.genlayer.com
Explorer: https://explorer-bradbury.genlayer.com
Contract address:

0x45f2E002B0980ADD2D82E7146F72cC17CFCc2C2b

Use:

npm install genlayer-js

Import:

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

Create a read-only client without an account and a write client using the connected browser wallet:

const readClient = createClient({
chain: testnetBradbury,
});

const writeClient = createClient({
chain: testnetBradbury,
account: address as 0x${string},
provider: window.ethereum,
});

Before a write transaction, call:

await writeClient.connect("testnetBradbury");

Wallet connection must use standard EIP-1193 methods. Never call wallet_getSnaps and do not require MetaMask Snaps.

CONTRACT METHODS

open_review is payable:

open_review(
repo_owner: string,
repo_name: string,
pull_request: bigint,
adr_path: string,
contributor_wallet: string
)

evaluate_review(review_id: bigint)

refund_review(review_id: bigint)

Read methods:

get_review(review_id: bigint)
get_recent_reviews(limit: bigint)
get_stats()

A review contains:

id
repo_owner
repo_name
pull_request
adr_path
base_sha
head_sha
sponsor
contributor_wallet
reward_wei
status
attempts
opened_at
decided_at
payout_scheduled
last_verdict

last_verdict contains:

decision
score
risk_level
summary
violated_adrs
findings
base_sha
head_sha

Each finding contains:

adr
file
finding

USER FLOW

The user connects a browser wallet.

The user pastes a public GitHub PR URL such as:
https://github.com/MITLibraries/timdex/pull/978

Parse owner, repository, and PR number from the URL.

Let the user enter the ADR path, defaulting to docs/adr.

Contributor wallet defaults to the connected wallet but remains editable.

Allow an optional GEN reward. Default is 0 GEN.

Before open_review, read get_stats and determine the expected next review ID as total_reviews + 1.

Submit open_review with the reward converted to wei.

Wait for TransactionStatus.ACCEPTED with up to 200 retries and a 5-second interval.

ACCEPTED alone is not enough. Detect execution errors and show a clear failure state.

After successful execution, poll get_review(expectedReviewId) until the stored review is available.

Show the locked base and head commits.

Display a second explicit button: RUN CONSENSUS REVIEW.

When clicked, call evaluate_review(reviewId).

Wait for ACCEPTED, check execution success, then poll get_review until status becomes COMPLIANT, VIOLATES_ADR, or INCONCLUSIVE.

Never parse text copied from the block explorer. Always read the structured result through get_review.

Provide a direct link to the Bradbury transaction in every transaction state.

The two wallet signatures must be clearly explained:

Signature 1 — Lock Evidence
Signature 2 — Run AI Consensus

STATUS COPY

While opening:

Pinning the repository constitution and exact pull request commits on-chain.

While evaluating:

Independent GenLayer validators are reviewing the pinned code against the accepted architecture. This usually takes a few minutes.

Do not say 5–10 minutes.

VERDICT DISPLAY

COMPLIANT:
Large acid-green seal reading ARCHITECTURE COMPLIANT.

VIOLATES_ADR:
Large red seal reading COVENANT VIOLATED.

INCONCLUSIVE:
Large amber seal reading EVIDENCE INCONCLUSIVE, with Retry and Refund actions when allowed.

Display:

repository and PR number
shortened base and head hashes with copy buttons
compliance score
risk level
summary
violated ADRs
individual findings with ADR and changed file
reward amount
payout status
review ID
sponsor and contributor
Bradbury Explorer link

PUBLIC LIVE PROOF

The app must work without a connected wallet for reading existing reviews.

Add a prominent Live Consensus Proof section preloaded with review ID 1 from the deployed contract. Read it live using get_review(1); do not hardcode its verdict.

It should show the successful public review of MITLibraries/timdex PR #978 and link to this accepted evaluation transaction:

https://explorer-bradbury.genlayer.com/transactions/0xd16f9a761e677c6c4a9e4ca28848274c49f87f0d591acda76dc51e63452fa57d

Also load get_stats and get_recent_reviews(6) on page load.

VISUAL DIRECTION

Create a premium, serious developer-governance product, not a generic crypto dashboard.

Use:

deep obsidian background
warm ivory typography
acid-green compliance accents
amber for pending/inconclusive
restrained red for violations
subtle grid and repository-map background
editorial serif display font paired with a precise monospace font
thin architectural diagram lines
soft glass panels with crisp borders
subtle animations only

Hero layout:

small label: CONSENSUS-GATED SOFTWARE
large headline: Every codebase has laws.
italic second line: Merge only what obeys them.
short explanation
primary GitHub PR input panel
three-stage diagram: PIN EVIDENCE → AI CONSENSUS → ON-CHAIN SEAL

The interface should feel like a combination of a premium security product, an architectural blueprint, and an institutional verification terminal.

Avoid:

purple crypto gradients
cartoon illustrations
oversized glowing blobs
fake terminal text
fake metrics
generic SaaS cards
excessive scrolling
unreadable low-contrast text

RESPONSIVENESS

The complete primary workflow should fit comfortably on a standard laptop screen. Mobile must remain usable. Results may expand below the fold, but the active verdict and essential evidence must remain immediately visible.

ERROR HANDLING

Handle:

missing wallet
wrong network
invalid GitHub PR URL
private or missing repository
missing ADR path
GitHub rate limiting
transaction rejected by wallet
accepted transaction containing an execution error
missing contract return
INCONCLUSIVE verdict
refund failure
RPC timeout

Never show a successful seal when execution failed.

Build the full working interface now. Do not change the contract address, network, chain ID, RPC, method names, or argument order.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://archseal-ai-guard.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d70e53d6-6f37-4e96-965b-5b7e627efab3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
