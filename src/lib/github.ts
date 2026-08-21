export type ParsedPr = {
  owner: string;
  repo: string;
  number: number;
};

export function parsePrUrl(input: string): ParsedPr | null {
  const value = input.trim();
  if (!value) return null;
  const m = value.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)(?:[/?#].*)?$/i,
  );
  if (!m) return null;
  const num = Number(m[3]!);
  if (!Number.isFinite(num) || num <= 0) return null;
  return { owner: m[1]!, repo: m[2]!, number: num };
}

export type PreflightResult =
  | {
      ok: true;
      warning?: string;
      policy?: {
        adrPath: string;
        version: string;
        maintainers: string[];
      };
    }
  | { ok: false; error: string };

/** Best-effort preflight. Contract state remains authoritative. */
export async function preflightGithub(p: ParsedPr): Promise<PreflightResult> {
  try {
    const prRes = await fetch(
      `https://api.github.com/repos/${p.owner}/${p.repo}/pulls/${p.number}`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (prRes.status === 404) {
      return {
        ok: false,
        error:
          "That repository or pull request is private or does not exist. ARCHSEAL can only review public pull requests.",
      };
    }
    if (prRes.status === 403 || prRes.status === 429) {
      return {
        ok: true,
        warning:
          "GitHub rate limit reached, so the pull request could not be pre-checked. Proceeding — the contract will verify it on-chain.",
      };
    }
    if (!prRes.ok) {
      return {
        ok: true,
        warning: `GitHub pre-check unavailable (HTTP ${prRes.status}). Proceeding.`,
      };
    }

    const pr = await prRes.json();
    const baseSha = String(pr?.base?.sha ?? "");
    if (!/^[a-f0-9]{40}$/i.test(baseSha)) {
      return { ok: false, error: "GitHub did not return a valid PR base commit." };
    }

    const policyRes = await fetch(
      `https://raw.githubusercontent.com/${p.owner}/${p.repo}/${baseSha}/.archseal/policy.json`,
      { headers: { Accept: "application/json" } },
    );
    if (policyRes.status === 404) {
      return {
        ok: false,
        error:
          "The PR base commit has no .archseal/policy.json. Add the maintainer policy to the base branch before opening a review.",
      };
    }
    if (!policyRes.ok) {
      return {
        ok: true,
        warning: `Policy pre-check unavailable (HTTP ${policyRes.status}). The contract will verify it on-chain.`,
      };
    }

    const policy = await policyRes.json();
    const expectedRepo = `${p.owner}/${p.repo}`.toLowerCase();
    const adrPath = String(policy?.adr_path ?? "").replace(/^\/+|\/+$/g, "");
    const maintainers = Array.isArray(policy?.maintainers)
      ? policy.maintainers.map(String).filter(Boolean)
      : [];
    if (
      policy?.schema !== "archseal-policy-v1" ||
      String(policy?.repository ?? "").toLowerCase() !== expectedRepo ||
      policy?.require_complete_evidence !== true ||
      !adrPath ||
      maintainers.length === 0
    ) {
      return {
        ok: false,
        error:
          "The repository policy is invalid. Check its schema, repository, ADR path, maintainers and complete-evidence requirement.",
      };
    }

    const adrRes = await fetch(
      `https://api.github.com/repos/${p.owner}/${p.repo}/contents/${adrPath}?ref=${baseSha}`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (adrRes.status === 404) {
      return {
        ok: false,
        error: `The policy ADR path "${adrPath}" does not exist at the pinned base commit.`,
      };
    }
    return {
      ok: true,
      policy: {
        adrPath,
        version: String(policy?.policy_version ?? ""),
        maintainers,
      },
    };
  } catch {
    return {
      ok: true,
      warning: "GitHub could not be reached for pre-checks. Proceeding.",
    };
  }
}
