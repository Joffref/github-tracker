"use client";

import React, { useState, useEffect, useRef, type ReactNode } from "react";
import type { DashboardPR, CIStatus, ReviewState, PRFile, PRComment, ReviewComment } from "./github";
import { fetchUser, requestDeviceCode, pollForToken, fetchPRFiles, fetchIssueComments, fetchReviewComments, checkOnDevelop, postComment, postReviewComment, postNewReviewComment } from "./github";
import { MarkdownHooks as ReactMarkdown } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  usePRs,
  useFilters,
  useTheme,
  type FilterState,
  type GroupBy,
  type Theme,
} from "./hooks";
import { timeAgo } from "./constants";

// ── Icons (inline SVGs) ────────────────────────────────────────────

function GitHubIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg className="w-16 h-16 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Token Screen ───────────────────────────────────────────────────

interface TokenScreenProps {
  onConnect: (token: string) => void;
}

type AuthMode = "choose" | "oauth" | "pat";

interface OAuthState {
  userCode: string;
  verificationUri: string;
  deviceCode: string;
  interval: number;
  expiresAt: number;
}

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ?? "";

function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TokenScreen({ onConnect }: TokenScreenProps) {
  const [mode, setMode] = useState<AuthMode>(GITHUB_CLIENT_ID ? "choose" : "pat");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthState, setOauthState] = useState<OAuthState | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function startOAuth() {
    setLoading(true);
    setError(null);
    abortRef.current?.abort();

    try {
      const data = await requestDeviceCode(GITHUB_CLIENT_ID);
      setOauthState({
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        deviceCode: data.device_code,
        interval: data.interval,
        expiresAt: Date.now() + data.expires_in * 1000,
      });
      setMode("oauth");
      setLoading(false);

      // Start polling
      const controller = new AbortController();
      abortRef.current = controller;

      const accessToken = await pollForToken(
        GITHUB_CLIENT_ID,
        data.device_code,
        data.interval,
        controller.signal
      );
      onConnect(accessToken);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "OAuth failed");
      setLoading(false);
    }
  }

  function cancelOAuth() {
    abortRef.current?.abort();
    setOauthState(null);
    setMode("choose");
    setLoading(false);
    setError(null);
  }

  async function handleCopyCode() {
    if (!oauthState) return;
    await navigator.clipboard.writeText(oauthState.userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handlePATSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await fetchUser(token.trim());
      onConnect(token.trim());
    } catch {
      setError("Invalid token. Please check your token and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[var(--background)] via-[var(--surface)] to-[var(--background)]">
      <div className="w-full max-w-md rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl p-8 space-y-6 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center">
            <GitHubIcon className="w-9 h-9 text-[var(--foreground)]" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">GitHub Dashboard</h1>
          <p className="text-sm text-[var(--muted)] text-center">
            Sign in to view your pull requests across all repos
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Choose mode */}
        {mode === "choose" && (
          <div className="space-y-3">
            <button
              onClick={startOAuth}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--foreground)] text-[var(--background)] font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                "Connecting..."
              ) : (
                <>
                  <GitHubIcon className="w-4 h-4" />
                  Sign in with GitHub
                </>
              )}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-xs text-[var(--muted)]">or</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            <button
              onClick={() => setMode("pat")}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] font-medium text-sm hover:bg-[var(--border)] transition-all cursor-pointer"
            >
              Use a Personal Access Token
            </button>
          </div>
        )}

        {/* OAuth device flow */}
        {mode === "oauth" && oauthState && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-[var(--muted)]">
                Go to{" "}
                <a
                  href={oauthState.verificationUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] font-medium hover:underline"
                >
                  github.com/login/device
                </a>{" "}
                and enter this code:
              </p>
            </div>

            <button
              onClick={handleCopyCode}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all cursor-pointer group"
            >
              <span className="text-2xl font-mono font-bold tracking-[0.3em] text-[var(--foreground)]">
                {oauthState.userCode}
              </span>
              <span className="text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                {copied ? (
                  <CheckIcon />
                ) : (
                  <CopyIcon />
                )}
              </span>
            </button>

            <p className="text-xs text-[var(--muted)] text-center">
              {copied ? "Copied!" : "Click to copy"} &middot; Waiting for authorization...
            </p>

            <div className="flex justify-center">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>

            <button
              onClick={cancelOAuth}
              className="w-full py-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* PAT mode */}
        {mode === "pat" && (
          <form onSubmit={handlePATSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="token" className="text-sm font-medium text-[var(--foreground)]">
                Personal Access Token
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all text-sm font-mono"
                autoFocus
              />
              <p className="text-xs text-[var(--muted)]">
                Requires <code className="bg-[var(--surface)] px-1.5 py-0.5 rounded text-xs">repo</code> and{" "}
                <code className="bg-[var(--surface)] px-1.5 py-0.5 rounded text-xs">read:org</code> scopes
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--foreground)] text-[var(--background)] font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? "Connecting..." : "Connect"}
            </button>

            {GITHUB_CLIENT_ID && (
              <button
                type="button"
                onClick={() => { setMode("choose"); setError(null); }}
                className="w-full py-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                Back to sign in options
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────

interface HeaderProps {
  user: { login: string; avatar_url: string } | null;
  loading: boolean;
  enriching: boolean;
  lastRefreshed: Date | null;
  onRefresh: () => void;
  onDisconnect: () => void;
  prCount: number;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

function Header({
  user,
  loading,
  enriching,
  lastRefreshed,
  onRefresh,
  onDisconnect,
  prCount,
  theme,
  setTheme,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitHubIcon className="w-6 h-6 text-[var(--foreground)]" />
          <h1 className="text-base font-semibold tracking-tight">Dashboard</h1>
          {prCount > 0 && (
            <span className="text-xs bg-[var(--surface)] text-[var(--muted)] px-2 py-0.5 rounded-full font-medium">
              {prCount} PRs
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-[var(--muted)] hidden sm:block">
              {enriching ? "Updating..." : `Updated ${timeAgo(lastRefreshed.toISOString())}`}
            </span>
          )}
          <div className="flex items-center bg-[var(--surface)] rounded-lg p-0.5">
            {([["light", <SunIcon key="s" />], ["system", <MonitorIcon key="m" />], ["dark", <MoonIcon key="d" />]] as [Theme, React.ReactNode][]).map(([t, icon]) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${theme === t ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                title={t.charAt(0).toUpperCase() + t.slice(1)}
              >
                {icon}
              </button>
            ))}
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-[var(--surface)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer disabled:cursor-not-allowed"
            title="Refresh"
          >
            <RefreshIcon spinning={loading} />
          </button>
          {user && (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-7 h-7 rounded-full ring-1 ring-[var(--border)]"
              />
              <button
                onClick={onDisconnect}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Filter Bar ─────────────────────────────────────────────────────

interface FilterBarProps {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  availableRepos: string[];
  availableAuthors: string[];
}

const groupByOptions: { value: GroupBy; label: string }[] = [
  { value: "none", label: "Inbox" },
  { value: "repo", label: "Repo" },
  { value: "author", label: "Author" },
  { value: "status", label: "Status" },
];

function FilterBar({
  filters,
  setFilter,
  availableRepos,
  availableAuthors,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[var(--muted)]">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
          placeholder="Search PRs..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
        />
      </div>

      {/* Repo filter */}
      <select
        value={filters.repo ?? ""}
        onChange={(e) => setFilter("repo", e.target.value || null)}
        className="px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all cursor-pointer appearance-none"
      >
        <option value="">All repos</option>
        {availableRepos.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      {/* Author filter */}
      <select
        value={filters.author ?? ""}
        onChange={(e) => setFilter("author", e.target.value || null)}
        className="px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all cursor-pointer appearance-none"
      >
        <option value="">All authors</option>
        {availableAuthors.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      {/* Group by segmented control */}
      <div className="flex rounded-lg bg-[var(--surface)] border border-[var(--border)] p-0.5">
        {groupByOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter("groupBy", opt.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              filters.groupBy === opt.value
                ? "bg-[var(--foreground)] text-[var(--background)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Hide bots toggle */}
      <button
        onClick={() => setFilter("hideBots", !filters.hideBots)}
        className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
          filters.hideBots
            ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
            : "bg-[var(--surface)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)]"
        }`}
      >
        Hide bots
      </button>
    </div>
  );
}

// ── CI Status Badge ────────────────────────────────────────────────

function CIBadge({ status }: { status: CIStatus }) {
  const config: Record<CIStatus, { color: string; label: string; pulse?: boolean }> = {
    success: { color: "bg-emerald-500", label: "Passing" },
    failure: { color: "bg-red-500", label: "Failing" },
    pending: { color: "bg-amber-400", label: "Running", pulse: true },
    neutral: { color: "bg-gray-400", label: "Neutral" },
    unknown: { color: "bg-gray-300 dark:bg-gray-600", label: "Unknown" },
  };
  const c = config[status];
  return (
    <div className="flex items-center gap-1.5" title={`CI: ${c.label}`}>
      <span className={`w-2 h-2 rounded-full ${c.color} ${c.pulse ? "animate-pulse" : ""}`} />
      <span className="text-xs text-[var(--muted)]">{c.label}</span>
    </div>
  );
}

// ── Review Badge ───────────────────────────────────────────────────

function ReviewBadge({ state }: { state: ReviewState }) {
  const config: Record<ReviewState, { icon: ReactNode; color: string; label: string }> = {
    approved: { icon: <CheckIcon />, color: "text-emerald-500", label: "Approved" },
    changes_requested: { icon: <XIcon />, color: "text-red-500", label: "Changes requested" },
    review_required: { icon: <ClockIcon />, color: "text-amber-500", label: "Review required" },
    commented: { icon: <ClockIcon />, color: "text-blue-400", label: "Commented" },
    unknown: { icon: <ClockIcon />, color: "text-[var(--muted)]", label: "Pending" },
  };
  const c = config[state];
  return (
    <div className={`flex items-center gap-1 ${c.color}`} title={c.label}>
      {c.icon}
      <span className="text-xs">{c.label}</span>
    </div>
  );
}

// ── PR Card (list item) ────────────────────────────────────────────

function accentColor(pr: DashboardPR): string {
  if (pr.reviewState === "approved") return "border-l-emerald-500";
  if (pr.reviewState === "changes_requested") return "border-l-red-500";
  if (pr.ciStatus === "failure") return "border-l-red-500";
  if (pr.ciStatus === "pending") return "border-l-amber-400";
  if (pr.reviewState === "review_required") return "border-l-amber-400";
  return "border-l-transparent";
}

function PRCard({ pr, selected, onSelect }: { pr: DashboardPR; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border border-l-[3px] ${accentColor(pr)} transition-all duration-150 cursor-pointer ${
        selected
          ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 shadow-sm"
          : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--border-hover)] hover:shadow-sm"
      }`}
    >
      <div className="px-3 py-2.5 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pr.authorAvatar} alt={pr.author} className="w-7 h-7 rounded-full ring-1 ring-[var(--border)] shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-[var(--foreground)] leading-snug truncate">{pr.title}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-[var(--muted)] font-mono">{pr.repo.split("/")[1]}#{pr.number}</span>
            <span className="text-[11px] text-[var(--muted)]">{pr.author}</span>
            {pr.isDraft && <span className="text-[9px] uppercase tracking-wider font-semibold px-1 py-0 rounded bg-[var(--surface)] text-[var(--muted)]">Draft</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-[var(--muted)]">{timeAgo(pr.updatedAt)}</span>
          <div className="flex items-center gap-1.5">
            <CIBadge status={pr.ciStatus} />
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Side Panel ─────────────────────────────────────────────────────

// ── Thread helpers ─────────────────────────────────────────────────

function groupIntoThreads(comments: ReviewComment[]): { root: ReviewComment; replies: ReviewComment[] }[] {
  const roots: ReviewComment[] = [];
  const replyMap = new Map<number, ReviewComment[]>();

  for (const c of comments) {
    if (!c.in_reply_to_id) {
      roots.push(c);
    } else {
      const existing = replyMap.get(c.in_reply_to_id) ?? [];
      existing.push(c);
      replyMap.set(c.in_reply_to_id, existing);
    }
  }

  return roots
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((root) => ({
      root,
      replies: (replyMap.get(root.id) ?? []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    }));
}

// ── Thread Reply Form ─────────────────────────────────────────────

function ThreadReplyForm({ token, repo, prNumber, inReplyTo, onPosted }: {
  token: string;
  repo: string;
  prNumber: number;
  inReplyTo: number;
  onPosted: (c: ReviewComment) => void;
}) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const submit = async () => {
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const comment = await postReviewComment(token, repo, prNumber, body.trim(), inReplyTo);
      onPosted(comment);
      setBody("");
      setExpanded(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to post reply");
    } finally {
      setPosting(false);
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-xs text-[var(--accent)] hover:underline cursor-pointer mt-1"
      >
        Reply...
      </button>
    );
  }

  return (
    <div className="mt-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply..."
        rows={2}
        autoFocus
        className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-y transition-all"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          if (e.key === "Escape") { setExpanded(false); setBody(""); }
        }}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={submit}
          disabled={posting || !body.trim()}
          className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {posting ? "Posting..." : "Reply"}
        </button>
        <button
          onClick={() => { setExpanded(false); setBody(""); }}
          className="px-2.5 py-1 rounded-md text-xs text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Diff Hunk Preview ─────────────────────────────────────────────

function DiffHunkPreview({ hunk }: { hunk: string }) {
  const lines = hunk.split("\n");
  return (
    <pre className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 overflow-x-auto text-[11px] leading-relaxed font-mono my-1">
      {lines.map((line, i) => {
        let color = "text-[var(--foreground)]";
        if (line.startsWith("+")) color = "text-emerald-500";
        else if (line.startsWith("-")) color = "text-red-500";
        else if (line.startsWith("@@")) color = "text-blue-400";
        return (
          <div key={i} className={color}>
            {line}
          </div>
        );
      })}
    </pre>
  );
}

// ── Review Comment Thread ─────────────────────────────────────────

function ReviewThread({ thread, token, repo, prNumber, onReplyPosted }: {
  thread: { root: ReviewComment; replies: ReviewComment[] };
  token: string;
  repo: string;
  prNumber: number;
  onReplyPosted: (c: ReviewComment) => void;
}) {
  const allComments = [thread.root, ...thread.replies];

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      {/* File path + line */}
      <div className="bg-[var(--surface)] px-3 py-1.5 text-[11px] font-mono text-[var(--muted)] border-b border-[var(--border)] flex items-center gap-2">
        <span className="text-[var(--foreground)]">{thread.root.path}</span>
        {thread.root.line && <span>line {thread.root.line}</span>}
      </div>

      {/* Diff hunk context */}
      <div className="px-3 py-1 border-b border-[var(--border)] bg-[var(--background)]">
        <DiffHunkPreview hunk={thread.root.diff_hunk} />
      </div>

      {/* Comments */}
      <div className="px-3 py-2 space-y-2">
        {allComments.map((c) => (
          <div key={c.id} className="flex gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.user.avatar_url} alt={c.user.login} className="w-5 h-5 rounded-full shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-[var(--foreground)]">{c.user.login}</span>
                <span className="text-[10px] text-[var(--muted)]">{timeAgo(c.created_at)}</span>
              </div>
              <div className="text-[13px] text-[var(--foreground)] break-words prose-gh [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <Markdown content={c.body} />
              </div>
            </div>
          </div>
        ))}
        <ThreadReplyForm
          token={token}
          repo={repo}
          prNumber={prNumber}
          inReplyTo={thread.root.id}
          onPosted={onReplyPosted}
        />
      </div>
    </div>
  );
}

// ── Inline Comment Form for Diff ──────────────────────────────────

function InlineDiffCommentForm({ token, repo, prNumber, path, line, commitId, onPosted, onCancel }: {
  token: string;
  repo: string;
  prNumber: number;
  path: string;
  line: number;
  commitId: string;
  onPosted: (c: ReviewComment) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const comment = await postNewReviewComment(token, repo, prNumber, body.trim(), path, line, commitId);
      onPosted(comment);
      setBody("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--accent)]/30 rounded-lg px-3 py-2 my-1">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a review comment..."
        rows={2}
        autoFocus
        className="w-full rounded-md bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-y transition-all"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          if (e.key === "Escape") onCancel();
        }}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <div className="flex items-center gap-2 mt-1.5">
        <button
          onClick={submit}
          disabled={posting || !body.trim()}
          className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {posting ? "Posting..." : "Add comment"}
        </button>
        <button
          onClick={onCancel}
          className="px-2.5 py-1 rounded-md text-xs text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Diff View ─────────────────────────────────────────────────────

function DiffView({ file, reviewComments, token, repo, prNumber, commitId, onCommentPosted, isSeen, onToggleSeen }: {
  file: PRFile;
  reviewComments: ReviewComment[];
  token: string;
  repo: string;
  prNumber: number;
  commitId: string;
  onCommentPosted: (c: ReviewComment) => void;
  isSeen?: boolean;
  onToggleSeen?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(!!isSeen);
  const [commentLine, setCommentLine] = useState<number | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  if (!file.patch) {
    return (
      <div className={`border border-[var(--border)] rounded-lg overflow-hidden mb-3 ${isSeen ? "opacity-50" : ""}`}>
        <div className="flex items-center bg-[var(--surface)]">
          {onToggleSeen && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSeen(); }}
              className={`shrink-0 w-4 h-4 ml-3 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                isSeen ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border)] hover:border-[var(--accent)] text-transparent hover:text-[var(--muted)]"
              }`}
              title={isSeen ? "Mark as unseen" : "Mark as seen"}
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex-1 flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-[var(--border)]/50 transition-colors"
          >
            <ChevronIcon open={!collapsed} />
            <span className="text-xs font-mono text-[var(--foreground)] truncate flex-1">{file.filename}</span>
            <span className="text-xs shrink-0">
              <span className="text-emerald-500">+{file.additions}</span>{" "}
              <span className="text-red-500">-{file.deletions}</span>
            </span>
          </button>
        </div>
        {!collapsed && (
          <div className="px-3 py-2 text-xs text-[var(--muted)] italic">Binary file or no patch available</div>
        )}
      </div>
    );
  }

  // Parse patch into lines with line numbers
  const patchLines = file.patch.split("\n");
  type DiffLine = { content: string; type: "hunk" | "add" | "del" | "context"; newLine: number | null };
  const parsed: DiffLine[] = [];
  let newLineNum = 0;

  for (const raw of patchLines) {
    if (raw.startsWith("@@")) {
      // Extract new file start line: @@ -a,b +c,d @@
      const match = raw.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      if (match) newLineNum = parseInt(match[1], 10) - 1;
      parsed.push({ content: raw, type: "hunk", newLine: null });
    } else if (raw.startsWith("+")) {
      newLineNum++;
      parsed.push({ content: raw, type: "add", newLine: newLineNum });
    } else if (raw.startsWith("-")) {
      parsed.push({ content: raw, type: "del", newLine: null });
    } else {
      newLineNum++;
      parsed.push({ content: raw, type: "context", newLine: newLineNum });
    }
  }

  // Build a map of review comments by line number for this file
  const fileComments = reviewComments.filter((c) => c.path === file.filename);
  const commentsByLine = new Map<number, ReviewComment[]>();
  for (const c of fileComments) {
    const ln = c.line ?? c.original_line;
    if (ln != null) {
      const existing = commentsByLine.get(ln) ?? [];
      existing.push(c);
      commentsByLine.set(ln, existing);
    }
  }

  const bgForType = (type: DiffLine["type"]) => {
    switch (type) {
      case "add": return "bg-emerald-500/10";
      case "del": return "bg-red-500/10";
      case "hunk": return "bg-blue-500/5";
      default: return "";
    }
  };

  const textForType = (type: DiffLine["type"]) => {
    switch (type) {
      case "add": return "text-emerald-600 dark:text-emerald-400";
      case "del": return "text-red-600 dark:text-red-400";
      case "hunk": return "text-blue-500";
      default: return "text-[var(--foreground)]";
    }
  };

  return (
    <div className={`border border-[var(--border)] rounded-lg overflow-hidden mb-3 ${isSeen ? "opacity-50" : ""}`}>
      <div className="flex items-center bg-[var(--surface)]">
        {onToggleSeen && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSeen(); }}
            className={`shrink-0 w-4 h-4 ml-3 rounded border flex items-center justify-center cursor-pointer transition-colors ${
              isSeen ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border)] hover:border-[var(--accent)] text-transparent hover:text-[var(--muted)]"
            }`}
            title={isSeen ? "Mark as unseen" : "Mark as seen"}
          >
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex-1 flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-[var(--border)]/50 transition-colors"
        >
          <ChevronIcon open={!collapsed} />
          <span className={`shrink-0 w-2 h-2 rounded-full ${
            file.status === "added" ? "bg-emerald-500" : file.status === "removed" ? "bg-red-500" : "bg-amber-500"
          }`} />
          <span className="text-xs font-mono text-[var(--foreground)] truncate flex-1">{file.filename}</span>
          <span className="text-xs shrink-0">
            <span className="text-emerald-500">+{file.additions}</span>{" "}
            <span className="text-red-500">-{file.deletions}</span>
          </span>
        </button>
      </div>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] font-mono leading-[1.6] border-collapse">
            <tbody>
              {parsed.map((line, idx) => {
                const lineNum = line.newLine;
                const lineComments = lineNum ? commentsByLine.get(lineNum) : undefined;
                const showAddButton = (line.type === "add" || line.type === "context") && lineNum != null;

                return (
                  <React.Fragment key={idx}>
                    <tr
                      className={`${bgForType(line.type)} group`}
                      onMouseEnter={() => showAddButton && setHoveredLine(idx)}
                      onMouseLeave={() => setHoveredLine(null)}
                    >
                      {/* Gutter with + button */}
                      <td className="w-8 text-center select-none align-top relative">
                        {showAddButton && hoveredLine === idx && (
                          <button
                            onClick={() => setCommentLine(lineNum)}
                            className="absolute inset-0 flex items-center justify-center text-[var(--accent)] hover:bg-[var(--accent)]/20 rounded-sm cursor-pointer z-10"
                            title="Add comment"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M12 5v14m-7-7h14" strokeLinecap="round" />
                            </svg>
                          </button>
                        )}
                      </td>
                      {/* Line number */}
                      <td className="w-10 text-right pr-2 text-[var(--muted)] select-none align-top">
                        {lineNum ?? ""}
                      </td>
                      {/* Content */}
                      <td className={`px-3 whitespace-pre-wrap break-all ${textForType(line.type)}`}>
                        {line.content}
                      </td>
                    </tr>

                    {/* Inline comments at this line */}
                    {lineComments && lineComments.length > 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-1">
                          <div className="space-y-1 border-l-2 border-[var(--accent)]/30 pl-3 my-1">
                            {lineComments.map((c) => (
                              <div key={c.id} className="flex gap-2 bg-[var(--surface)] rounded-md px-2 py-1.5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={c.user.avatar_url} alt={c.user.login} className="w-4 h-4 rounded-full shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[11px] font-semibold text-[var(--foreground)]">{c.user.login}</span>
                                    <span className="text-[10px] text-[var(--muted)]">{timeAgo(c.created_at)}</span>
                                  </div>
                                  <div className="text-[12px] text-[var(--foreground)] break-words prose-gh [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                    <Markdown content={c.body} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Inline comment form */}
                    {commentLine === lineNum && lineNum != null && (
                      <tr>
                        <td colSpan={3} className="px-3 py-1">
                          <InlineDiffCommentForm
                            token={token}
                            repo={repo}
                            prNumber={prNumber}
                            path={file.filename}
                            line={lineNum}
                            commitId={commitId}
                            onPosted={(c) => {
                              onCommentPosted(c);
                              setCommentLine(null);
                            }}
                            onCancel={() => setCommentLine(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Side Panel ─────────────────────────────────────────────────────

// ── Seen Toolbar ──────────────────────────────────────────────────

function SeenToolbar({ seenCount, totalCount, showSeen, onToggleShowSeen, onMarkAllSeen, label }: {
  seenCount: number;
  totalCount: number;
  showSeen: boolean;
  onToggleShowSeen: () => void;
  onMarkAllSeen: () => void;
  label: string;
}) {
  const unseenCount = totalCount - seenCount;
  if (totalCount === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-3 text-xs">
      <span className="text-[var(--muted)]">
        {unseenCount} unseen{seenCount > 0 && ` · ${seenCount} seen`}
      </span>
      <div className="flex-1" />
      {seenCount > 0 && (
        <button
          onClick={onToggleShowSeen}
          className="text-[var(--accent)] hover:underline cursor-pointer"
        >
          {showSeen ? `Hide seen ${label}` : `Show seen ${label} (${seenCount})`}
        </button>
      )}
      {unseenCount > 0 && (
        <button
          onClick={onMarkAllSeen}
          className="text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
        >
          Mark all seen
        </button>
      )}
    </div>
  );
}

// ── Seen state helpers ─────────────────────────────────────────────

interface SeenState {
  commentIds: number[];
  filePaths: string[];
}

function getSeenKey(repo: string, number: number) {
  return `gh-seen-${repo}-${number}`;
}

function loadSeen(repo: string, number: number): SeenState {
  try {
    const raw = localStorage.getItem(getSeenKey(repo, number));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { commentIds: [], filePaths: [] };
}

function saveSeen(repo: string, number: number, state: SeenState) {
  try {
    localStorage.setItem(getSeenKey(repo, number), JSON.stringify(state));
  } catch { /* ignore */ }
}

function SidePanel({ pr, token, onClose }: { pr: DashboardPR; token: string; onClose: () => void }) {
  const [files, setFiles] = useState<PRFile[] | null>(null);
  const [issueComments, setIssueComments] = useState<PRComment[] | null>(null);
  const [reviewComments, setReviewComments] = useState<ReviewComment[] | null>(null);
  const [onDevelop, setOnDevelop] = useState<"yes" | "no" | "no-branch" | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"description" | "files" | "review" | "comments">("description");
  const [seen, setSeen] = useState<SeenState>(() => loadSeen(pr.repo, pr.number));
  const [showSeen, setShowSeen] = useState(true);

  const seenCommentIds = new Set(seen.commentIds);
  const seenFilePaths = new Set(seen.filePaths);

  const updateSeen = (next: SeenState) => {
    setSeen(next);
    saveSeen(pr.repo, pr.number, next);
  };

  const markCommentSeen = (id: number) => {
    if (seenCommentIds.has(id)) return;
    updateSeen({ ...seen, commentIds: [...seen.commentIds, id] });
  };

  const markFileSeen = (path: string) => {
    if (seenFilePaths.has(path)) return;
    updateSeen({ ...seen, filePaths: [...seen.filePaths, path] });
  };

  const markCommentUnseen = (id: number) => {
    updateSeen({ ...seen, commentIds: seen.commentIds.filter((i) => i !== id) });
  };

  const markFileUnseen = (path: string) => {
    updateSeen({ ...seen, filePaths: seen.filePaths.filter((p) => p !== path) });
  };

  const markAllCommentsSeen = () => {
    const allIds = [
      ...(issueComments ?? []).map((c) => c.id),
      ...(reviewComments ?? []).map((c) => c.id),
    ];
    updateSeen({ ...seen, commentIds: [...new Set([...seen.commentIds, ...allIds])] });
  };

  const markAllFilesSeen = () => {
    const allPaths = (files ?? []).map((f) => f.filename);
    updateSeen({ ...seen, filePaths: [...new Set([...seen.filePaths, ...allPaths])] });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTab("description");
    setOnDevelop(null);
    setSeen(loadSeen(pr.repo, pr.number));
    setShowSeen(true);
    Promise.allSettled([
      fetchPRFiles(token, pr.repo, pr.number),
      fetchIssueComments(token, pr.repo, pr.number),
      fetchReviewComments(token, pr.repo, pr.number),
      checkOnDevelop(token, pr.repo, pr.headSha),
    ]).then(([f, ic, rc, d]) => {
      if (cancelled) return;
      setFiles(f.status === "fulfilled" ? f.value : []);
      setIssueComments(ic.status === "fulfilled" ? ic.value : []);
      setReviewComments(rc.status === "fulfilled" ? rc.value : []);
      setOnDevelop(d.status === "fulfilled" ? d.value : null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [token, pr.repo, pr.number, pr.headSha]);

  const totalComments = (issueComments?.length ?? 0) + (reviewComments?.length ?? 0);

  const threads = reviewComments ? groupIntoThreads(reviewComments) : [];

  const handleReviewCommentPosted = (c: ReviewComment) => {
    setReviewComments((prev) => prev ? [...prev, c] : [c]);
  };

  const tabs = [
    { id: "description" as const, label: "Description" },
    { id: "files" as const, label: `Files${files ? ` (${files.length})` : ""}` },
    { id: "review" as const, label: "Review" },
    { id: "comments" as const, label: `Comments${totalComments > 0 ? ` (${totalComments})` : ""}` },
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--card)] border-l border-[var(--border)]">
      {/* Panel header */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-[var(--muted)] font-mono">{pr.repo}#{pr.number}</span>
              {pr.isDraft && <span className="text-[9px] uppercase tracking-wider font-semibold px-1 rounded bg-[var(--surface)] text-[var(--muted)]">Draft</span>}
              <ReviewBadge state={pr.reviewState} />
            </div>
            <h2 className="text-base font-semibold text-[var(--foreground)] leading-snug">{pr.title}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pr.authorAvatar} alt={pr.author} className="w-5 h-5 rounded-full" />
              <span className="text-xs text-[var(--muted)]">{pr.author}</span>
              <span className="text-xs text-[var(--muted)]">&middot; {timeAgo(pr.updatedAt)}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer shrink-0">
            <XIcon />
          </button>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <CIBadge status={pr.ciStatus} />
          {pr.hasConflicts && (
            <div className="flex items-center gap-1 text-red-500">
              <AlertIcon />
              <span className="text-xs">Conflicts</span>
            </div>
          )}
          {onDevelop === "yes" && (
            <div className="flex items-center gap-1 text-emerald-500">
              <CheckIcon />
              <span className="text-xs font-medium">On develop</span>
            </div>
          )}
          {onDevelop === "no" && (
            <div className="flex items-center gap-1 text-amber-500">
              <ClockIcon />
              <span className="text-xs font-medium">Not on develop</span>
            </div>
          )}
          {pr.labels.map((label) => (
            <span
              key={label.name}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}`, border: `1px solid #${label.color}30` }}
            >
              {label.name}
            </span>
          ))}
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs font-medium text-[var(--accent)] hover:underline"
          >
            Open on GitHub
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                tab === t.id
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-3 w-3/4 bg-[var(--surface)] rounded" />
            <div className="h-3 w-1/2 bg-[var(--surface)] rounded" />
            <div className="h-3 w-2/3 bg-[var(--surface)] rounded" />
            <div className="h-3 w-1/3 bg-[var(--surface)] rounded" />
          </div>
        ) : (
          <>
            {tab === "description" && (
              <div className="text-sm text-[var(--foreground)] break-words prose-gh [&>*:first-child]:mt-0">
                {pr.body ? <Markdown content={pr.body} /> : <span className="text-[var(--muted)] italic">No description</span>}
              </div>
            )}

            {tab === "files" && files && (
              <div>
                <SeenToolbar
                  seenCount={files.filter((f) => seenFilePaths.has(f.filename)).length}
                  totalCount={files.length}
                  showSeen={showSeen}
                  onToggleShowSeen={() => setShowSeen(!showSeen)}
                  onMarkAllSeen={markAllFilesSeen}
                  label="files"
                />
                <div className="space-y-0.5">
                  {files.map((f) => {
                    const isSeen = seenFilePaths.has(f.filename);
                    if (isSeen && !showSeen) return null;
                    return (
                      <div key={f.filename} className={`flex items-center gap-2 py-1.5 text-xs font-mono border-b border-[var(--border)]/50 last:border-0 group ${isSeen ? "opacity-50" : ""}`}>
                        <button
                          onClick={() => isSeen ? markFileUnseen(f.filename) : markFileSeen(f.filename)}
                          className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                            isSeen
                              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                              : "border-[var(--border)] hover:border-[var(--accent)] text-transparent hover:text-[var(--muted)]"
                          }`}
                          title={isSeen ? "Mark as unseen" : "Mark as seen"}
                        >
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        <span className={`shrink-0 w-2 h-2 rounded-full ${
                          f.status === "added" ? "bg-emerald-500" : f.status === "removed" ? "bg-red-500" : "bg-amber-500"
                        }`} />
                        <span className="text-[var(--foreground)] truncate flex-1">{f.filename}</span>
                        <span className="shrink-0">
                          <span className="text-emerald-500">+{f.additions}</span>{" "}
                          <span className="text-red-500">-{f.deletions}</span>
                        </span>
                      </div>
                    );
                  })}
                  {files.length === 0 && <p className="text-xs text-[var(--muted)] italic">No files changed</p>}
                </div>
              </div>
            )}

            {tab === "review" && files && reviewComments && (
              <div>
                <SeenToolbar
                  seenCount={files.filter((f) => seenFilePaths.has(f.filename)).length}
                  totalCount={files.length}
                  showSeen={showSeen}
                  onToggleShowSeen={() => setShowSeen(!showSeen)}
                  onMarkAllSeen={markAllFilesSeen}
                  label="files"
                />
                <div className="space-y-0">
                  {files.map((f) => {
                    const isSeen = seenFilePaths.has(f.filename);
                    if (isSeen && !showSeen) return null;
                    return (
                      <DiffView
                        key={f.filename}
                        file={f}
                        reviewComments={reviewComments}
                        token={token}
                        repo={pr.repo}
                        prNumber={pr.number}
                        commitId={pr.headSha}
                        onCommentPosted={handleReviewCommentPosted}
                        isSeen={isSeen}
                        onToggleSeen={() => isSeen ? markFileUnseen(f.filename) : markFileSeen(f.filename)}
                      />
                    );
                  })}
                  {files.length === 0 && <p className="text-xs text-[var(--muted)] italic">No files changed</p>}
                </div>
              </div>
            )}

            {tab === "comments" && (
              <div className="space-y-4">
                <SeenToolbar
                  seenCount={[...(issueComments ?? []), ...(reviewComments ?? [])].filter((c) => seenCommentIds.has(c.id)).length}
                  totalCount={totalComments}
                  showSeen={showSeen}
                  onToggleShowSeen={() => setShowSeen(!showSeen)}
                  onMarkAllSeen={markAllCommentsSeen}
                  label="comments"
                />

                {/* Issue comments (general PR comments) */}
                {issueComments && issueComments.length > 0 && (
                  <div className="space-y-3">
                    {issueComments.map((c) => {
                      const isSeen = seenCommentIds.has(c.id);
                      if (isSeen && !showSeen) return null;
                      return (
                        <div key={c.id} className={`flex gap-2.5 group ${isSeen ? "opacity-50" : ""}`}>
                          <button
                            onClick={() => isSeen ? markCommentUnseen(c.id) : markCommentSeen(c.id)}
                            className={`shrink-0 w-4 h-4 mt-1 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                              isSeen
                                ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                                : "border-[var(--border)] hover:border-[var(--accent)] text-transparent hover:text-[var(--muted)]"
                            }`}
                            title={isSeen ? "Mark as unseen" : "Mark as seen"}
                          >
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.user.avatar_url} alt={c.user.login} className="w-6 h-6 rounded-full shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0 bg-[var(--surface)] rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-[var(--foreground)]">{c.user.login}</span>
                              <span className="text-[10px] text-[var(--muted)]">{timeAgo(c.created_at)}</span>
                            </div>
                            <div className="text-[13px] text-[var(--foreground)] break-words prose-gh [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              <Markdown content={c.body} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Review comment threads */}
                {threads.length > 0 && (
                  <div className="space-y-3">
                    {issueComments && issueComments.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-px bg-[var(--border)]" />
                        <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium">Review threads</span>
                        <div className="flex-1 h-px bg-[var(--border)]" />
                      </div>
                    )}
                    {threads.map((thread) => {
                      const threadSeen = seenCommentIds.has(thread.root.id);
                      if (threadSeen && !showSeen) return null;
                      return (
                        <div key={thread.root.id} className={`relative ${threadSeen ? "opacity-50" : ""}`}>
                          <button
                            onClick={() => threadSeen ? markCommentUnseen(thread.root.id) : markCommentSeen(thread.root.id)}
                            className={`absolute -left-0.5 top-2 z-10 w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                              threadSeen
                                ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                                : "border-[var(--border)] hover:border-[var(--accent)] text-transparent hover:text-[var(--muted)]"
                            }`}
                            title={threadSeen ? "Mark as unseen" : "Mark as seen"}
                          >
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                          <div className="ml-5">
                            <ReviewThread
                              thread={thread}
                              token={token}
                              repo={pr.repo}
                              prNumber={pr.number}
                              onReplyPosted={handleReviewCommentPosted}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {totalComments === 0 && <p className="text-xs text-[var(--muted)] italic">No comments</p>}

                {/* Issue comment form */}
                <CommentForm
                  token={token}
                  repo={pr.repo}
                  number={pr.number}
                  onPosted={(c) => setIssueComments((prev) => prev ? [...prev, c] : [c])}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────

function Markdown({ content }: { content: string }) {
  // Strip HTML comments (e.g. <!-- CURSOR_SUMMARY -->)
  const cleaned = content.replace(/<!--[\s\S]*?-->/g, "").trim();
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        a: ({ ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline break-all" />
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = className?.startsWith("language-");
          return isBlock ? (
            <pre className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 overflow-x-auto my-4 text-[13px] leading-relaxed font-mono">
              <code className={className} {...props}>{children}</code>
            </pre>
          ) : (
            <code className="bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 rounded-md text-[13px] font-mono" {...props}>{children}</code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        img: ({ alt, ...props }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={alt ?? ""} {...props} className="max-w-full rounded-lg my-3 border border-[var(--border)]" />
        ),
        table: ({ ...props }) => (
          <div className="overflow-x-auto my-4 rounded-lg border border-[var(--border)]">
            <table className="text-[13px] w-full" {...props} />
          </div>
        ),
        th: ({ ...props }) => <th className="border-b border-[var(--border)] px-3 py-2 bg-[var(--surface)] text-left text-xs font-semibold" {...props} />,
        td: ({ ...props }) => <td className="border-b border-[var(--border)] px-3 py-2" {...props} />,
        ul: ({ ...props }) => <ul className="list-disc pl-6 my-3 space-y-1.5" {...props} />,
        ol: ({ ...props }) => <ol className="list-decimal pl-6 my-3 space-y-1.5" {...props} />,
        li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
        blockquote: ({ ...props }) => (
          <blockquote className="border-l-[3px] border-[var(--border)] pl-4 my-4 text-[var(--muted)]" {...props} />
        ),
        h1: ({ ...props }) => <h1 className="text-xl font-semibold mt-6 mb-3 pb-2 border-b border-[var(--border)]" {...props} />,
        h2: ({ ...props }) => <h2 className="text-lg font-semibold mt-5 mb-2 pb-1.5 border-b border-[var(--border)]" {...props} />,
        h3: ({ ...props }) => <h3 className="text-base font-semibold mt-4 mb-2" {...props} />,
        h4: ({ ...props }) => <h4 className="text-sm font-semibold mt-3 mb-1.5" {...props} />,
        p: ({ ...props }) => <p className="my-3 leading-relaxed" {...props} />,
        hr: () => <hr className="border-[var(--border)] my-6" />,
        input: ({ ...props }) => <input {...props} disabled className="mr-2 accent-[var(--accent)] align-middle" />,
        strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
      }}
    >
      {cleaned}
    </ReactMarkdown>
  );
}

// ── Comment Form ──────────────────────────────────────────────────

function CommentForm({ token, repo, number, onPosted }: { token: string; repo: string; number: number; onPosted: (c: PRComment) => void }) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const comment = await postComment(token, repo, number, body.trim());
      onPosted(comment);
      setBody("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="border-t border-[var(--border)] pt-4 mt-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a comment..."
        rows={3}
        className="w-full rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-y transition-all"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-[var(--muted)]">Markdown supported &middot; {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+Enter to submit</span>
        <button
          onClick={submit}
          disabled={posting || !body.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {posting ? "Posting..." : "Comment"}
        </button>
      </div>
    </div>
  );
}

// ── Skeleton Card ──────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] border-l-[3px] border-l-transparent px-3 py-2.5 flex items-center gap-3 animate-pulse">
      <div className="w-7 h-7 rounded-full bg-[var(--surface)]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 w-3/4 bg-[var(--surface)] rounded" />
        <div className="h-3 w-1/3 bg-[var(--surface)] rounded" />
      </div>
    </div>
  );
}

// ── PR Group ───────────────────────────────────────────────────────

function PRGroup({
  title,
  prs,
  selectedId,
  onSelect,
  defaultOpen = true,
}: {
  title: string;
  prs: DashboardPR[];
  selectedId: number | null;
  onSelect: (pr: DashboardPR) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const categoryColors: Record<string, string> = {
    "Needs My Attention": "bg-red-500/10 text-red-500",
    "Waiting on Others": "bg-amber-500/10 text-amber-500",
    Other: "bg-[var(--surface)] text-[var(--muted)]",
  };

  const badgeColor = categoryColors[title] ?? "bg-[var(--surface)] text-[var(--muted)]";

  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-2 px-1 cursor-pointer"
      >
        <ChevronIcon open={open} />
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>
          {prs.length}
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 pb-3">
          {prs
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .map((pr) => (
              <PRCard key={pr.id} pr={pr} selected={pr.id === selectedId} onSelect={() => onSelect(pr)} />
            ))}
        </div>
      )}
    </section>
  );
}

// ── Empty State ────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <InboxIcon />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-[var(--foreground)]">
          {hasFilters ? "No PRs match your filters" : "No open pull requests"}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {hasFilters ? "Try adjusting your filters or search terms" : "You're all caught up!"}
        </p>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────

interface DashboardProps {
  token: string;
  onDisconnect: () => void;
}

export function Dashboard({ token, onDisconnect }: DashboardProps) {
  const { prs, user, loading, enriching, error, refresh, lastRefreshed } = usePRs(token);
  const { filters, setFilter, filteredPRs, groupedPRs, availableRepos, availableAuthors } =
    useFilters(prs);
  const [selectedPR, setSelectedPR] = useState<DashboardPR | null>(null);
  const [theme, setTheme] = useTheme();

  const hasActiveFilters =
    !!filters.search || !!filters.repo || !!filters.author || !!filters.ciStatus || !!filters.reviewStatus;

  // Keep selectedPR in sync with updated PR data
  const currentSelected = selectedPR ? prs.find((p) => p.id === selectedPR.id) ?? selectedPR : null;

  return (
    <div className="h-screen flex flex-col bg-[var(--background)]">
      <Header
        user={user}
        loading={loading}
        enriching={enriching}
        lastRefreshed={lastRefreshed}
        onRefresh={refresh}
        onDisconnect={onDisconnect}
        prCount={filteredPRs.length}
        theme={theme}
        setTheme={setTheme}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: PR list */}
        <div className={`${currentSelected ? "w-[420px] shrink-0" : "flex-1 max-w-5xl mx-auto"} flex flex-col overflow-hidden transition-all duration-200`}>
          <div className="px-4 shrink-0">
            {error && (
              <div className="mt-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={onDisconnect} className="text-xs font-medium hover:underline cursor-pointer">Disconnect</button>
              </div>
            )}
            <FilterBar
              filters={filters}
              setFilter={setFilter}
              availableRepos={availableRepos}
              availableAuthors={availableAuthors}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {loading ? (
              <div className="space-y-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filteredPRs.length === 0 ? (
              <EmptyState hasFilters={hasActiveFilters} />
            ) : (
              <div className="space-y-1">
                {Array.from(groupedPRs.entries()).map(([group, groupPRs]) => (
                  <PRGroup
                    key={group}
                    title={group}
                    prs={groupPRs}
                    selectedId={currentSelected?.id ?? null}
                    onSelect={setSelectedPR}
                    defaultOpen={group !== "Other"}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Side panel */}
        {currentSelected && (
          <div className="flex-1 min-w-0">
            <SidePanel
              key={currentSelected.id}
              pr={currentSelected}
              token={token}
              onClose={() => setSelectedPR(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
