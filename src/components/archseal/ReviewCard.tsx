import type { Review } from "@/lib/genlayer";
import { addressLink, CONTRACT_ADDRESS } from "@/lib/genlayer";
import { formatGen, shortAddress, shortHash } from "@/lib/wallet";
import { CopyValue, Field, Label, StatusChip, TxLink } from "./primitives";
import { VerdictSeal } from "./VerdictSeal";
import { cn } from "@/lib/utils";

export function ReviewDetail({
  review,
  className,
  evaluationTxUrl,
  actions,
}: {
  review: Review;
  className?: string;
  evaluationTxUrl?: string;
  actions?: React.ReactNode;
}) {
  const v = review.last_verdict;
  const status = (review.status || "").toUpperCase();
  const sealed = ["COMPLIANT", "VIOLATES_ADR", "INCONCLUSIVE"].includes(status);

  return (
    <div className={cn("space-y-5", className)}>
      {sealed ? <VerdictSeal status={status} /> : null}

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field
              label="Repository"
              value={
                <a
                  href={`https://github.com/${review.repo_owner}/${review.repo_name}/pull/${review.pull_request}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-primary"
                >
                  {review.repo_owner}/{review.repo_name}
                </a>
              }
            />
            <Field label="Pull request" value={`#${review.pull_request}`} />
            <Field label="ADR path" value={review.adr_path || "—"} />
            <Field
              label="Base commit"
              value={
                <CopyValue
                  value={review.base_sha}
                  display={shortHash(review.base_sha)}
                />
              }
            />
            <Field
              label="Head commit"
              value={
                <CopyValue
                  value={review.head_sha}
                  display={shortHash(review.head_sha)}
                />
              }
            />
            <Field
              label="Status"
              value={<StatusChip status={review.status} />}
            />
          </div>

          {v ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field
                  label="Compliance score"
                  value={v.score === null ? "—" : String(v.score)}
                />
                <Field label="Risk level" value={v.risk_level || "—"} />
                <Field label="Attempts" value={String(review.attempts)} />
              </div>
              {v.summary ? (
                <div className="space-y-1.5">
                  <Label>Summary</Label>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {v.summary}
                  </p>
                </div>
              ) : null}

              {v.violated_adrs.length > 0 ? (
                <div className="space-y-2">
                  <Label>Violated ADRs</Label>
                  <div className="flex flex-wrap gap-2">
                    {v.violated_adrs.map((a, i) => (
                      <span
                        key={`${a}-${i}`}
                        className="rounded border border-violation/45 px-2 py-1 font-mono text-xs text-violation"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {v.findings.length > 0 ? (
                <div className="space-y-2">
                  <Label>Findings</Label>
                  <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                    {v.findings.map((f, i) => (
                      <li key={i} className="space-y-1.5 bg-panel/40 p-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-wide">
                          <span className="text-primary">{f.adr || "ADR"}</span>
                          <span className="text-muted-foreground">
                            {f.file || "—"}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/90">
                          {f.finding}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Evidence is pinned on-chain. No consensus verdict has been recorded
              for this review yet.
            </p>
          )}
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-panel/40 p-4">
          <Field label="Review ID" value={`#${review.id}`} />
          <Field label="Reward" value={`${formatGen(review.reward_wei)} GEN`} />
          <Field
            label="Payout"
            value={review.payout_scheduled ? "Scheduled" : "Not scheduled"}
          />
          <Field
            label="Sponsor"
            value={
              <CopyValue
                value={review.sponsor}
                display={shortAddress(review.sponsor)}
              />
            }
          />
          <Field
            label="Contributor"
            value={
              <CopyValue
                value={review.contributor_wallet}
                display={shortAddress(review.contributor_wallet)}
              />
            }
          />
          <div className="hairline space-y-2 pt-3">
            {evaluationTxUrl ? (
              <TxLink href={evaluationTxUrl}>Evaluation transaction</TxLink>
            ) : null}
            <div>
              <TxLink href={addressLink(CONTRACT_ADDRESS)}>
                Bradbury Explorer — contract
              </TxLink>
            </div>
          </div>
          {actions ? <div className="pt-1">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
