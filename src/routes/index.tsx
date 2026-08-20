import { createFileRoute } from "@tanstack/react-router";
import { ArchsealApp } from "@/components/archseal/ArchsealApp";

const title = "ARCHSEAL — Consensus-Gated Software";
const description =
  "ARCHSEAL pins a GitHub pull request's exact commits and a repository's ADRs on GenLayer Bradbury, then seals an AI-consensus compliance verdict on-chain.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <ArchsealApp />;
}
