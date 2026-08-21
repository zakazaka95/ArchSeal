# ArchSeal

ArchSeal is a GenLayer dApp that turns a public GitHub pull request into an auditable, on-chain architecture-compliance seal.

It pins the pull request's exact base and head commits, reads repository-approved governance from the pinned base commit, gathers the declared Architectural Decision Records (ADRs) and changed code, and lets independent GenLayer AI validators decide whether the change is `COMPLIANT`, `VIOLATES_ADR`, or `INCONCLUSIVE`.

- Live app: [archseal.xyz](https://archseal.xyz)
- Accepted V1 contract: [`0x45f2E002B0980ADD2D82E7146F72cC17CFCc2C2b`](https://explorer-bradbury.genlayer.com/address/0x45f2E002B0980ADD2D82E7146F72cC17CFCc2C2b)
- Network: GenLayer Bradbury Testnet, chain `4221` (`0x107D`)

## Why it exists

Architecture rules are usually checked manually. A pull request can change after a review, contributors can point a checker at a convenient subset of ADRs, and a green result can hide missing or truncated evidence.

ArchSeal makes the evidence and decision reproducible:

- the reviewed base and head commits are immutable;
- ADR scope comes from maintainer-approved repository policy, never form input;
- incomplete evidence can never produce a compliance seal;
- the review identity is derived from the GenLayer transaction context rather than a predicted shared counter;
- the final seal binds the review ID, policy, commits, and consensus verdict;
- contract state is the only source of truth—there is no backend, database, browser LLM, or mocked verdict.

## V2 governance and completeness

V2 directly addresses the review feedback received after the original project was accepted.

### Maintainer-approved ADR scope

Every protected repository commits `.archseal/policy.json` on its base branch:

```json
{
  "schema": "archseal-policy-v1",
  "policy_version": "1.0.0",
  "repository": "zakazaka95/ArchSeal",
  "adr_path": "docs/adr",
  "maintainers": ["zakazaka95"],
  "require_complete_evidence": true
}
```

The contract reads this policy from the pull request's pinned base commit. A pull request cannot change its own review scope, weaken completeness requirements, or select a different ADR directory through the UI.

### Fail-closed evidence handling

The contract records exact incompleteness reasons and deterministically returns `INCONCLUSIVE` before invoking the LLM when:

- the ADR directory is missing, empty, or exceeds its cap;
- an ADR document is unavailable or truncated;
- the changed-file list is missing or exceeds its cap;
- a changed file has no reviewable patch;
- an individual patch or the total diff exceeds the declared limits.

The result exposes `evidence_complete` and `incomplete_reasons` on-chain.

### Transaction-context review IDs

GenVM does not expose an outer transaction hash to contract code. V2 therefore derives a 64-character SHA-256 review ID from the available transaction context (chain, contract, origin, sender, deterministic transaction timestamp) plus the repository, PR, commits, and policy hash. `total_reviews` remains a statistic only and is never used to predict or allocate an ID.

## Contract flow

1. `open_review(repo_owner, repo_name, pull_request, contributor_wallet)`
   - fetches the public GitHub PR;
   - pins base/head commit hashes;
   - reads and validates `.archseal/policy.json` from the base commit;
   - stores an `OPEN` review under its transaction-derived string ID.
2. `evaluate_review(review_id)`
   - reloads the pinned policy and evidence;
   - forces `INCONCLUSIVE` if any required evidence is incomplete;
   - otherwise asks independent validators to evaluate the change;
   - stores the verdict and final `seal_hash`.
3. `refund_review(review_id)` refunds an eligible inconclusive reward.

Read methods:

```text
get_review(review_id: string)
get_latest_review(sponsor: address)
get_recent_reviews(limit: u256)
get_stats()
```

The V2 source is [`contracts/ArchSealV2.py`](contracts/ArchSealV2.py). The accepted V1 deployment remains linked above as public on-chain evidence.

## Repository layout

```text
.archseal/policy.json          Repository-owned ArchSeal policy
contracts/ArchSealV2.py       GenLayer Intelligent Contract
docs/adr/                     Architectural Decision Records
docs/STUDIO_TEST_V2.md        Studio deployment and verification script
src/                          React frontend
tests/test_archseal_v2.py     Deterministic contract tests
```

## Run the frontend

```bash
pnpm install
pnpm dev
```

Before publishing V2, set `CONTRACT_ADDRESS` in `src/lib/genlayer.ts` to the newly deployed V2 instance and replace the proof review/transaction links with accepted V2 evidence.

## Verification

```bash
python -m unittest discover -s tests -p "test_*.py"
pnpm build
```

The tests cover policy-controlled scope, transaction-context IDs, complete-evidence consensus, and deterministic inconclusive results for truncated evidence.

## Evidence

- [Live dApp](https://archseal.xyz)
- [GitHub source](https://github.com/zakazaka95/ArchSeal)
- [Accepted V1 Studio import](https://studio.genlayer.com/?import-contract=0x45f2E002B0980ADD2D82E7146F72cC17CFCc2C2b)
- [Demo video](https://youtu.be/z3wcJ8s4gFY)

## License

MIT
