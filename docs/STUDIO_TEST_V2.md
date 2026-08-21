# ArchSeal V2 — Studio test order

V2 keeps the accepted ArchSeal workflow but makes repository governance and evidence completeness enforceable in contract code.

## 1. Prepare the base branch

Before opening the test PR, the repository base branch must contain `.archseal/policy.json`:

```json
{
  "schema": "archseal-policy-v1",
  "policy_version": "1.0.0",
  "repository": "OWNER/REPOSITORY",
  "adr_path": "docs/adr",
  "maintainers": ["OWNER"],
  "require_complete_evidence": true
}
```

Replace `OWNER/REPOSITORY` and `OWNER` with the real public GitHub repository and maintainer. The declared ADR path must already contain readable Markdown ADRs on the base branch.

The policy is intentionally read from the pinned PR base commit. Adding or weakening it only inside the PR head does not change the policy used for that review.

## 2. Deploy V2

Create a new contract in GenLayer Studio, paste `contracts/ArchSealV2.py`, and deploy a new instance. Do not replace the accepted V1 deployment.

## 3. Open a zero-value review

Call `open_review`:

```text
repo_owner: OWNER
repo_name: REPOSITORY
pull_request: OPEN_PR_NUMBER
contributor_wallet: YOUR_WALLET
Value (GEN): 0
```

There is no user-supplied ADR path in V2.

Expected return:

- `status` is `OPEN`;
- `id` is a 64-character transaction-context fingerprint, not `total_reviews + 1`;
- `policy_path` is `.archseal/policy.json`;
- `policy_hash` is a 64-character SHA-256 value;
- `adr_path` matches the repository policy;
- `base_sha` and `head_sha` are different 40-character commit hashes.

## 4. Evaluate

Copy the returned string `id` and call:

```text
evaluate_review(review_id)
```

Expected result is `COMPLIANT`, `VIOLATES_ADR`, or `INCONCLUSIVE`. A final result must contain a 64-character `seal_hash` binding the transaction-derived review ID, policy hash, base commit, head commit, and verdict.

## 5. Verify state and lookup

Call:

```text
get_review(review_id)
get_latest_review(YOUR_WALLET)
get_recent_reviews(5)
get_stats()
```

All returned copies of the review must have the same ID, policy hash, commit hashes, verdict, and seal hash.

## 6. Verify policy enforcement

Try a repository without `.archseal/policy.json`, or with `require_complete_evidence` set to `false`.

Expected: `open_review` fails before a review is stored.

## 7. Verify forced incompleteness

Use a test PR with more than 24 changed files, a patch larger than the contract limit, or an unavailable binary patch.

Expected: `evaluate_review` deterministically returns `INCONCLUSIVE`, `evidence_complete` is `false`, `incomplete_reasons` explains the exact limit, and the LLM is not permitted to produce a compliance seal.
