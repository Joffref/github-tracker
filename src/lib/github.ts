import { isBot } from "./constants";

// ── Types ──────────────────────────────────────────────────────────

export type CIStatus = "success" | "failure" | "pending" | "neutral" | "unknown";
export type ReviewState =
  | "approved"
  | "changes_requested"
  | "review_required"
  | "commented"
  | "unknown";
export type PRCategory = "needs_attention" | "waiting" | "other";

export interface DashboardPR {
  id: number;
  number: number;
  title: string;
  body: string;
  url: string;
  repo: string;
  author: string;
  authorAvatar: string;
  isBot: boolean;
  labels: Array<{ name: string; color: string }>;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  hasConflicts: boolean;
  ciStatus: CIStatus;
  reviewState: ReviewState;
  reviewRequestedFromMe: boolean;
  reviewers: Array<{ login: string; state: string; avatar: string }>;
  category: PRCategory;
  headSha: string;
}

export interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface PRComment {
  id: number;
  user: { login: string; avatar_url: string };
  body: string;
  created_at: string;
  html_url: string;
}

export interface ReviewComment {
  id: number;
  user: { login: string; avatar_url: string };
  body: string;
  created_at: string;
  html_url: string;
  path: string;
  line: number | null;
  original_line: number | null;
  diff_hunk: string;
  in_reply_to_id?: number;
  pull_request_review_id: number | null;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
}

// ── API helpers ────────────────────────────────────────────────────

const BASE = "https://api.github.com";

async function ghFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Public API ─────────────────────────────────────────────────────

export async function fetchUser(token: string): Promise<GitHubUser> {
  return ghFetch<GitHubUser>(token, "/user");
}

interface SearchResult {
  total_count: number;
  items: Array<Record<string, unknown>>;
}

export async function fetchOpenPRs(
  token: string,
  username: string
): Promise<DashboardPR[]> {
  const allItems: Array<Record<string, unknown>> = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const q = encodeURIComponent(`type:pr state:open involves:${username}`);
    const data = await ghFetch<SearchResult>(
      token,
      `/search/issues?q=${q}&per_page=${perPage}&page=${page}&sort=updated&order=desc`
    );
    allItems.push(...data.items);
    if (allItems.length >= data.total_count || data.items.length < perPage) break;
    page++;
  }

  return allItems.map((item) => mapSearchItemToPR(item, username));
}

function extractRepo(repoUrl: string): string {
  // repository_url looks like "https://api.github.com/repos/owner/repo"
  const parts = repoUrl.split("/repos/");
  return parts[1] ?? repoUrl;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapSearchItemToPR(item: any, _username: string): DashboardPR {
  const author = item.user?.login ?? "unknown";
  const repo = extractRepo(item.repository_url ?? "");

  return {
    id: item.id,
    number: item.number,
    title: item.title,
    body: item.body ?? "",
    url: item.html_url,
    repo,
    author,
    authorAvatar: item.user?.avatar_url ?? "",
    isBot: isBot(author),
    labels: (item.labels ?? []).map((l: any) => ({
      name: l.name,
      color: l.color,
    })),
    isDraft: item.draft ?? false,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    hasConflicts: false,
    ciStatus: "unknown",
    reviewState: "unknown",
    reviewRequestedFromMe: false,
    reviewers: [],
    category: "other",
    headSha: "",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Enrichment ─────────────────────────────────────────────────────

export async function enrichPRDetails(
  token: string,
  pr: DashboardPR,
  username: string
): Promise<DashboardPR> {
  const [reviews, checks, prDetail] = await Promise.allSettled([
    ghFetch<Array<{ user: { login: string }; state: string }>>(
      token,
      `/repos/${pr.repo}/pulls/${pr.number}/reviews`
    ),
    pr.headSha
      ? ghFetch<{ check_runs: Array<{ conclusion: string | null; status: string }> }>(
          token,
          `/repos/${pr.repo}/commits/${pr.headSha}/check-runs`
        )
      : Promise.resolve(null),
    ghFetch<{
      mergeable: boolean | null;
      mergeable_state: string;
      head: { sha: string };
      requested_reviewers: Array<{ login: string }>;
    }>(token, `/repos/${pr.repo}/pulls/${pr.number}`),
  ]);

  let enriched = { ...pr };

  // PR detail (mergeable + head sha + requested reviewers)
  if (prDetail.status === "fulfilled" && prDetail.value) {
    const d = prDetail.value;
    enriched.headSha = d.head.sha;
    enriched.hasConflicts = d.mergeable === false && d.mergeable_state === "dirty";
    enriched.reviewRequestedFromMe = (d.requested_reviewers ?? []).some(
      (r) => r.login.toLowerCase() === username.toLowerCase()
    );
  }

  // Reviews
  if (reviews.status === "fulfilled") {
    const reviewList = reviews.value;
    const latestByUser = new Map<string, { login: string; state: string }>();
    for (const r of reviewList) {
      latestByUser.set(r.user.login, {
        login: r.user.login,
        state: r.state,
      });
    }
    enriched.reviewers = Array.from(latestByUser.values()).map((r) => ({
      login: r.login,
      state: r.state,
      avatar: "",
    }));
    enriched.reviewState = deriveReviewState(enriched.reviewers);
  }

  // Checks — if we didn't have headSha initially, try again with the one from prDetail
  if (checks.status === "fulfilled" && checks.value) {
    enriched.ciStatus = deriveCIStatus(checks.value.check_runs);
  } else if (
    checks.status !== "fulfilled" &&
    enriched.headSha &&
    enriched.headSha !== pr.headSha
  ) {
    try {
      const checksRetry = await ghFetch<{
        check_runs: Array<{ conclusion: string | null; status: string }>;
      }>(token, `/repos/${pr.repo}/commits/${enriched.headSha}/check-runs`);
      enriched.ciStatus = deriveCIStatus(checksRetry.check_runs);
    } catch {
      enriched.ciStatus = "unknown";
    }
  }

  return enriched;
}

function deriveReviewState(
  reviewers: Array<{ login: string; state: string }>
): ReviewState {
  if (reviewers.length === 0) return "review_required";
  const states = reviewers.map((r) => r.state);
  if (states.includes("CHANGES_REQUESTED")) return "changes_requested";
  if (states.includes("APPROVED")) return "approved";
  if (states.includes("COMMENTED")) return "commented";
  return "review_required";
}

function deriveCIStatus(
  runs: Array<{ conclusion: string | null; status: string }>
): CIStatus {
  if (runs.length === 0) return "neutral";
  const hasFailure = runs.some(
    (r) => r.conclusion === "failure" || r.conclusion === "timed_out"
  );
  if (hasFailure) return "failure";
  const hasPending = runs.some((r) => r.status !== "completed");
  if (hasPending) return "pending";
  const allSuccess = runs.every(
    (r) =>
      r.conclusion === "success" ||
      r.conclusion === "neutral" ||
      r.conclusion === "skipped"
  );
  if (allSuccess) return "success";
  return "neutral";
}

// ── PR Detail fetchers ─────────────────────────────────────────────

export async function fetchPRFiles(
  token: string,
  repo: string,
  number: number
): Promise<PRFile[]> {
  return ghFetch<PRFile[]>(token, `/repos/${repo}/pulls/${number}/files`);
}

export async function fetchIssueComments(
  token: string,
  repo: string,
  number: number
): Promise<PRComment[]> {
  return ghFetch<PRComment[]>(token, `/repos/${repo}/issues/${number}/comments`);
}

export async function fetchReviewComments(
  token: string,
  repo: string,
  number: number
): Promise<ReviewComment[]> {
  return ghFetch<ReviewComment[]>(token, `/repos/${repo}/pulls/${number}/comments`);
}

export async function postReviewComment(
  token: string,
  repo: string,
  number: number,
  body: string,
  inReplyTo: number
): Promise<ReviewComment> {
  const res = await fetch(`${BASE}/repos/${repo}/pulls/${number}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body, in_reply_to: inReplyTo }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json() as Promise<ReviewComment>;
}

export async function postNewReviewComment(
  token: string,
  repo: string,
  number: number,
  body: string,
  path: string,
  line: number,
  commitId: string
): Promise<ReviewComment> {
  const res = await fetch(`${BASE}/repos/${repo}/pulls/${number}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body, path, line, commit_id: commitId, side: "RIGHT" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json() as Promise<ReviewComment>;
}

export async function postComment(
  token: string,
  repo: string,
  number: number,
  body: string
): Promise<PRComment> {
  const res = await fetch(`${BASE}/repos/${repo}/issues/${number}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json() as Promise<PRComment>;
}

// ── Develop branch check ──────────────────────────────────────────

export async function checkOnDevelop(
  token: string,
  repo: string,
  headSha: string
): Promise<"yes" | "no" | "no-branch"> {
  if (!headSha) return "no";
  try {
    const data = await ghFetch<{ ahead_by: number; status: string }>(
      token,
      `/repos/${repo}/compare/develop...${headSha}`
    );
    return data.ahead_by === 0 ? "yes" : "no";
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("404")) return "no-branch";
    return "no";
  }
}

// ── OAuth Device Flow ──────────────────────────────────────────────

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export async function requestDeviceCode(
  _clientId: string
): Promise<DeviceCodeResponse> {
  const res = await fetch("/api/oauth/device-code", {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to request device code: ${res.status}`);
  }
  return res.json() as Promise<DeviceCodeResponse>;
}

interface TokenPollResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  interval?: number;
}

export async function pollForToken(
  clientId: string,
  deviceCode: string,
  interval: number,
  signal?: AbortSignal
): Promise<string> {
  let pollInterval = interval;

  while (true) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, pollInterval * 1000);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const res = await fetch("/api/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_code: deviceCode,
      }),
    });

    const data = (await res.json()) as TokenPollResponse;

    if (data.access_token) {
      return data.access_token;
    }

    if (data.error === "slow_down") {
      pollInterval = data.interval ?? pollInterval + 5;
      continue;
    }

    if (data.error === "authorization_pending") {
      continue;
    }

    if (data.error === "expired_token") {
      throw new Error("The device code has expired. Please try again.");
    }

    if (data.error === "access_denied") {
      throw new Error("Authorization was denied.");
    }

    if (data.error) {
      throw new Error(data.error_description ?? data.error);
    }
  }
}

// ── Batch enrichment ───────────────────────────────────────────────

export async function enrichAllPRs(
  token: string,
  prs: DashboardPR[],
  username: string,
  onUpdate: (index: number, pr: DashboardPR) => void
): Promise<void> {
  const batchSize = 5;
  for (let i = 0; i < prs.length; i += batchSize) {
    const batch = prs.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((pr) => enrichPRDetails(token, pr, username))
    );
    results.forEach((result, j) => {
      if (result.status === "fulfilled") {
        onUpdate(i + j, result.value);
      }
    });
    if (i + batchSize < prs.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}
