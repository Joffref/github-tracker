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
  baseRef: string;
  headRef: string;
  onDevelop: "yes" | "no" | "no-branch" | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  hasNewCommitsSinceMyReview: boolean;
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

export interface PRCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string; avatar_url: string } | null;
  html_url: string;
}

export interface CheckRun {
  id: number;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string;
  app: { name: string; slug: string } | null;
  output: { title: string | null; summary: string | null };
}

export interface WorkflowStep {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  number: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkflowJob {
  id: number;
  run_id: number;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  steps: WorkflowStep[];
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
  username: string,
  org?: string | null
): Promise<DashboardPR[]> {
  const allItems: Array<Record<string, unknown>> = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    let query = `type:pr state:open involves:${username}`;
    if (org) query += ` org:${org}`;
    const q = encodeURIComponent(query);
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

// ── Daily Activity Tracking ────────────────────────────────────────

export interface DailyActivity {
  reviewsSubmitted: Array<{ repo: string; prNumber: number; prTitle: string; url: string; state: string; submittedAt: string }>;
  commentsMade: Array<{ repo: string; prNumber: number; prTitle: string; url: string; commentedAt: string }>;
  prsMerged: Array<{ repo: string; prNumber: number; prTitle: string; url: string; mergedAt: string }>;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function fetchDailyActivity(
  token: string,
  username: string,
  org?: string | null
): Promise<DailyActivity> {
  const today = todayISO();
  const orgFilter = org ? ` org:${org}` : "";

  const [reviewedData, commentedData, mergedData] = await Promise.all([
    // PRs I reviewed today
    ghFetch<SearchResult>(
      token,
      `/search/issues?q=${encodeURIComponent(`type:pr reviewed-by:${username} -author:${username} updated:>=${today}${orgFilter}`)}&per_page=100&sort=updated`
    ),
    // PRs I commented on today
    ghFetch<SearchResult>(
      token,
      `/search/issues?q=${encodeURIComponent(`type:pr commenter:${username} -author:${username} updated:>=${today}${orgFilter}`)}&per_page=100&sort=updated`
    ),
    // PRs merged today that I'm involved in (authored, reviewed, or merged)
    ghFetch<SearchResult>(
      token,
      `/search/issues?q=${encodeURIComponent(`type:pr involves:${username} is:merged merged:>=${today}${orgFilter}`)}&per_page=100&sort=updated`
    ),
  ]);

  const mapItem = (item: Record<string, unknown>) => ({
    repo: extractRepo(item.repository_url as string),
    prNumber: item.number as number,
    prTitle: item.title as string,
    url: item.html_url as string,
  });

  // For merged PRs, fetch PR details to check who actually clicked merge
  const mergedCandidates = mergedData.items.map(mapItem);
  const mergedDetails = await Promise.all(
    mergedCandidates.map(async (item) => {
      try {
        const pr = await ghFetch<Record<string, unknown>>(
          token,
          `/repos/${item.repo}/pulls/${item.prNumber}`
        );
        const mergedBy = (pr.merged_by as Record<string, unknown>)?.login as string | undefined;
        return { ...item, mergedBy, mergedAt: pr.merged_at as string ?? "" };
      } catch {
        return { ...item, mergedBy: undefined, mergedAt: "" };
      }
    })
  );

  return {
    reviewsSubmitted: reviewedData.items.map((item) => ({
      ...mapItem(item),
      state: "reviewed",
      submittedAt: item.updated_at as string,
    })),
    commentsMade: commentedData.items.map((item) => ({
      ...mapItem(item),
      commentedAt: item.updated_at as string,
    })),
    prsMerged: mergedDetails
      .filter((d) => d.mergedBy === username)
      .map((d) => ({
        repo: d.repo,
        prNumber: d.prNumber,
        prTitle: d.prTitle,
        url: d.url,
        mergedAt: d.mergedAt,
      })),
  };
}

export async function fetchUserOrgs(
  token: string
): Promise<Array<{ login: string; avatar_url: string }>> {
  return ghFetch<Array<{ login: string; avatar_url: string }>>(token, "/user/orgs?per_page=100");
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
    baseRef: "",
    headRef: "",
    onDevelop: null,
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    hasNewCommitsSinceMyReview: false,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Enrichment ─────────────────────────────────────────────────────

export async function enrichPRDetails(
  token: string,
  pr: DashboardPR,
  username: string
): Promise<DashboardPR> {
  const [reviews, checks, prDetail, commits] = await Promise.allSettled([
    ghFetch<Array<{ user: { login: string }; state: string; submitted_at: string }>>(
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
      head: { sha: string; ref: string };
      base: { ref: string };
      requested_reviewers: Array<{ login: string }>;
      additions: number;
      deletions: number;
      changed_files: number;
    }>(token, `/repos/${pr.repo}/pulls/${pr.number}`),
    ghFetch<Array<{ commit: { committer: { date: string } } }>>(
      token,
      `/repos/${pr.repo}/pulls/${pr.number}/commits?per_page=100`
    ),
  ]);

  let enriched = { ...pr };

  // PR detail (mergeable + head sha + requested reviewers)
  if (prDetail.status === "fulfilled" && prDetail.value) {
    const d = prDetail.value;
    enriched.headSha = d.head.sha;
    enriched.baseRef = d.base.ref;
    enriched.headRef = d.head.ref;
    enriched.hasConflicts = d.mergeable === false && d.mergeable_state === "dirty";
    enriched.reviewRequestedFromMe = (d.requested_reviewers ?? []).some(
      (r) => r.login.toLowerCase() === username.toLowerCase()
    );
    enriched.additions = d.additions ?? 0;
    enriched.deletions = d.deletions ?? 0;
    enriched.changedFiles = d.changed_files ?? 0;
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

    // Detect new commits since the current user's last review
    const myReviews = reviewList.filter(
      (r) => r.user.login.toLowerCase() === username.toLowerCase() && r.submitted_at
    );
    if (myReviews.length > 0 && commits.status === "fulfilled" && commits.value) {
      const lastReviewDate = new Date(
        Math.max(...myReviews.map((r) => new Date(r.submitted_at).getTime()))
      );
      const hasNewerCommit = commits.value.some(
        (c) => new Date(c.commit.committer.date) > lastReviewDate
      );
      enriched.hasNewCommitsSinceMyReview = hasNewerCommit;
    }
  }

  // Checks — if we didn't have headSha initially, fetch with the one from prDetail
  if (checks.status === "fulfilled" && checks.value && checks.value.check_runs) {
    enriched.ciStatus = deriveCIStatus(checks.value.check_runs);
  } else if (enriched.headSha) {
    try {
      const checksRetry = await ghFetch<{
        check_runs: Array<{ conclusion: string | null; status: string }>;
      }>(token, `/repos/${pr.repo}/commits/${enriched.headSha}/check-runs`);
      enriched.ciStatus = deriveCIStatus(checksRetry.check_runs);
    } catch {
      enriched.ciStatus = "unknown";
    }
  }

  // Check if already on develop
  if (enriched.headSha) {
    enriched.onDevelop = await checkOnDevelop(token, pr.repo, enriched.headSha);
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

async function ghFetchAllPages<T>(token: string, path: string): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  const sep = path.includes("?") ? "&" : "?";
  while (true) {
    const items = await ghFetch<T[]>(token, `${path}${sep}per_page=100&page=${page}`);
    results.push(...items);
    if (items.length < 100) break;
    page++;
  }
  return results;
}

export async function fetchPRFiles(
  token: string,
  repo: string,
  number: number
): Promise<PRFile[]> {
  return ghFetchAllPages<PRFile>(token, `/repos/${repo}/pulls/${number}/files`);
}

export interface ReviewThreadInfo {
  id: string; // GraphQL node ID
  isResolved: boolean;
  path: string;
  line: number | null;
  originalLine: number | null;
}

export interface ThreadResolution {
  totalThreads: number;
  resolvedThreads: number;
  threads: ReviewThreadInfo[];
}

export async function fetchThreadResolutions(
  token: string,
  repo: string,
  number: number
): Promise<ThreadResolution> {
  const [owner, name] = repo.split("/");
  const query = `query($owner:String!,$name:String!,$number:Int!) {
    repository(owner:$owner,name:$name) {
      pullRequest(number:$number) {
        reviewThreads(first:100) {
          nodes {
            id
            isResolved
            path
            line
            originalLine
          }
        }
      }
    }
  }`;
  try {
    const data = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { owner, name, number } }),
    }).then((r) => r.json());
    const nodes = data?.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];
    const threads: ReviewThreadInfo[] = nodes.map((n: { id: string; isResolved: boolean; path: string; line: number | null; originalLine: number | null }) => ({
      id: n.id,
      isResolved: n.isResolved,
      path: n.path,
      line: n.line,
      originalLine: n.originalLine,
    }));
    return {
      totalThreads: threads.length,
      resolvedThreads: threads.filter((t) => t.isResolved).length,
      threads,
    };
  } catch {
    return { totalThreads: 0, resolvedThreads: 0, threads: [] };
  }
}

export async function resolveReviewThread(
  token: string,
  threadId: string
): Promise<boolean> {
  const mutation = `mutation($threadId:ID!) {
    resolveReviewThread(input:{threadId:$threadId}) {
      thread { isResolved }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: mutation, variables: { threadId } }),
  });
  const data = await res.json();
  return data?.data?.resolveReviewThread?.thread?.isResolved ?? false;
}

export async function unresolveReviewThread(
  token: string,
  threadId: string
): Promise<boolean> {
  const mutation = `mutation($threadId:ID!) {
    unresolveReviewThread(input:{threadId:$threadId}) {
      thread { isResolved }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: mutation, variables: { threadId } }),
  });
  const data = await res.json();
  return !(data?.data?.unresolveReviewThread?.thread?.isResolved ?? true);
}

export async function fetchIssueComments(
  token: string,
  repo: string,
  number: number
): Promise<PRComment[]> {
  return ghFetchAllPages<PRComment>(token, `/repos/${repo}/issues/${number}/comments`);
}

export async function fetchReviewComments(
  token: string,
  repo: string,
  number: number
): Promise<ReviewComment[]> {
  return ghFetchAllPages<ReviewComment>(token, `/repos/${repo}/pulls/${number}/comments`);
}

export async function fetchPRCommits(
  token: string,
  repo: string,
  number: number
): Promise<PRCommit[]> {
  return ghFetch<PRCommit[]>(token, `/repos/${repo}/pulls/${number}/commits?per_page=100`);
}

export async function fetchCheckRuns(
  token: string,
  repo: string,
  headSha: string
): Promise<CheckRun[]> {
  const data = await ghFetch<{ total_count: number; check_runs: CheckRun[] }>(
    token,
    `/repos/${repo}/commits/${headSha}/check-runs?per_page=100`
  );
  return data.check_runs;
}

export async function rerunCheckRun(
  token: string,
  repo: string,
  checkRunId: number
): Promise<void> {
  const res = await fetch(`${BASE}/repos/${repo}/check-runs/${checkRunId}/rerequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
}

export async function rerunFailedChecks(
  token: string,
  repo: string,
  headSha: string
): Promise<void> {
  // Get the workflow runs for this commit and re-run failed ones
  const data = await ghFetch<{ total_count: number; workflow_runs: Array<{ id: number; conclusion: string | null }> }>(
    token,
    `/repos/${repo}/actions/runs?head_sha=${headSha}&per_page=100`
  );
  const failedRuns = data.workflow_runs.filter((r) => r.conclusion === "failure" || r.conclusion === "timed_out");
  await Promise.all(
    failedRuns.map((run) =>
      fetch(`${BASE}/repos/${repo}/actions/runs/${run.id}/rerun-failed-jobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      })
    )
  );
}

export async function fetchWorkflowJobs(
  token: string,
  repo: string,
  headSha: string
): Promise<WorkflowJob[]> {
  const data = await ghFetch<{ total_count: number; workflow_runs: Array<{ id: number }> }>(
    token,
    `/repos/${repo}/actions/runs?head_sha=${headSha}&per_page=100`
  );
  const jobResults = await Promise.all(
    data.workflow_runs.map((run) =>
      ghFetch<{ total_count: number; jobs: WorkflowJob[] }>(
        token,
        `/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`
      )
    )
  );
  return jobResults.flatMap((r) => r.jobs);
}

export async function fetchJobLogs(
  token: string,
  repo: string,
  jobId: number
): Promise<string> {
  const res = await fetch("/api/github/job-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, repo, jobId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch logs: ${res.status}`);
  }
  const data = await res.json();
  return data.logs;
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

// ── Conflict detection ────────────────────────────────────────────

export interface ConflictFile {
  filename: string;
  baseContent: string;
  headContent: string;
}

export async function fetchConflictFiles(
  token: string,
  repo: string,
  number: number,
  baseRef: string,
  headRef: string
): Promise<ConflictFile[]> {
  // Get files changed in PR and files changed in base since merge-base
  const [prFiles, compareData] = await Promise.allSettled([
    ghFetch<Array<{ filename: string }>>(token, `/repos/${repo}/pulls/${number}/files?per_page=100`),
    ghFetch<{ files: Array<{ filename: string }> }>(token, `/repos/${repo}/compare/${headRef}...${baseRef}`),
  ]);

  if (prFiles.status !== "fulfilled" || compareData.status !== "fulfilled") return [];

  const prFileSet = new Set(prFiles.value.map((f) => f.filename));
  const baseChangedFiles = compareData.value.files?.map((f) => f.filename) ?? [];
  const conflicting = baseChangedFiles.filter((f) => prFileSet.has(f));

  if (conflicting.length === 0) return [];

  // Fetch content from both branches for conflicting files (limit to first 10)
  const filesToFetch = conflicting.slice(0, 10);
  const results = await Promise.allSettled(
    filesToFetch.map(async (filename) => {
      const [baseFile, headFile] = await Promise.allSettled([
        ghFetch<{ content: string; encoding: string }>(
          token,
          `/repos/${repo}/contents/${encodeURIComponent(filename)}?ref=${baseRef}`
        ),
        ghFetch<{ content: string; encoding: string }>(
          token,
          `/repos/${repo}/contents/${encodeURIComponent(filename)}?ref=${headRef}`
        ),
      ]);

      const decode = (r: PromiseSettledResult<{ content: string; encoding: string }>) => {
        if (r.status !== "fulfilled") return "(file not found on this branch)";
        if (r.value.encoding === "base64") {
          try { return atob(r.value.content.replace(/\n/g, "")); } catch { return r.value.content; }
        }
        return r.value.content;
      };

      return {
        filename,
        baseContent: decode(baseFile),
        headContent: decode(headFile),
      } as ConflictFile;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ConflictFile> => r.status === "fulfilled")
    .map((r) => r.value);
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

// ── Labels ────────────────────────────────────────────────────────

export interface RepoLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

export async function fetchRepoLabels(
  token: string,
  repo: string
): Promise<RepoLabel[]> {
  return ghFetch<RepoLabel[]>(token, `/repos/${repo}/labels?per_page=100`);
}

export async function addLabels(
  token: string,
  repo: string,
  number: number,
  labels: string[]
): Promise<void> {
  const res = await fetch(`${BASE}/repos/${repo}/issues/${number}/labels`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ labels }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
}

export async function removeLabel(
  token: string,
  repo: string,
  number: number,
  label: string
): Promise<void> {
  const res = await fetch(
    `${BASE}/repos/${repo}/issues/${number}/labels/${encodeURIComponent(label)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
}

// ── Quick Actions ─────────────────────────────────────────────────

export async function submitReview(
  token: string,
  repo: string,
  number: number,
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  body?: string
): Promise<void> {
  const payload: Record<string, string> = { event };
  if (body) payload.body = body;
  const res = await fetch(`${BASE}/repos/${repo}/pulls/${number}/reviews`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
}

export async function closePR(
  token: string,
  repo: string,
  number: number
): Promise<void> {
  const res = await fetch(`${BASE}/repos/${repo}/pulls/${number}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state: "closed" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
}

export async function mergePR(
  token: string,
  repo: string,
  number: number,
  method: "merge" | "squash" | "rebase" = "squash"
): Promise<void> {
  const res = await fetch(`${BASE}/repos/${repo}/pulls/${number}/merge`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ merge_method: method }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
}

// ── Timeline ──────────────────────────────────────────────────────

export interface TimelineEvent {
  id: number;
  event: string;
  created_at: string;
  actor?: { login: string; avatar_url: string };
  body?: string;
  commit_id?: string;
  state?: string;
  submitted_at?: string;
  html_url?: string;
  source?: { issue?: { number: number; title: string; html_url: string } };
  label?: { name: string; color: string };
  rename?: { from: string; to: string };
}

export async function fetchPRTimeline(
  token: string,
  repo: string,
  number: number
): Promise<TimelineEvent[]> {
  return ghFetchAllPages<TimelineEvent>(token, `/repos/${repo}/issues/${number}/timeline`);
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
