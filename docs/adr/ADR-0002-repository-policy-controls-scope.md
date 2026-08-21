# ADR-0002: Repository policy controls review scope

Status: Accepted

The ADR scope used for an architecture review must come from `.archseal/policy.json` at the pull request's pinned base commit. A user-supplied path must not override repository governance.

The policy hash, base commit, head commit, and consensus verdict must be bound into the final on-chain seal. If any ADR, changed-file list, or patch is missing or truncated, the result must be `INCONCLUSIVE`.
