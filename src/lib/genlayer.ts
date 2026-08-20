// GenLayer Bradbury client helpers. All imports are dynamic so nothing
// browser-only is evaluated during SSR.

export const CONTRACT_ADDRESS =
  "0x45f2E002B0980ADD2D82E7146F72cC17CFCc2C2b" as `0x${string}`;
export const CHAIN_ID = 4221;
export const CHAIN_ID_HEX = "0x107D";
export const RPC_URL = "https://rpc-bradbury.genlayer.com";
export const EXPLORER_URL = "https://explorer-bradbury.genlayer.com";

export const txLink = (hash: string) => `${EXPLORER_URL}/transactions/${hash}`;
export const addressLink = (addr: string) => `${EXPLORER_URL}/address/${addr}`;

export type Finding = { adr: string; file: string; finding: string };

export type Verdict = {
  decision: string;
  score: number | null;
  risk_level: string;
  summary: string;
  violated_adrs: string[];
  findings: Finding[];
  base_sha: string;
  head_sha: string;
} | null;

export type Review = {
  id: number;
  repo_owner: string;
  repo_name: string;
  pull_request: number;
  adr_path: string;
  base_sha: string;
  head_sha: string;
  sponsor: string;
  contributor_wallet: string;
  reward_wei: string;
  status: string;
  attempts: number;
  opened_at: number | string;
  decided_at: number | string;
  payout_scheduled: boolean;
  last_verdict: Verdict;
};

export type Stats = Record<string, unknown> & { total_reviews?: number };

/* -------------------------------------------------------------- clients */

let readClientPromise: Promise<any> | null = null;

async function getReadClient() {
  if (!readClientPromise) {
    readClientPromise = (async () => {
      const { createClient } = await import("genlayer-js");
      const { testnetBradbury } = await import("genlayer-js/chains");
      return createClient({ chain: testnetBradbury as any });
    })();
  }
  return readClientPromise;
}

export async function getWriteClient(address: string) {
  const { createClient } = await import("genlayer-js");
  const { testnetBradbury } = await import("genlayer-js/chains");
  const ethereum = (globalThis as any).window?.ethereum;
  if (!ethereum) throw new Error("NO_WALLET");
  const client = createClient({
    chain: testnetBradbury as any,
    account: address as `0x${string}`,
    provider: ethereum,
  });
  await client.connect("testnetBradbury");
  return client;
}

/* ------------------------------------------------------------ normalize */

const num = (v: unknown): number => {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))
    return Number(v);
  return 0;
};

const str = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);

const pick = (o: any, k: string) =>
  o && typeof o === "object" ? (o[k] ?? o.get?.(k)) : undefined;

function normalizeVerdict(raw: any): Verdict {
  if (!raw || typeof raw !== "object") return null;
  const decision = str(pick(raw, "decision"));
  if (!decision) return null;
  const findingsRaw = pick(raw, "findings");
  const findings: Finding[] = Array.isArray(findingsRaw)
    ? findingsRaw.map((f: any) => ({
        adr: str(pick(f, "adr")),
        file: str(pick(f, "file")),
        finding: str(pick(f, "finding")),
      }))
    : [];
  const violated = pick(raw, "violated_adrs");
  const scoreRaw = pick(raw, "score");
  return {
    decision,
    score:
      scoreRaw === null || scoreRaw === undefined || scoreRaw === ""
        ? null
        : num(scoreRaw),
    risk_level: str(pick(raw, "risk_level")),
    summary: str(pick(raw, "summary")),
    violated_adrs: Array.isArray(violated) ? violated.map(str) : [],
    findings,
    base_sha: str(pick(raw, "base_sha")),
    head_sha: str(pick(raw, "head_sha")),
  };
}

export function normalizeReview(raw: any): Review | null {
  if (!raw || typeof raw !== "object") return null;
  const id = pick(raw, "id");
  if (id === undefined || id === null) return null;
  return {
    id: num(id),
    repo_owner: str(pick(raw, "repo_owner")),
    repo_name: str(pick(raw, "repo_name")),
    pull_request: num(pick(raw, "pull_request")),
    adr_path: str(pick(raw, "adr_path")),
    base_sha: str(pick(raw, "base_sha")),
    head_sha: str(pick(raw, "head_sha")),
    sponsor: str(pick(raw, "sponsor")),
    contributor_wallet: str(pick(raw, "contributor_wallet")),
    reward_wei: str(pick(raw, "reward_wei") ?? "0"),
    status: str(pick(raw, "status")),
    attempts: num(pick(raw, "attempts")),
    opened_at: str(pick(raw, "opened_at")),
    decided_at: str(pick(raw, "decided_at")),
    payout_scheduled: Boolean(pick(raw, "payout_scheduled")),
    last_verdict: normalizeVerdict(pick(raw, "last_verdict")),
  };
}

/* ---------------------------------------------------------------- reads */

async function read(functionName: string, args: unknown[]) {
  const client = await getReadClient();
  return client.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
  });
}

export async function getReview(reviewId: number | bigint) {
  const raw = await read("get_review", [BigInt(reviewId)]);
  return normalizeReview(raw);
}

export async function getRecentReviews(limit = 6): Promise<Review[]> {
  const raw = await read("get_recent_reviews", [BigInt(limit)]);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeReview).filter(Boolean) as Review[];
}

export async function getStats(): Promise<Stats> {
  const raw: any = await read("get_stats", []);
  if (!raw || typeof raw !== "object") return {};
  const out: Stats = {};
  for (const [k, v] of Object.entries(raw))
    out[k] = typeof v === "bigint" ? Number(v) : v;
  return out;
}

export function totalReviewsFrom(stats: Stats): number {
  const candidates = ["total_reviews", "reviews", "review_count", "total"];
  for (const key of candidates) {
    const v = stats[key];
    if (typeof v === "number") return v;
    if (typeof v === "string" && !Number.isNaN(Number(v))) return Number(v);
  }
  return 0;
}

/* --------------------------------------------------------------- writes */

export type TxProgress = (msg: string, hash?: string) => void;

async function waitAndVerify(client: any, hash: string, onProgress: TxProgress) {
  const { TransactionStatus } = await import("genlayer-js/types");
  onProgress("Waiting for the Bradbury network to accept the transaction.", hash);
  const receipt: any = await client.waitForTransactionReceipt({
    hash: hash as `0x${string}`,
    status: TransactionStatus.ACCEPTED,
    retries: 200,
    interval: 5000,
  });
  assertExecutionSucceeded(receipt);
  return receipt;
}

function assertExecutionSucceeded(receipt: any) {
  const data = receipt?.consensus_data ?? receipt?.consensusData ?? receipt;
  const serialized = (() => {
    try {
      return JSON.stringify(receipt, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      );
    } catch {
      return "";
    }
  })();

  const leader =
    data?.leader_receipt ?? data?.leaderReceipt ?? receipt?.leader_receipt;
  const receipts = Array.isArray(leader) ? leader : leader ? [leader] : [];
  for (const r of receipts) {
    const mode = String(r?.execution_result ?? r?.executionResult ?? "");
    if (mode && mode.toUpperCase() !== "SUCCESS") {
      throw new Error(
        `Transaction was accepted but execution failed (${mode}). ${
          r?.error ? String(r.error) : ""
        }`.trim(),
      );
    }
  }
  if (/"execution_result"\s*:\s*"ERROR"/i.test(serialized)) {
    throw new Error("Transaction was accepted but contract execution errored.");
  }
}

export async function openReview(params: {
  address: string;
  repoOwner: string;
  repoName: string;
  pullRequest: number;
  adrPath: string;
  contributorWallet: string;
  valueWei: bigint;
  onProgress: TxProgress;
}) {
  const client = await getWriteClient(params.address);
  params.onProgress("Awaiting Signature 1 — Lock Evidence in your wallet.");
  const hash: string = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "open_review",
    args: [
      params.repoOwner,
      params.repoName,
      BigInt(params.pullRequest),
      params.adrPath,
      params.contributorWallet,
    ],
    value: params.valueWei,
  });
  await waitAndVerify(client, hash, params.onProgress);
  return hash;
}

export async function callWithReviewId(
  functionName: "evaluate_review" | "refund_review",
  address: string,
  reviewId: number,
  onProgress: TxProgress,
) {
  const client = await getWriteClient(address);
  const hash: string = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: [BigInt(reviewId)],
    value: 0n,
  });
  await waitAndVerify(client, hash, onProgress);
  return hash;
}

/* -------------------------------------------------------------- polling */

export async function pollReview(
  reviewId: number,
  predicate: (r: Review) => boolean,
  opts: { attempts?: number; interval?: number } = {},
): Promise<Review> {
  const attempts = opts.attempts ?? 120;
  const interval = opts.interval ?? 5000;
  let last: Review | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await getReview(reviewId);
      if (r) {
        last = r;
        if (predicate(r)) return r;
      }
    } catch {
      /* transient RPC issue, keep polling */
    }
    await new Promise((res) => setTimeout(res, interval));
  }
  if (last) return last;
  throw new Error(
    "RPC timeout: the contract did not return this review in time. Try reloading — the transaction may still settle.",
  );
}
