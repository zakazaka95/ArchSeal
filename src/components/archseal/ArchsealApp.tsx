import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Lock,
  ScanLine,
  Stamp,
  Wallet,
} from "lucide-react";
import {
  CONTRACT_ADDRESS,
  addressLink,
  callWithReviewId,
  getRecentReviews,
  getReview,
  getStats,
  openReview,
  pollReview,
  totalReviewsFrom,
  txLink,
  type Review,
  type Stats,
} from "@/lib/genlayer";
import {
  describeWalletError,
  formatGen,
  getChainId,
  getEthereum,
  isBradbury,
  requestAccounts,
  shortAddress,
  shortHash,
  switchToBradbury,
  toWei,
} from "@/lib/wallet";
import { parsePrUrl, preflightGithub } from "@/lib/github";
import { CopyValue, Label, Panel, StatusChip, TxLink } from "./primitives";
import { ReviewDetail } from "./ReviewCard";
import { cn } from "@/lib/utils";

const PROOF_TX =
  "https://explorer-bradbury.genlayer.com/transactions/0xd16f9a761e677c6c4a9e4ca28848274c49f87f0d591acda76dc51e63452fa57d";

const SEALED = ["COMPLIANT", "VIOLATES_ADR", "INCONCLUSIVE"];

type Phase =
  | "idle"
  | "opening"
  | "pinned"
  | "evaluating"
  | "sealed"
  | "failed";

export function ArchsealApp() {
  /* ------------------------------------------------------------- wallet */
  const [address, setAddress] = useState<string>("");
  const [chainId, setChainId] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string>("");
  const hasWallet = typeof window !== "undefined" && !!getEthereum();
  const onBradbury = isBradbury(chainId);

  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;
    let cancelled = false;
    (async () => {
      try {
        const accounts: string[] = await eth.request({ method: "eth_accounts" });
        if (!cancelled && accounts?.[0]) setAddress(accounts[0]);
        const id = await getChainId();
        if (!cancelled) setChainId(id);
      } catch {
        /* ignore */
      }
    })();
    const onAccounts = (accs: string[]) => setAddress(accs?.[0] ?? "");
    const onChain = (id: string) => setChainId(id);
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      cancelled = true;
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    setWalletError("");
    try {
      const acc = await requestAccounts();
      setAddress(acc);
      const id = await getChainId();
      setChainId(id);
      if (!isBradbury(id)) {
        await switchToBradbury();
        setChainId(await getChainId());
      }
      setContributor((c) => c || acc);
    } catch (e) {
      setWalletError(describeWalletError(e));
    }
  }, []);

  /* --------------------------------------------------------------- form */
  const [prUrl, setPrUrl] = useState("");
  const [adrPath, setAdrPath] = useState("docs/adr");
  const [contributor, setContributor] = useState("");
  const [reward, setReward] = useState("0");

  useEffect(() => {
    if (address && !contributor) setContributor(address);
  }, [address, contributor]);

  const parsed = useMemo(() => parsePrUrl(prUrl), [prUrl]);

  /* --------------------------------------------------------------- flow */
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [openTx, setOpenTx] = useState("");
  const [evalTx, setEvalTx] = useState("");
  const [refundTx, setRefundTx] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const progress = useCallback((msg: string) => setStatusMsg(msg), []);

  const guardWallet = () => {
    if (!hasWallet) {
      setError(
        "No browser wallet detected. Install an EVM wallet extension to sign ARCHSEAL transactions.",
      );
      return false;
    }
    if (!address) {
      setError("Connect your wallet before signing.");
      return false;
    }
    if (!onBradbury) {
      setError(
        "Wrong network. Switch your wallet to the GenLayer Bradbury Testnet (chain 4221).",
      );
      return false;
    }
    return true;
  };

  const handleOpen = async () => {
    setError("");
    setNotice("");
    setEvalTx("");
    setRefundTx("");
    setReview(null);
    if (!parsed) {
      setError(
        "Enter a valid public GitHub pull request URL, e.g. https://github.com/owner/repo/pull/123",
      );
      return;
    }
    if (!adrPath.trim()) {
      setError("Enter the ADR path inside the repository (e.g. docs/adr).");
      return;
    }
    if (!guardWallet()) return;

    let valueWei = 0n;
    try {
      valueWei = toWei(reward);
    } catch (e) {
      setError(describeWalletError(e));
      return;
    }

    setBusy(true);
    setPhase("opening");
    setStatusMsg("Verifying the pull request and architectural records on GitHub.");
    try {
      const pre = await preflightGithub(parsed, adrPath);
      if (!pre.ok) {
        setPhase("failed");
        setError(pre.error);
        setBusy(false);
        return;
      }
      if (pre.warning) setNotice(pre.warning);

      setStatusMsg(
        "Pinning the repository constitution and exact pull request commits on-chain.",
      );
      const stats = await getStats();
      const expectedReviewId = totalReviewsFrom(stats) + 1;

      const hash = await openReview({
        address,
        repoOwner: parsed.owner,
        repoName: parsed.repo,
        pullRequest: parsed.number,
        adrPath: adrPath.trim(),
        contributorWallet: (contributor || address).trim(),
        valueWei,
        onProgress: (msg, h) => {
          progress(msg);
          if (h) setOpenTx(h);
        },
      });
      setOpenTx(hash);

      setStatusMsg("Reading the pinned evidence back from contract state.");
      const stored = await pollReview(
        expectedReviewId,
        (r) => !!r.base_sha && !!r.head_sha,
        { attempts: 60, interval: 4000 },
      );
      setReview(stored);
      setPhase("pinned");
      setStatusMsg("");
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setPhase("failed");
      setError(describeWalletError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleEvaluate = async () => {
    if (!review) return;
    setError("");
    if (!guardWallet()) return;
    setBusy(true);
    setPhase("evaluating");
    setStatusMsg(
      "Independent GenLayer validators are reviewing the pinned code against the accepted architecture. This usually takes a few minutes.",
    );
    try {
      const hash = await callWithReviewId(
        "evaluate_review",
        address,
        review.id,
        (msg, h) => {
          progress(msg);
          if (h) setEvalTx(h);
        },
      );
      setEvalTx(hash);
      setStatusMsg("Reading the consensus verdict from contract state.");
      const settled = await pollReview(
        review.id,
        (r) => SEALED.includes((r.status || "").toUpperCase()),
        { attempts: 150, interval: 5000 },
      );
      setReview(settled);
      if (!SEALED.includes((settled.status || "").toUpperCase())) {
        setPhase("failed");
        setError(
          "The contract did not return a final verdict. Reload to re-read the review from chain.",
        );
      } else {
        setPhase("sealed");
      }
      setStatusMsg("");
    } catch (e) {
      setPhase("failed");
      setError(describeWalletError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRefund = async () => {
    if (!review) return;
    setError("");
    if (!guardWallet()) return;
    setBusy(true);
    setStatusMsg("Requesting a refund of the pinned reward.");
    try {
      const hash = await callWithReviewId(
        "refund_review",
        address,
        review.id,
        (msg, h) => {
          progress(msg);
          if (h) setRefundTx(h);
        },
      );
      setRefundTx(hash);
      const fresh = await getReview(review.id);
      if (fresh) setReview(fresh);
      setNotice("Refund transaction executed successfully.");
      setStatusMsg("");
    } catch (e) {
      setError(`Refund failed. ${describeWalletError(e)}`);
      setStatusMsg("");
    } finally {
      setBusy(false);
    }
  };

  const currentStatus = (review?.status ?? "").toUpperCase();
  const canEvaluate = !!review && !SEALED.includes(currentStatus) && !busy;
  const inconclusive = currentStatus === "INCONCLUSIVE";

  /* --------------------------------------------------------- public data */
  const [proof, setProof] = useState<Review | null>(null);
  const [proofError, setProofError] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Review[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getReview(1);
        if (!cancelled) {
          if (r) setProof(r);
          else setProofError("Review #1 has not been returned by the contract.");
        }
      } catch {
        if (!cancelled)
          setProofError(
            "The Bradbury RPC did not respond. Reload to read the live proof.",
          );
      }
      try {
        const s = await getStats();
        if (!cancelled) setStats(s);
      } catch {
        /* non-fatal */
      }
      try {
        const list = await getRecentReviews(6);
        if (!cancelled) setRecent(list);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const statEntries = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats)
      .filter(
        ([k, v]) =>
          !/wei|balance/i.test(k) &&
          ["string", "number", "boolean"].includes(typeof v),
      )
      .slice(0, 3);
  }, [stats]);

  /* -------------------------------------------------------------- render */

  return (
    <div className="blueprint-grid min-h-screen">
      <div className="repo-map">
        {/* Header */}
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded border border-primary/50 text-primary">
              <Stamp className="h-4 w-4" />
            </div>
            <div className="leading-none">
              <div className="font-mono text-sm tracking-[0.34em] text-foreground">
                ARCHSEAL
              </div>
              <div className="label-xs mt-1">GenLayer Bradbury</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {address ? (
              <div className="hidden items-center gap-2 sm:flex">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    onBradbury ? "bg-compliant" : "bg-pending",
                  )}
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {onBradbury ? "Bradbury" : "Wrong network"}
                </span>
              </div>
            ) : null}
            <button
              type="button"
              onClick={address && !onBradbury ? () => switchToBradbury() : connect}
              className="inline-flex items-center gap-2 rounded border border-border bg-panel px-3.5 py-2 font-mono text-xs tracking-wide text-foreground transition-colors hover:border-primary/60 hover:text-primary"
            >
              <Wallet className="h-3.5 w-3.5" />
              {!hasWallet
                ? "NO WALLET FOUND"
                : address
                  ? onBradbury
                    ? shortAddress(address)
                    : "SWITCH TO BRADBURY"
                  : "CONNECT WALLET"}
            </button>
          </div>
        </header>

        {/* Hero */}
        <main className="mx-auto max-w-6xl px-5 pb-20">
          <section className="grid items-start gap-8 py-6 lg:grid-cols-[1fr_1fr] lg:py-10">
            <div className="animate-rise">
              <Label>Consensus-gated software</Label>
              <h1 className="font-display mt-4 text-5xl leading-[0.98] tracking-tight sm:text-6xl">
                Every codebase has laws.
                <span className="mt-1 block italic text-primary">
                  Merge only what obeys them.
                </span>
              </h1>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                ARCHSEAL pins a pull request&apos;s exact base and head commits
                together with your repository&apos;s Architectural Decision
                Records on the GenLayer Bradbury testnet, then lets independent
                AI validators reach consensus on whether the change obeys your
                architecture. Contract state is the only source of truth.
              </p>

              <div className="mt-7 grid grid-cols-3 gap-2">
                {[
                  { icon: Lock, label: "Pin evidence" },
                  { icon: ScanLine, label: "AI consensus" },
                  { icon: Stamp, label: "On-chain seal" },
                ].map(({ icon: Icon, label }, i) => (
                  <div
                    key={label}
                    className="relative rounded border border-border bg-panel/40 px-3 py-3"
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    <div className="mt-2 font-mono text-[11px] tracking-[0.14em] uppercase text-foreground">
                      {label}
                    </div>
                    {i < 2 ? (
                      <ArrowRight className="absolute top-1/2 -right-3 hidden h-3.5 w-3.5 -translate-y-1/2 text-line sm:block" />
                    ) : null}
                  </div>
                ))}
              </div>

              {statEntries.length ? (
                <div className="mt-7 flex flex-wrap gap-x-8 gap-y-3">
                  {statEntries.map(([k, v]) => (
                    <div key={k}>
                      <Label>{k.replace(/_/g, " ")}</Label>
                      <div className="font-display text-2xl">{String(v)}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Input panel */}
            <Panel className="animate-rise p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <Label>Open a review</Label>
                <TxLink href={addressLink(CONTRACT_ADDRESS)}>
                  {shortAddress(CONTRACT_ADDRESS)}
                </TxLink>
              </div>

              <div className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label>GitHub pull request URL</Label>
                  <input
                    value={prUrl}
                    onChange={(e) => setPrUrl(e.target.value)}
                    spellCheck={false}
                    placeholder="https://github.com/MITLibraries/timdex/pull/978"
                    className="w-full rounded border border-input bg-background/60 px-3 py-2.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/70"
                  />
                  {prUrl && !parsed ? (
                    <p className="font-mono text-xs text-violation">
                      Invalid pull request URL.
                    </p>
                  ) : parsed ? (
                    <p className="font-mono text-xs text-muted-foreground">
                      {parsed.owner}/{parsed.repo} · PR #{parsed.number}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>ADR path</Label>
                    <input
                      value={adrPath}
                      onChange={(e) => setAdrPath(e.target.value)}
                      spellCheck={false}
                      className="w-full rounded border border-input bg-background/60 px-3 py-2.5 font-mono text-sm outline-none focus:border-primary/70"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reward (GEN, optional)</Label>
                    <input
                      value={reward}
                      onChange={(e) => setReward(e.target.value)}
                      inputMode="decimal"
                      className="w-full rounded border border-input bg-background/60 px-3 py-2.5 font-mono text-sm outline-none focus:border-primary/70"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Contributor wallet</Label>
                  <input
                    value={contributor}
                    onChange={(e) => setContributor(e.target.value)}
                    spellCheck={false}
                    placeholder="0x…"
                    className="w-full rounded border border-input bg-background/60 px-3 py-2.5 font-mono text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/70"
                  />
                </div>

                {!address ? (
                  <button
                    type="button"
                    onClick={connect}
                    className="w-full rounded bg-primary px-4 py-3 font-mono text-xs tracking-[0.2em] text-primary-foreground uppercase transition-opacity hover:opacity-90"
                  >
                    Connect wallet to continue
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleOpen}
                    className="inline-flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-3 font-mono text-xs tracking-[0.2em] text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy && phase === "opening" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                    Signature 1 — Lock evidence
                  </button>
                )}

                <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                  Two wallet signatures are required. Signature 1 pins the
                  commits and ADRs on-chain. Signature 2 runs the AI consensus
                  review.
                </p>

                {walletError ? (
                  <p className="font-mono text-xs text-violation">{walletError}</p>
                ) : null}
              </div>
            </Panel>
          </section>

          {/* Active workflow state */}
          <div ref={resultRef} className="scroll-mt-6">
            {statusMsg || error || notice || review ? (
              <Panel className="animate-rise mt-2 space-y-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label>Active review</Label>
                  <div className="flex flex-wrap items-center gap-4">
                    {openTx ? (
                      <TxLink href={txLink(openTx)}>Lock evidence tx</TxLink>
                    ) : null}
                    {evalTx ? (
                      <TxLink href={txLink(evalTx)}>Consensus tx</TxLink>
                    ) : null}
                    {refundTx ? (
                      <TxLink href={txLink(refundTx)}>Refund tx</TxLink>
                    ) : null}
                  </div>
                </div>

                {statusMsg ? (
                  <div className="flex items-start gap-3 rounded border border-pending/40 bg-pending/5 px-4 py-3">
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-pending" />
                    <p className="text-sm text-foreground/90">{statusMsg}</p>
                  </div>
                ) : null}

                {notice ? (
                  <p className="font-mono text-xs text-pending">{notice}</p>
                ) : null}

                {error ? (
                  <div className="flex items-start gap-3 rounded border border-violation/50 bg-violation/5 px-4 py-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-violation" />
                    <div>
                      <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-violation">
                        Transaction failed
                      </div>
                      <p className="mt-1 text-sm text-foreground/90">{error}</p>
                    </div>
                  </div>
                ) : null}

                {review ? (
                  <ReviewDetail
                    review={review}
                    {...(evalTx ? { evaluationTxUrl: txLink(evalTx) } : {})}
                    actions={
                      <div className="space-y-2">
                        {canEvaluate ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={handleEvaluate}
                            className="inline-flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-3 font-mono text-xs tracking-[0.18em] text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {busy && phase === "evaluating" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ScanLine className="h-3.5 w-3.5" />
                            )}
                            Run consensus review
                          </button>
                        ) : null}
                        {inconclusive ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={handleEvaluate}
                              className="rounded border border-pending/60 px-3 py-2.5 font-mono text-[11px] tracking-[0.16em] text-pending uppercase disabled:opacity-50"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={handleRefund}
                              className="rounded border border-border px-3 py-2.5 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase hover:text-foreground disabled:opacity-50"
                            >
                              Refund
                            </button>
                          </div>
                        ) : null}
                      </div>
                    }
                  />
                ) : null}
              </Panel>
            ) : null}
          </div>

          {/* Live proof */}
          <section className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Label>Live consensus proof</Label>
                <h2 className="font-display mt-2 text-3xl tracking-tight">
                  Read live from contract state
                </h2>
              </div>
              <TxLink href={PROOF_TX}>Accepted evaluation transaction</TxLink>
            </div>

            <Panel className="mt-5 p-5 sm:p-6">
              {proof ? (
                <ReviewDetail review={proof} evaluationTxUrl={PROOF_TX} />
              ) : proofError ? (
                <p className="font-mono text-sm text-violation">{proofError}</p>
              ) : (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-mono text-sm">
                    Reading review #1 from the Bradbury contract…
                  </span>
                </div>
              )}
            </Panel>
          </section>

          {/* Recent reviews */}
          {recent.length > 0 ? (
            <section className="mt-14">
              <Label>Recent reviews</Label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recent.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-border bg-panel/40 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{r.id}
                      </span>
                      <StatusChip status={r.status} />
                    </div>
                    <div className="mt-3 truncate font-mono text-sm text-foreground">
                      {r.repo_owner}/{r.repo_name}
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      PR #{r.pull_request} · {formatGen(r.reward_wei)} GEN
                    </div>
                    <div className="hairline mt-3 pt-3">
                      <CopyValue
                        value={r.head_sha}
                        display={shortHash(r.head_sha)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <footer className="hairline mt-16 flex flex-wrap items-center justify-between gap-3 pt-6">
            <p className="font-mono text-[11px] tracking-wide text-muted-foreground">
              GenLayer Bradbury Testnet · Chain 4221 · Contract{" "}
              {shortAddress(CONTRACT_ADDRESS)}
            </p>
            <TxLink href={addressLink(CONTRACT_ADDRESS)}>
              Bradbury Explorer
            </TxLink>
          </footer>
        </main>
      </div>
    </div>
  );
}
