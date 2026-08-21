import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("label-xs", className)}>{children}</span>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("glass-panel rounded-lg", className)}>{children}</div>;
}

export function CopyValue({
  value,
  display,
  className,
}: {
  value: string;
  display?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="font-mono text-muted-foreground">—</span>;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={cn(
        "group inline-flex items-center gap-1.5 font-mono text-sm text-foreground transition-colors hover:text-primary",
        className,
      )}
      aria-label={`Copy ${value}`}
    >
      {display ?? value}
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Copy className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

export function TxLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs tracking-wide text-primary underline-offset-4 hover:underline",
        className,
      )}
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label>{label}</Label>
      <div className="font-mono text-sm break-words text-foreground">{value}</div>
    </div>
  );
}

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const s = (status || "").toUpperCase();
  const tone =
    s === "COMPLIANT"
      ? "border-compliant/40 text-compliant"
      : s === "VIOLATES_ADR"
        ? "border-violation/50 text-violation"
        : s === "INCONCLUSIVE"
          ? "border-pending/50 text-pending"
          : "border-border text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-[0.14em] uppercase",
        tone,
        className,
      )}
    >
      {s || "UNKNOWN"}
    </span>
  );
}
