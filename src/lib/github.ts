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
  const num = Number(m[3]);
  if (!Number.isFinite(num) || num <= 0) return null;
  return { owner: m[1], repo: m[2], number: num };
}

export type PreflightResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

/** Best-effort public GitHub preflight: repo visibility, PR and ADR path. */
export async function preflightGithub(
  p: ParsedPr,
  adrPath: string,
): Promise<PreflightResult> {
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

    const path = adrPath.trim().replace(/^\/+|\/+$/g, "");
    if (!path) {
      return { ok: false, error: "Enter the ADR path inside the repository." };
    }
    const adrRes = await fetch(
      `https://api.github.com/repos/${p.owner}/${p.repo}/contents/${path}`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (adrRes.status === 404) {
      return {
        ok: false,
        error: `No architectural decision records found at "${path}" in ${p.owner}/${p.repo}.`,
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: true,
      warning: "GitHub could not be reached for pre-checks. Proceeding.",
    };
  }
}
