import type { DashboardPR } from "./github";

const BOT_SUFFIXES = ["[bot]", "-bot"];
const BOT_USERNAMES = new Set([
  "dependabot[bot]",
  "renovate[bot]",
  "github-actions[bot]",
  "dependabot-preview[bot]",
  "snyk-bot",
  "codecov[bot]",
  "mergify[bot]",
  "greenkeeper[bot]",
  "allcontributors[bot]",
  "stale[bot]",
]);

export function isBot(login: string): boolean {
  if (BOT_USERNAMES.has(login)) return true;
  return BOT_SUFFIXES.some((suffix) => login.endsWith(suffix));
}

export function categorizePR(
  pr: DashboardPR,
  currentUser: string
): DashboardPR["category"] {
  const isMine = pr.author.toLowerCase() === currentUser.toLowerCase();
  const reviewRequestedFromMe = pr.reviewRequestedFromMe;

  if (!isMine && reviewRequestedFromMe) return "needs_attention";
  if (isMine && pr.reviewState === "changes_requested") return "needs_attention";
  if (isMine && pr.ciStatus === "failure") return "needs_attention";
  if (isMine && pr.hasConflicts) return "needs_attention";

  if (isMine && pr.reviewState === "review_required") return "waiting";
  if (isMine && pr.ciStatus === "pending") return "waiting";

  if (!isMine && reviewRequestedFromMe) return "needs_attention";

  return "other";
}

export const REFRESH_INTERVAL_MS = 120_000;

export function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
