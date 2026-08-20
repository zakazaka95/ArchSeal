import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

export function VerdictSeal({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const s = (status || "").toUpperCase();

  const config =
    s === "COMPLIANT"
      ? {
          text: "ARCHITECTURE COMPLIANT",
          tone: "border-compliant/50 text-compliant",
          glow: "bg-compliant/5",
          Icon: ShieldCheck,
        }
      : s === "VIOLATES_ADR"
        ? {
            text: "COVENANT VIOLATED",
            tone: "border-violation/55 text-violation",
            glow: "bg-violation/5",
            Icon: ShieldAlert,
          }
        : {
            text: "EVIDENCE INCONCLUSIVE",
            tone: "border-pending/55 text-pending",
            glow: "bg-pending/5",
            Icon: ShieldQuestion,
          };

  const { Icon } = config;

  return (
    <div
      className={cn(
        "animate-seal relative flex items-center gap-5 rounded-lg border px-6 py-6",
        config.tone,
        config.glow,
        className,
      )}
    >
      <div
        className={cn(
          "hidden h-16 w-16 shrink-0 items-center justify-center rounded-full border sm:flex",
          config.tone,
        )}
      >
        <Icon className="h-7 w-7" />
      </div>
      <div className="min-w-0">
        <div className="label-xs">On-chain seal</div>
        <div className="font-display mt-1 text-3xl leading-[1.05] tracking-tight sm:text-5xl">
          {config.text}
        </div>
      </div>
    </div>
  );
}
