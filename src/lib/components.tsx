"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import type { DashboardPR, CIStatus, ReviewState, PRFile, PRComment, ReviewComment, ConflictFile, CheckRun, WorkflowJob, WorkflowStep, DailyActivity, ThreadResolution, AnalyticsData } from "./github";
import { fetchUser, requestDeviceCode, pollForToken, fetchPRFiles, fetchPRCommits, fetchIssueComments, fetchReviewComments, checkOnDevelop, postComment, postReviewComment, postNewReviewComment, fetchConflictFiles, fetchRepoLabels, addLabels, removeLabel, submitReview, mergePR, closePR, fetchCheckRuns, rerunFailedChecks, fetchWorkflowJobs, fetchJobLogs, fetchUserOrgs, fetchDailyActivity, fetchAnalytics, fetchThreadResolutions, resolveReviewThread, unresolveReviewThread, requestReviewers, removeReviewRequest, fetchCollaborators, type RepoLabel, type PRCommit, type ReviewThreadInfo } from "./github";
import { MarkdownHooks as ReactMarkdown } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import hljs from "highlight.js/lib/core";
import hljsJavascript from "highlight.js/lib/languages/javascript";
import hljsTypescript from "highlight.js/lib/languages/typescript";
import hljsPython from "highlight.js/lib/languages/python";
import hljsYaml from "highlight.js/lib/languages/yaml";
import hljsJson from "highlight.js/lib/languages/json";
import hljsGo from "highlight.js/lib/languages/go";
import hljsBash from "highlight.js/lib/languages/bash";
import hljsRust from "highlight.js/lib/languages/rust";
import hljsCss from "highlight.js/lib/languages/css";
import hljsXml from "highlight.js/lib/languages/xml";
import hljsMarkdown from "highlight.js/lib/languages/markdown";
import hljsSql from "highlight.js/lib/languages/sql";
import hljsDockerfile from "highlight.js/lib/languages/dockerfile";
import hljsNginx from "highlight.js/lib/languages/nginx";

hljs.registerLanguage("javascript", hljsJavascript);
hljs.registerLanguage("typescript", hljsTypescript);
hljs.registerLanguage("python", hljsPython);
hljs.registerLanguage("yaml", hljsYaml);
hljs.registerLanguage("json", hljsJson);
hljs.registerLanguage("go", hljsGo);
hljs.registerLanguage("bash", hljsBash);
hljs.registerLanguage("rust", hljsRust);
hljs.registerLanguage("css", hljsCss);
hljs.registerLanguage("xml", hljsXml);
hljs.registerLanguage("markdown", hljsMarkdown);
hljs.registerLanguage("sql", hljsSql);
hljs.registerLanguage("dockerfile", hljsDockerfile);
hljs.registerLanguage("nginx", hljsNginx);
import {
  usePRs,
  useFilters,
  useLocalStorage,
  type FilterState,
  type GroupBy,
  type Theme,
  useDocumentVisibility,
  useRelativeTime,
} from "./hooks";
import { timeAgo, SIDEPANEL_REFRESH_INTERVAL_MS, ACTIVITY_REFRESH_INTERVAL_MS } from "./constants";
import { cn } from "@/lib/utils";

// shadcn/ui imports
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

function RefreshIcon({ spinning = false, rotations = 0 }: { spinning?: boolean; rotations?: number }) {
  return (
    <svg
      className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`}
      style={!spinning ? { transform: `rotate(${rotations * 360}deg)`, transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)" } : undefined}
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

function CircleXIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
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
    <svg className="w-16 h-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
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
  theme: Theme;
  setTheme: (t: Theme) => void;
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

function SlidersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="4" y1="21" x2="4" y2="14" strokeLinecap="round" />
      <line x1="4" y1="10" x2="4" y2="3" strokeLinecap="round" />
      <line x1="12" y1="21" x2="12" y2="12" strokeLinecap="round" />
      <line x1="12" y1="8" x2="12" y2="3" strokeLinecap="round" />
      <line x1="20" y1="21" x2="20" y2="16" strokeLinecap="round" />
      <line x1="20" y1="12" x2="20" y2="3" strokeLinecap="round" />
      <line x1="1" y1="14" x2="7" y2="14" strokeLinecap="round" />
      <line x1="9" y1="8" x2="15" y2="8" strokeLinecap="round" />
      <line x1="17" y1="16" x2="23" y2="16" strokeLinecap="round" />
    </svg>
  );
}

function MergeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M6 21V9a9 9 0 009 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" strokeLinecap="round" />
      <line x1="22" y1="11" x2="16" y2="11" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      <line x1="6" y1="8" x2="6.01" y2="8" strokeLinecap="round" />
      <line x1="10" y1="8" x2="10.01" y2="8" strokeLinecap="round" />
      <line x1="14" y1="8" x2="14.01" y2="8" strokeLinecap="round" />
      <line x1="18" y1="8" x2="18.01" y2="8" strokeLinecap="round" />
      <line x1="6" y1="12" x2="6.01" y2="12" strokeLinecap="round" />
      <line x1="10" y1="12" x2="10.01" y2="12" strokeLinecap="round" />
      <line x1="14" y1="12" x2="14.01" y2="12" strokeLinecap="round" />
      <line x1="18" y1="12" x2="18.01" y2="12" strokeLinecap="round" />
      <line x1="8" y1="16" x2="16" y2="16" strokeLinecap="round" />
    </svg>
  );
}

export function TokenScreen({ onConnect, theme, setTheme }: TokenScreenProps) {
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted to-background animate-fade-in">
      <Card className="w-full max-w-md shadow-xl backdrop-blur-sm animate-scale-in">
        <CardHeader className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <GitHubIcon className="w-9 h-9 text-foreground" />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">GitHub Dashboard</CardTitle>
          <CardDescription className="text-center">
            Sign in to view your pull requests across all repos
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Choose mode */}
          {mode === "choose" && (
            <div className="space-y-3">
              <Button
                onClick={startOAuth}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  "Connecting..."
                ) : (
                  <>
                    <GitHubIcon className="w-4 h-4" />
                    Sign in with GitHub
                  </>
                )}
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              <Button
                variant="outline"
                onClick={() => setMode("pat")}
                className="w-full"
                size="lg"
              >
                Use a Personal Access Token
              </Button>
            </div>
          )}

          {/* OAuth device flow */}
          {mode === "oauth" && oauthState && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Go to{" "}
                  <a
                    href={oauthState.verificationUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-medium hover:underline"
                  >
                    github.com/login/device
                  </a>{" "}
                  and enter this code:
                </p>
              </div>

              <button
                onClick={handleCopyCode}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-muted border border-border hover:border-border/80 transition-all cursor-pointer group"
              >
                <span className="text-2xl font-mono font-bold tracking-[0.3em] text-foreground">
                  {oauthState.userCode}
                </span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {copied ? (
                    <CheckIcon />
                  ) : (
                    <CopyIcon />
                  )}
                </span>
              </button>

              <p className="text-xs text-muted-foreground text-center">
                {copied ? "Copied!" : "Click to copy"} &middot; Waiting for authorization...
              </p>

              <div className="flex justify-center">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>

              <Button
                variant="ghost"
                onClick={cancelOAuth}
                className="w-full text-xs text-muted-foreground"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* PAT mode */}
          {mode === "pat" && (
            <form onSubmit={handlePATSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="token" className="text-sm font-medium text-foreground">
                  Personal Access Token
                </label>
                <Input
                  id="token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="font-mono"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Requires <code className="bg-muted px-1.5 py-0.5 rounded text-xs">repo</code> and{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">read:org</code> scopes
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading || !token.trim()}
                className="w-full"
                size="lg"
              >
                {loading ? "Connecting..." : "Connect"}
              </Button>

              {GITHUB_CLIENT_ID && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setMode("choose"); setError(null); }}
                  className="w-full text-xs text-muted-foreground"
                >
                  Back to sign in options
                </Button>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      {/* Theme toggle */}
      <div className="fixed bottom-4 right-4">
        <ToggleGroup
          value={[theme]}
          onValueChange={(values) => {
            if (values.length > 0) setTheme(values[0] as Theme);
          }}
          className="bg-card/80 backdrop-blur-sm border border-border rounded-lg p-0.5 shadow-lg"
        >
          {([["light", <SunIcon key="s" />], ["system", <MonitorIcon key="m" />], ["dark", <MoonIcon key="d" />]] as [Theme, React.ReactNode][]).map(([t, icon]) => (
            <ToggleGroupItem
              key={t}
              value={t}
              size="sm"
              className={cn(
                "p-1.5 rounded-md",
                theme === t ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {icon}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
  org: string | null;
  orgs: Array<{ login: string; avatar_url: string }>;
  onOrgChange: (org: string | null) => void;
}

function HeaderTimestamp({ lastRefreshed, enriching }: { lastRefreshed: Date | null; enriching: boolean }) {
  const { text, isStale } = useRelativeTime(lastRefreshed);
  if (!lastRefreshed) return null;
  return (
    <span className={cn(
      "text-xs hidden sm:block transition-colors",
      isStale ? "text-amber-500" : "text-muted-foreground"
    )}>
      {enriching ? "Updating..." : `Updated ${text}`}
    </span>
  );
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
  org,
  orgs,
  onOrgChange,
}: HeaderProps) {
  const [rotations, setRotations] = useState(0);
  const handleRefresh = useCallback(() => {
    setRotations((r) => r + 1);
    onRefresh();
  }, [onRefresh]);
  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border animate-fade-in-down">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitHubIcon className="w-6 h-6 text-foreground" />
          <h1 className="text-base font-semibold tracking-tight">Dashboard</h1>
          {prCount > 0 && (
            <Badge variant="secondary">
              {prCount} PRs
            </Badge>
          )}
          {orgs.length > 0 && (
            <select
              value={org ?? ""}
              onChange={(e) => onOrgChange(e.target.value || null)}
              className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground cursor-pointer hover:bg-muted transition-colors"
            >
              <option value="">All orgs</option>
              {orgs.map((o) => (
                <option key={o.login} value={o.login}>{o.login}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-3">
          <HeaderTimestamp lastRefreshed={lastRefreshed} enriching={enriching} />
          <ToggleGroup
            value={[theme]}
            onValueChange={(values) => {
              if (values.length > 0) setTheme(values[0] as Theme);
            }}
            className="bg-muted rounded-lg p-0.5"
          >
            {([["light", <SunIcon key="s" />], ["system", <MonitorIcon key="m" />], ["dark", <MoonIcon key="d" />]] as [Theme, React.ReactNode][]).map(([t, icon]) => (
              <ToggleGroupItem
                key={t}
                value={t}
                size="sm"
                className={cn(
                  "p-1.5 rounded-md",
                  theme === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {icon}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={loading}
                />
              }
            >
              <RefreshIcon spinning={loading} rotations={rotations} />
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          {user && (
            <div className="flex items-center gap-2">
              <Avatar size="sm">
                <AvatarImage src={user.avatar_url} alt={user.login} />
                <AvatarFallback>{user.login.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="xs"
                onClick={onDisconnect}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Disconnect
              </Button>
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
  availableLabels: string[];
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
  availableLabels,
}: FilterBarProps) {
  const [advanced, setAdvanced] = useState(false);

  const advancedFilterCount =
    (filters.label ? 1 : 0) +
    (filters.hideBots ? 1 : 0) +
    (filters.hideOnDevelop ? 1 : 0) +
    (filters.hasConflicts !== null ? 1 : 0);

  return (
    <div className="py-3 space-y-2">
      {/* Primary row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
            <SearchIcon />
          </div>
          <Input
            type="text"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            placeholder="Search PRs..."
            className="pl-9"
          />
        </div>

        {/* Repo filter */}
        <Select
          value={filters.repo ?? ""}
          onValueChange={(v) => setFilter("repo", v || null)}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder="All repos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All repos</SelectItem>
            {availableRepos.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Author filter */}
        <Select
          value={filters.author ?? ""}
          onValueChange={(v) => setFilter("author", v || null)}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder="All authors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All authors</SelectItem>
            {availableAuthors.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Group by segmented control */}
        <ToggleGroup
          value={[filters.groupBy]}
          onValueChange={(values) => {
            if (values.length > 0) setFilter("groupBy", values[0] as GroupBy);
          }}
          className="bg-muted border border-border rounded-lg p-0.5"
        >
          {groupByOptions.map((opt) => (
            <ToggleGroupItem
              key={opt.value}
              value={opt.value}
              size="sm"
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium",
                filters.groupBy === opt.value
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Advanced toggle button */}
        <Button
          variant={advanced || advancedFilterCount > 0 ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setAdvanced(!advanced)}
          className="gap-1.5"
        >
          <SlidersIcon />
          <span className="text-xs">Filters</span>
          {advancedFilterCount > 0 && (
            <span className="ml-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {advancedFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Advanced filters row */}
      {advanced && (
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-1 px-1 bg-muted/50 rounded-lg border border-border/50">
          {/* Label */}
          {availableLabels.length > 0 && (
            <Select
              value={filters.label ?? ""}
              onValueChange={(v) => setFilter("label", v || null)}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="Label" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any label</SelectItem>
                {availableLabels.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Hide bots toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={filters.hideBots}
              onCheckedChange={(checked) => setFilter("hideBots", !!checked)}
              id="hide-bots"
            />
            <label
              htmlFor="hide-bots"
              className="text-xs font-medium text-muted-foreground cursor-pointer select-none"
            >
              Hide bots
            </label>
          </div>

          {/* Hide on develop toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={filters.hideOnDevelop}
              onCheckedChange={(checked) => setFilter("hideOnDevelop", !!checked)}
              id="hide-on-develop"
            />
            <label
              htmlFor="hide-on-develop"
              className="text-xs font-medium text-muted-foreground cursor-pointer select-none"
            >
              Hide on develop
            </label>
          </div>

          {/* Conflicts filter */}
          <Select
            value={filters.hasConflicts === null ? "" : filters.hasConflicts ? "yes" : "no"}
            onValueChange={(v) => setFilter("hasConflicts", v === "" ? null : v === "yes")}
          >
            <SelectTrigger size="sm" className={cn(filters.hasConflicts !== null && "border-orange-500/50 text-orange-500")}>
              <SelectValue placeholder="Conflicts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any</SelectItem>
              <SelectItem value="yes">Has conflicts</SelectItem>
              <SelectItem value="no">No conflicts</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear all */}
          {advancedFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground ml-auto"
              onClick={() => {
                setFilter("label", null);
                setFilter("hideBots", false);
                setFilter("hideOnDevelop", false);
                setFilter("hasConflicts", null);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
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
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span className={`w-2 h-2 rounded-full ${c.color} ${c.pulse ? "animate-pulse" : ""}`} />
      {c.label}
    </Badge>
  );
}

// ── Review Badge ───────────────────────────────────────────────────

function ReviewBadge({ state }: { state: ReviewState }) {
  const config: Record<ReviewState, { icon: ReactNode; color: string; label: string }> = {
    approved: { icon: <CheckIcon />, color: "text-emerald-500", label: "Approved" },
    changes_requested: { icon: <XIcon />, color: "text-red-500", label: "Changes requested" },
    review_required: { icon: <ClockIcon />, color: "text-amber-500", label: "Review required" },
    commented: { icon: <ClockIcon />, color: "text-blue-400", label: "Commented" },
    unknown: { icon: <ClockIcon />, color: "text-muted-foreground", label: "Pending" },
  };
  const c = config[state];
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", c.color)}>
      {c.icon}
      {c.label}
    </Badge>
  );
}

// ── PR Card (list item) ────────────────────────────────────────────

function accentColor(pr: DashboardPR): string {
  if (pr.reviewState === "changes_requested") return "border-l-red-500";
  if (pr.ciStatus === "failure") return "border-l-red-500";
  if (pr.hasConflicts) return "border-l-orange-500";
  if (pr.reviewState === "approved") return "border-l-emerald-500";
  if (pr.ciStatus === "pending") return "border-l-amber-400";
  if (pr.reviewState === "review_required") return "border-l-amber-400";
  return "border-l-transparent";
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// ── PR Seen tracking (list level) ─────────────────────────────────

const PR_SEEN_KEY = "gh-pr-seen-at";

function loadPRSeenMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PR_SEEN_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function markPRSeen(pr: DashboardPR) {
  try {
    const map = loadPRSeenMap();
    map[`${pr.repo}#${pr.number}`] = pr.updatedAt;
    localStorage.setItem(PR_SEEN_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

function unmarkPRSeen(pr: DashboardPR) {
  try {
    const map = loadPRSeenMap();
    delete map[`${pr.repo}#${pr.number}`];
    localStorage.setItem(PR_SEEN_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

function PRAgeIndicator({ createdAt }: { createdAt: string }) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days < 1) return null;
  const color = days >= 14 ? "text-red-500 bg-red-500/10" : days >= 7 ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground bg-muted";
  return <span className={cn("text-[9px] font-medium px-1 py-0 rounded-full", color)}>{days}d</span>;
}

function PRCard({ pr, selected, seen, onSelect, onToggleSeen, batchMode, batchSelected, onBatchToggle }: {
  pr: DashboardPR;
  selected: boolean;
  seen: boolean;
  onSelect: () => void;
  onToggleSeen: () => void;
  batchMode: boolean;
  batchSelected: boolean;
  onBatchToggle: () => void;
}) {
  const [swiped, setSwiped] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    currentX.current = e.clientX;
    dragging.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startX.current) return;
    currentX.current = e.clientX;
    const dx = currentX.current - startX.current;
    if (Math.abs(dx) > 5) dragging.current = true;
    if (cardRef.current && dx > 0) {
      cardRef.current.style.transform = `translateX(${Math.min(dx, 80)}px)`;
      cardRef.current.style.transition = "none";
    }
  };

  const handlePointerUp = () => {
    const dx = currentX.current - startX.current;
    if (cardRef.current) {
      cardRef.current.style.transition = "transform 200ms ease";
      cardRef.current.style.transform = "";
    }
    if (dx > 60) {
      setSwiped(true);
      onToggleSeen();
    }
    startX.current = 0;
    currentX.current = 0;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (dragging.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onSelect();
  };

  const [swiping, setSwiping] = useState(false);

  const handlePointerDownWrapped = (e: React.PointerEvent) => {
    handlePointerDown(e);
    setSwiping(true);
  };

  const handlePointerUpWrapped = (e: React.PointerEvent) => {
    void e;
    handlePointerUp();
    setTimeout(() => setSwiping(false), 200);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe reveal background — only visible during active swipe */}
      {swiping && (
        <div className={cn(
          "absolute inset-0 flex items-center pl-4 rounded-xl",
          seen ? "bg-amber-500/20" : "bg-emerald-500/20"
        )}>
          <span className="text-xs font-medium text-muted-foreground">
            {seen ? "Mark unseen" : "Mark seen"}
          </span>
        </div>
      )}
      <div
        ref={cardRef}
        onPointerDown={handlePointerDownWrapped}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpWrapped}
        onPointerLeave={() => {
          if (startX.current && cardRef.current) {
            cardRef.current.style.transition = "transform 200ms ease";
            cardRef.current.style.transform = "";
            startX.current = 0;
          }
          setSwiping(false);
        }}
        onClick={handleClick}
        className={cn(
          "relative w-full text-left rounded-xl border border-l-[3px] transition-all duration-150 cursor-pointer group/card",
          accentColor(pr),
          selected
            ? "bg-accent/10 border-accent/30 shadow-sm"
            : "bg-card border-border hover:border-border/80 hover:shadow-sm",
          seen && !selected && "opacity-50",
          swiped && "transition-opacity duration-300"
        )}
      >
        <div className="px-3 py-2.5 flex items-center gap-3">
          {batchMode && (
            <input
              type="checkbox"
              checked={batchSelected}
              onChange={(e) => { e.stopPropagation(); onBatchToggle(); }}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer"
            />
          )}
          <Avatar size="sm">
            <AvatarImage src={pr.authorAvatar} alt={pr.author} />
            <AvatarFallback>{pr.author.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground leading-snug truncate">{pr.title}</h3>
            <div className="flex items-center gap-x-2 gap-y-0.5 mt-0.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground font-mono shrink-0">{pr.repo.split("/")[1]}#{pr.number}</span>
              <span className="text-[11px] text-muted-foreground shrink-0 truncate max-w-[120px]">{pr.author}</span>
              <PRAgeIndicator createdAt={pr.createdAt} />
              {pr.isDraft && <Badge variant="secondary" className="text-[9px] uppercase tracking-wider font-semibold px-1 py-0 h-auto shrink-0">Draft</Badge>}
              {pr.hasConflicts && <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-semibold px-1 py-0 h-auto shrink-0 gap-0.5 text-orange-500 border-orange-500/30"><AlertIcon /> Conflicts</Badge>}
              {pr.onDevelop === "yes" && <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-semibold px-1 py-0 h-auto text-emerald-500 border-emerald-500/30 shrink-0">On develop</Badge>}
              {(pr.additions > 0 || pr.deletions > 0) && (
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  <span className="text-green-500">+{pr.additions}</span>
                  <span className="mx-0.5">/</span>
                  <span className="text-red-500">-{pr.deletions}</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle seen button on hover */}
            <button
              className="opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSeen();
              }}
              title={seen ? "Mark as unseen" : "Mark as seen"}
            >
              {seen ? (
                <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M3 12s2-6 9-6 9 6 9 6-2 6-9 6-9-6-9-6z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-muted-foreground">{timeAgo(pr.updatedAt)}</span>
              <div className="flex items-center gap-1.5">
                <CIBadge status={pr.ciStatus} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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

  const submit = async () => {
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const comment = await postReviewComment(token, repo, prNumber, body.trim(), inReplyTo);
      onPosted(comment);
      setBody("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to post reply");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-1 flex gap-2 items-start">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Reply..."
        rows={1}
        className="text-xs min-h-8 flex-1 resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      <Button
        size="xs"
        onClick={submit}
        disabled={posting || !body.trim()}
        className="shrink-0 mt-0.5"
      >
        {posting ? "..." : "Reply"}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Diff Hunk Preview ─────────────────────────────────────────────

function DiffHunkPreview({ hunk, filename }: { hunk: string; filename?: string }) {
  const lines = hunk.split("\n");
  const lang = filename ? langForFile(filename) : null;
  const parsed = lines.map((line) => ({
    content: line,
    type: line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : line.startsWith("@@") ? "hunk" : "context",
  }));
  const highlighted = React.useMemo(() => highlightDiffLines(parsed, lang), [hunk, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <pre className="bg-muted border border-border rounded-md px-3 py-2 overflow-x-auto text-[11px] leading-relaxed font-mono my-1">
      {lines.map((line, i) => {
        let color = "text-foreground";
        if (line.startsWith("+")) color = "text-emerald-500";
        else if (line.startsWith("-")) color = "text-red-500";
        else if (line.startsWith("@@")) color = "text-blue-400";
        return (
          <div key={i} className={color} dangerouslySetInnerHTML={{ __html: highlighted[i] ?? escapeHtml(line) }} />
        );
      })}
    </pre>
  );
}

// ── Review Comment Thread ─────────────────────────────────────────

function ReviewThread({ thread, token, repo, prNumber, onReplyPosted, threadInfo, onResolutionChanged }: {
  thread: { root: ReviewComment; replies: ReviewComment[] };
  token: string;
  repo: string;
  prNumber: number;
  onReplyPosted: (c: ReviewComment) => void;
  threadInfo?: ReviewThreadInfo;
  onResolutionChanged?: (threadId: string, resolved: boolean) => void;
}) {
  const allComments = [thread.root, ...thread.replies];
  const [collapsed, setCollapsed] = useState(threadInfo?.isResolved ?? false);
  const [resolving, setResolving] = useState(false);
  const isResolved = threadInfo?.isResolved ?? false;

  const toggleResolve = async () => {
    if (!threadInfo) return;
    setResolving(true);
    try {
      if (isResolved) {
        await unresolveReviewThread(token, threadInfo.id);
        onResolutionChanged?.(threadInfo.id, false);
      } else {
        await resolveReviewThread(token, threadInfo.id);
        onResolutionChanged?.(threadInfo.id, true);
      }
    } catch {
      // silently fail
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden transition-colors",
      isResolved ? "border-green-500/30 bg-green-500/[0.02]" : "border-border"
    )}>
      {/* File path + line + resolve button */}
      <div className="bg-muted px-3 py-1.5 text-[11px] font-mono text-muted-foreground border-b border-border flex items-center gap-2">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-1 hover:text-foreground transition-colors">
          <svg className={cn("w-3 h-3 transition-transform", collapsed ? "" : "rotate-90")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-foreground truncate">{thread.root.path}</span>
        {thread.root.line && <span className="shrink-0">line {thread.root.line}</span>}
        <span className="text-[10px] text-muted-foreground shrink-0">{allComments.length} {allComments.length === 1 ? "comment" : "comments"}</span>
        <div className="flex-1" />
        {isResolved && (
          <span className="text-[10px] text-green-600 dark:text-green-400 font-medium flex items-center gap-0.5 shrink-0">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Resolved
          </span>
        )}
        {threadInfo && (
          <Button
            variant="ghost"
            size="xs"
            className={cn(
              "text-[10px] h-5 px-1.5 shrink-0",
              isResolved ? "text-muted-foreground hover:text-amber-600" : "text-muted-foreground hover:text-green-600"
            )}
            onClick={toggleResolve}
            disabled={resolving}
          >
            {resolving ? "..." : isResolved ? "Unresolve" : "Resolve"}
          </Button>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Diff hunk context */}
          <div className="px-3 py-1 border-b border-border bg-background">
            <DiffHunkPreview hunk={thread.root.diff_hunk} filename={thread.root.path} />
          </div>

          {/* Comments */}
          <div className="px-3 py-2 space-y-2">
            {allComments.map((c, i) => (
              <div key={c.id} className={cn("flex gap-2", i > 0 && "border-t border-border/50 pt-2")}>
                <Avatar size="sm" className="size-5 mt-0.5">
                  <AvatarImage src={c.user.avatar_url} alt={c.user.login} />
                  <AvatarFallback>{c.user.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-foreground">{c.user.login}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                  </div>
                  <div className="text-[13px] text-foreground break-words prose-gh [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <Markdown content={c.body} />
                  </div>
                </div>
              </div>
            ))}
            {!isResolved && (
              <ThreadReplyForm
                token={token}
                repo={repo}
                prNumber={prNumber}
                inReplyTo={thread.root.id}
                onPosted={onReplyPosted}
              />
            )}
          </div>
        </>
      )}
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
    <div className="bg-muted border border-accent/30 rounded-lg px-3 py-2 my-1">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a review comment..."
        rows={2}
        autoFocus
        className="text-xs min-h-12"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          if (e.key === "Escape") onCancel();
        }}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <div className="flex items-center gap-2 mt-1.5">
        <Button
          size="xs"
          onClick={submit}
          disabled={posting || !body.trim()}
        >
          {posting ? "Posting..." : "Add comment"}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Diff View ─────────────────────────────────────────────────────

const EXT_TO_LANG: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", mts: "typescript",
  py: "python", pyx: "python",
  yml: "yaml", yaml: "yaml",
  json: "json", jsonc: "json",
  go: "go",
  sh: "bash", bash: "bash", zsh: "bash",
  rs: "rust",
  css: "css", scss: "css",
  html: "xml", htm: "xml", xml: "xml", svg: "xml",
  md: "markdown", mdx: "markdown",
  sql: "sql",
  dockerfile: "dockerfile",
  nginx: "nginx", conf: "nginx",
  toml: "yaml", ini: "yaml",
};

function langForFile(filename: string): string | null {
  const base = filename.split("/").pop() ?? "";
  if (base.toLowerCase() === "dockerfile") return "dockerfile";
  const ext = base.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? null;
}

function highlightCode(code: string, lang: string | null): string {
  if (!lang) return escapeHtml(code);
  try {
    return hljs.highlight(code, { language: lang }).value;
  } catch {
    return escapeHtml(code);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightDiffLines(lines: Array<{ content: string; type: string }>, lang: string | null): string[] {
  if (!lang) return lines.map((l) => escapeHtml(l.content));
  // Strip the +/- prefix, join, highlight as a block, then split back
  const stripped = lines.map((l) => {
    if (l.type === "hunk") return l.content;
    return l.content.length > 0 ? l.content.slice(1) : "";
  });
  const block = stripped.join("\n");
  let highlighted: string;
  try {
    highlighted = hljs.highlight(block, { language: lang }).value;
  } catch {
    return lines.map((l) => escapeHtml(l.content));
  }
  // Split back by newline, re-add the prefix
  const hLines = highlighted.split("\n");
  return lines.map((l, i) => {
    const prefix = l.type === "hunk" ? "" : (l.content[0] ?? " ");
    return escapeHtml(prefix) + (hLines[i] ?? "");
  });
}

// ── File Tree View (GitLab-inspired) ──────────────────────────────

type TreeNode = {
  name: string;
  path: string;
  type: "folder" | "file";
  file?: PRFile;
  children: TreeNode[];
  additions: number;
  deletions: number;
  commentCount: number;
};

function buildFileTree(files: PRFile[], reviewComments: ReviewComment[]): TreeNode[] {
  const root: TreeNode[] = [];
  const commentsByFile = new Map<string, number>();
  for (const c of reviewComments) {
    if (c.path) commentsByFile.set(c.path, (commentsByFile.get(c.path) ?? 0) + 1);
  }

  for (const f of files) {
    const parts = f.filename.split("/");
    let current = root;
    let pathSoFar = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part;
      const isFile = i === parts.length - 1;

      let node = current.find((n) => n.name === part && n.type === (isFile ? "file" : "folder"));
      if (!node) {
        node = {
          name: part,
          path: pathSoFar,
          type: isFile ? "file" : "folder",
          file: isFile ? f : undefined,
          children: [],
          additions: isFile ? f.additions : 0,
          deletions: isFile ? f.deletions : 0,
          commentCount: isFile ? (commentsByFile.get(f.filename) ?? 0) : 0,
        };
        current.push(node);
      }
      if (!isFile) {
        node.additions += f.additions;
        node.deletions += f.deletions;
        node.commentCount += commentsByFile.get(f.filename) ?? 0;
        current = node.children;
      }
    }
  }

  // Collapse single-child folders (like GitLab does)
  function collapse(nodes: TreeNode[]): TreeNode[] {
    return nodes.map((node) => {
      if (node.type === "folder") {
        node.children = collapse(node.children);
        if (node.children.length === 1 && node.children[0].type === "folder") {
          const child = node.children[0];
          return { ...child, name: `${node.name}/${child.name}`, children: collapse(child.children) };
        }
      }
      return node;
    });
  }

  // Sort: folders first, then alphabetically
  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map((n) => ({ ...n, children: n.type === "folder" ? sortNodes(n.children) : n.children }));
  }

  return sortNodes(collapse(root));
}

function FolderIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H2V6z" />
      <path fillRule="evenodd" d="M2 9h16l-1.5 6H3.5L2 9z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}

function FileIcon({ status }: { status: string }) {
  const color = status === "added" ? "text-emerald-500" : status === "removed" ? "text-red-500" : "text-muted-foreground";
  return (
    <svg className={`w-4 h-4 shrink-0 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileStatusBadge({ status }: { status: string }) {
  const config = {
    added: { label: "A", bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    removed: { label: "D", bg: "bg-red-500/15 text-red-600 dark:text-red-400" },
    renamed: { label: "R", bg: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
    modified: { label: "M", bg: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  }[status] ?? { label: "M", bg: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };

  return (
    <span className={`text-[9px] font-bold px-1 py-0 rounded ${config.bg} shrink-0`}>
      {config.label}
    </span>
  );
}

function TreeNodeRow({
  node,
  depth,
  expandedFolders,
  toggleFolder,
  selectedFile,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  selectedFile: string | null;
  onSelectFile: (filename: string) => void;
}) {
  const isFolder = node.type === "folder";
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = !isFolder && selectedFile === node.file?.filename;

  return (
    <>
      <button
        onClick={() => isFolder ? toggleFolder(node.path) : node.file && onSelectFile(node.file.filename)}
        className={cn(
          "w-full flex items-center gap-1.5 py-[3px] pr-2 text-left transition-colors rounded-sm group",
          isSelected
            ? "bg-primary/10 text-primary"
            : "hover:bg-muted/80 text-foreground",
        )}
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
      >
        {isFolder ? (
          <>
            <ChevronIcon open={isExpanded} />
            <FolderIcon open={isExpanded} />
          </>
        ) : (
          <>
            <span className="w-4" /> {/* Spacer to align with folder chevrons */}
            <FileIcon status={node.file?.status ?? "modified"} />
          </>
        )}

        <span className={cn(
          "text-[12px] font-mono truncate flex-1",
          isFolder && "font-medium",
        )}>
          {node.name}
        </span>

        {node.commentCount > 0 && (
          <span className="text-[9px] font-medium bg-primary/15 text-primary px-1 rounded-full shrink-0">
            {node.commentCount}
          </span>
        )}

        {!isFolder && node.file && (
          <>
            <FileStatusBadge status={node.file.status} />
            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
              <span className="text-emerald-500">+{node.additions}</span>
              {" "}
              <span className="text-red-500">-{node.deletions}</span>
            </span>
          </>
        )}
      </button>

      {isFolder && isExpanded && node.children.map((child) => (
        <TreeNodeRow
          key={child.path}
          node={child}
          depth={depth + 1}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
        />
      ))}
    </>
  );
}

function FileTreeView({
  files,
  reviewComments,
  selectedFile,
  onSelectFile,
}: {
  files: PRFile[];
  reviewComments: ReviewComment[];
  selectedFile: string | null;
  onSelectFile: (filename: string) => void;
}) {
  const tree = useMemo(() => buildFileTree(files, reviewComments), [files, reviewComments]);

  // Start with all folders expanded
  const allFolderPaths = useMemo(() => {
    const paths = new Set<string>();
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.type === "folder") {
          paths.add(n.path);
          collect(n.children);
        }
      }
    }
    collect(tree);
    return paths;
  }, [tree]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(allFolderPaths);
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);

  // Update expanded folders when tree changes (new files appear)
  useEffect(() => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      for (const p of allFolderPaths) next.add(p);
      return next;
    });
  }, [allFolderPaths]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => setExpandedFolders(new Set()), []);
  const expandAll = useCallback(() => setExpandedFolders(new Set(allFolderPaths)), [allFolderPaths]);

  const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-4">
      {/* Tree header */}
      <button
        onClick={() => setIsTreeCollapsed(!isTreeCollapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted/80 transition-colors cursor-pointer"
      >
        <ChevronIcon open={!isTreeCollapsed} />
        <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-medium text-foreground">
          {files.length} {files.length === 1 ? "file" : "files"} changed
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
          <span className="text-emerald-500">+{totalAdditions}</span>
          {" "}
          <span className="text-red-500">-{totalDeletions}</span>
        </span>
      </button>

      {!isTreeCollapsed && (
        <div className="border-t border-border">
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-2 py-1 border-b border-border/50 bg-muted/30">
            <button
              onClick={(e) => { e.stopPropagation(); expandAll(); }}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
              title="Expand all"
            >
              Expand all
            </button>
            <span className="text-muted-foreground/30 text-[10px]">|</span>
            <button
              onClick={(e) => { e.stopPropagation(); collapseAll(); }}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
              title="Collapse all"
            >
              Collapse all
            </button>
          </div>

          {/* Tree body */}
          <div className="py-1 max-h-[300px] overflow-y-auto">
            {tree.map((node) => (
              <TreeNodeRow
                key={node.path}
                node={node}
                depth={0}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChangesTabContent({
  files,
  reviewComments,
  token,
  pr,
  onCommentPosted,
}: {
  files: PRFile[];
  reviewComments: ReviewComment[];
  token: string;
  pr: DashboardPR;
  onCommentPosted: (c: ReviewComment) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const diffRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleSelectFile = useCallback((filename: string) => {
    setSelectedFile(filename);
    const el = diffRefs.current.get(filename);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  if (files.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No files changed</p>;
  }

  return (
    <div className="space-y-0">
      <FileTreeView
        files={files}
        reviewComments={reviewComments}
        selectedFile={selectedFile}
        onSelectFile={handleSelectFile}
      />
      {files.map((f) => (
        <div key={f.filename} ref={(el) => { if (el) diffRefs.current.set(f.filename, el); }}>
          <DiffView
            file={f}
            reviewComments={reviewComments}
            token={token}
            repo={pr.repo}
            prNumber={pr.number}
            commitId={pr.headSha}
            onCommentPosted={onCommentPosted}
            isSeen={false}
            onToggleSeen={() => {}}
          />
        </div>
      ))}
    </div>
  );
}

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
      <div className={cn("border border-border rounded-lg overflow-hidden mb-3", isSeen && "opacity-50")}>
        <div className="flex items-center bg-muted">
          {onToggleSeen && (
            <div className="ml-3">
              <Checkbox
                checked={!!isSeen}
                onCheckedChange={() => onToggleSeen()}
              />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex-1 flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-border/50 transition-colors"
          >
            <ChevronIcon open={!collapsed} />
            <span className="text-xs font-mono text-foreground truncate flex-1">{file.filename}</span>
            <span className="text-xs shrink-0">
              <span className="text-emerald-500">+{file.additions}</span>{" "}
              <span className="text-red-500">-{file.deletions}</span>
            </span>
          </button>
        </div>
        {!collapsed && (
          <div className="px-3 py-2 text-xs text-muted-foreground italic">Binary file or no patch available</div>
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

  const lang = langForFile(file.filename);
  const highlightedLines = React.useMemo(() => highlightDiffLines(parsed, lang), [file.patch]); // eslint-disable-line react-hooks/exhaustive-deps

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
      default: return "text-foreground";
    }
  };

  return (
    <div className={cn("border border-border rounded-lg overflow-hidden mb-3", isSeen && "opacity-50")}>
      <div className="flex items-center bg-muted">
        {onToggleSeen && (
          <div className="ml-3">
            <Checkbox
              checked={!!isSeen}
              onCheckedChange={() => onToggleSeen()}
            />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex-1 flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-border/50 transition-colors"
        >
          <ChevronIcon open={!collapsed} />
          <span className={`shrink-0 w-2 h-2 rounded-full ${
            file.status === "added" ? "bg-emerald-500" : file.status === "removed" ? "bg-red-500" : "bg-amber-500"
          }`} />
          <span className="text-xs font-mono text-foreground truncate flex-1">{file.filename}</span>
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
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  onClick={() => setCommentLine(lineNum)}
                                  className="absolute inset-0 flex items-center justify-center text-primary hover:bg-primary/20 rounded-sm cursor-pointer z-10"
                                />
                              }
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path d="M12 5v14m-7-7h14" strokeLinecap="round" />
                              </svg>
                            </TooltipTrigger>
                            <TooltipContent>Add comment</TooltipContent>
                          </Tooltip>
                        )}
                      </td>
                      {/* Line number */}
                      <td className="w-10 text-right pr-2 text-muted-foreground select-none align-top">
                        {lineNum ?? ""}
                      </td>
                      {/* Content */}
                      <td
                        className={`px-3 whitespace-pre-wrap break-all ${textForType(line.type)}`}
                        dangerouslySetInnerHTML={{ __html: highlightedLines[idx] ?? escapeHtml(line.content) }}
                      />
                    </tr>

                    {/* Inline comments at this line */}
                    {lineComments && lineComments.length > 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-1">
                          <div className="space-y-1 border-l-2 border-accent/30 pl-3 my-1">
                            {lineComments.map((c) => (
                              <div key={c.id} className="flex gap-2 bg-muted rounded-md px-2 py-1.5">
                                <Avatar size="sm" className="size-4 mt-0.5">
                                  <AvatarImage src={c.user.avatar_url} alt={c.user.login} />
                                  <AvatarFallback>{c.user.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[11px] font-semibold text-foreground">{c.user.login}</span>
                                    <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                                  </div>
                                  <div className="text-[12px] text-foreground break-words prose-gh [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
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

// ── Conflict File View ────────────────────────────────────────────

// Compute LCS-based diff hunks between two line arrays
function computeDiffHunks(baseLines: string[], headLines: string[], contextLines = 3) {
  // Myers-like LCS to find matching lines
  const n = baseLines.length;
  const m = headLines.length;

  // Build LCS table (optimized for typical file sizes)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = baseLines[i] === headLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Trace through to produce diff operations
  type DiffOp = { type: "equal"; baseLine: number; headLine: number; text: string }
    | { type: "delete"; baseLine: number; text: string }
    | { type: "insert"; headLine: number; text: string };

  const ops: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && baseLines[i] === headLines[j]) {
      ops.push({ type: "equal", baseLine: i, headLine: j, text: baseLines[i] });
      i++; j++;
    } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
      ops.push({ type: "insert", headLine: j, text: headLines[j] });
      j++;
    } else {
      ops.push({ type: "delete", baseLine: i, text: baseLines[i] });
      i++;
    }
  }

  // Group into hunks with context
  type Hunk = { ops: DiffOp[]; baseStart: number; headStart: number };
  const hunks: Hunk[] = [];
  const changedIndices = ops.map((op, idx) => op.type !== "equal" ? idx : -1).filter(idx => idx >= 0);
  if (changedIndices.length === 0) return [];

  let hunkStart = Math.max(0, changedIndices[0] - contextLines);
  let hunkEnd = Math.min(ops.length - 1, changedIndices[0] + contextLines);

  for (let c = 1; c < changedIndices.length; c++) {
    const nextStart = Math.max(0, changedIndices[c] - contextLines);
    const nextEnd = Math.min(ops.length - 1, changedIndices[c] + contextLines);
    if (nextStart <= hunkEnd + 1) {
      // Merge overlapping hunks
      hunkEnd = nextEnd;
    } else {
      // Emit previous hunk
      const hunkOps = ops.slice(hunkStart, hunkEnd + 1);
      const firstOp = hunkOps[0];
      hunks.push({
        ops: hunkOps,
        baseStart: firstOp.type === "insert" ? (firstOp.headLine) : (firstOp as any).baseLine,
        headStart: firstOp.type === "delete" ? (firstOp as any).baseLine : (firstOp as any).headLine ?? 0,
      });
      hunkStart = nextStart;
      hunkEnd = nextEnd;
    }
  }
  // Emit last hunk
  const lastHunkOps = ops.slice(hunkStart, hunkEnd + 1);
  const firstOp = lastHunkOps[0];
  hunks.push({
    ops: lastHunkOps,
    baseStart: firstOp.type === "insert" ? 0 : (firstOp as any).baseLine,
    headStart: firstOp.type === "delete" ? 0 : (firstOp as any).headLine ?? 0,
  });

  return hunks;
}

function ConflictFileView({ file, baseRef, headRef }: { file: ConflictFile; baseRef: string; headRef: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<"unified" | "side-by-side">("unified");

  const baseLines = file.baseContent.split("\n");
  const headLines = file.headContent.split("\n");

  const hunks = useMemo(() => computeDiffHunks(baseLines, headLines), [file.baseContent, file.headContent]);

  const changeStats = useMemo(() => {
    let additions = 0, deletions = 0;
    for (const hunk of hunks) {
      for (const op of hunk.ops) {
        if (op.type === "insert") additions++;
        if (op.type === "delete") deletions++;
      }
    }
    return { additions, deletions };
  }, [hunks]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center bg-muted">
        <Button variant="ghost" size="sm" onClick={() => setCollapsed(!collapsed)} className="flex-1 justify-start gap-2 rounded-none font-mono text-xs h-9">
          <ChevronIcon open={!collapsed} />
          <AlertIcon />
          <span className="truncate">{file.filename}</span>
          <span className="text-[10px] font-mono ml-2 flex gap-1.5">
            <span className="text-green-500">+{changeStats.additions}</span>
            <span className="text-red-500">-{changeStats.deletions}</span>
          </span>
        </Button>
        {!collapsed && (
          <div className="flex items-center gap-0.5 mr-2 bg-background rounded-md p-0.5">
            {([["unified", "Unified"], ["side-by-side", "Split"]] as const).map(([v, label]) => (
              <Button
                key={v}
                variant={view === v ? "secondary" : "ghost"}
                size="sm"
                className="text-[10px] h-6 px-2"
                onClick={() => setView(v)}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          {hunks.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground italic">Files are identical — conflict may be whitespace or encoding only.</div>
          ) : view === "unified" ? (
            <pre className="text-[11px] font-mono leading-[1.7]">
              {hunks.map((hunk, hi) => (
                <div key={hi}>
                  {hi > 0 && (
                    <div className="px-2 py-1 bg-muted/50 text-muted-foreground text-[10px] border-y border-border/30 select-none">⋯</div>
                  )}
                  {hunk.ops.map((op, oi) => {
                    if (op.type === "equal") {
                      return (
                        <div key={oi} className="px-2 flex">
                          <span className="w-8 text-right pr-2 text-muted-foreground select-none shrink-0">{op.baseLine + 1}</span>
                          <span className="w-8 text-right pr-2 text-muted-foreground select-none shrink-0">{op.headLine + 1}</span>
                          <span className="w-4 text-center text-muted-foreground select-none shrink-0"> </span>
                          <span className="flex-1 whitespace-pre-wrap break-all text-foreground">{op.text}</span>
                        </div>
                      );
                    }
                    if (op.type === "delete") {
                      return (
                        <div key={oi} className="px-2 flex bg-red-500/10">
                          <span className="w-8 text-right pr-2 text-red-400/70 select-none shrink-0">{op.baseLine + 1}</span>
                          <span className="w-8 text-right pr-2 text-muted-foreground select-none shrink-0" />
                          <span className="w-4 text-center text-red-500 select-none shrink-0 font-bold">−</span>
                          <span className="flex-1 whitespace-pre-wrap break-all text-red-600 dark:text-red-400">{op.text}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={oi} className="px-2 flex bg-emerald-500/10">
                        <span className="w-8 text-right pr-2 text-muted-foreground select-none shrink-0" />
                        <span className="w-8 text-right pr-2 text-emerald-400/70 select-none shrink-0">{op.headLine + 1}</span>
                        <span className="w-4 text-center text-emerald-500 select-none shrink-0 font-bold">+</span>
                        <span className="flex-1 whitespace-pre-wrap break-all text-emerald-600 dark:text-emerald-400">{op.text}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </pre>
          ) : (
            <div className="flex divide-x divide-border min-w-[600px]">
              {/* Base side */}
              <div className="flex-1 min-w-0">
                <div className="bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border sticky top-0 z-10">{baseRef}</div>
                <pre className="text-[11px] font-mono leading-[1.7]">
                  {hunks.map((hunk, hi) => (
                    <div key={hi}>
                      {hi > 0 && <div className="px-2 py-1 bg-muted/50 text-muted-foreground text-[10px] border-y border-border/30 select-none">⋯</div>}
                      {hunk.ops.map((op, oi) => {
                        if (op.type === "insert") {
                          return <div key={oi} className="px-2 flex bg-muted/20"><span className="w-8" /><span className="flex-1"> </span></div>;
                        }
                        const lineNum = op.type === "equal" ? op.baseLine : op.baseLine;
                        return (
                          <div key={oi} className={cn("px-2 flex", op.type === "delete" ? "bg-red-500/10" : "")}>
                            <span className="w-8 text-right pr-2 text-muted-foreground select-none shrink-0">{lineNum + 1}</span>
                            <span className={cn("flex-1 whitespace-pre-wrap break-all", op.type === "delete" ? "text-red-600 dark:text-red-400" : "text-foreground")}>{op.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </pre>
              </div>
              {/* Head side */}
              <div className="flex-1 min-w-0">
                <div className="bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border sticky top-0 z-10">{headRef}</div>
                <pre className="text-[11px] font-mono leading-[1.7]">
                  {hunks.map((hunk, hi) => (
                    <div key={hi}>
                      {hi > 0 && <div className="px-2 py-1 bg-muted/50 text-muted-foreground text-[10px] border-y border-border/30 select-none">⋯</div>}
                      {hunk.ops.map((op, oi) => {
                        if (op.type === "delete") {
                          return <div key={oi} className="px-2 flex bg-muted/20"><span className="w-8" /><span className="flex-1"> </span></div>;
                        }
                        const lineNum = op.type === "equal" ? op.headLine : op.headLine;
                        return (
                          <div key={oi} className={cn("px-2 flex", op.type === "insert" ? "bg-emerald-500/10" : "")}>
                            <span className="w-8 text-right pr-2 text-muted-foreground select-none shrink-0">{lineNum + 1}</span>
                            <span className={cn("flex-1 whitespace-pre-wrap break-all", op.type === "insert" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>{op.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Label Editor ──────────────────────────────────────────────────

function LabelEditor({
  currentLabels,
  token,
  repo,
  prNumber,
  onLabelsChanged,
}: {
  currentLabels: Array<{ name: string; color: string }>;
  token: string;
  repo: string;
  prNumber: number;
  onLabelsChanged: (labels: Array<{ name: string; color: string }>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [repoLabels, setRepoLabels] = useState<RepoLabel[] | null>(null);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !repoLabels) {
      fetchRepoLabels(token, repo).then(setRepoLabels).catch(() => setRepoLabels([]));
    }
  }, [open, repoLabels, token, repo]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentNames = new Set(currentLabels.map((l) => l.name));

  const toggleLabel = async (label: RepoLabel) => {
    setUpdating(label.name);
    try {
      if (currentNames.has(label.name)) {
        await removeLabel(token, repo, prNumber, label.name);
        onLabelsChanged(currentLabels.filter((l) => l.name !== label.name));
      } else {
        await addLabels(token, repo, prNumber, [label.name]);
        onLabelsChanged([...currentLabels, { name: label.name, color: label.color }]);
      }
    } catch {
      // silently fail
    } finally {
      setUpdating(null);
    }
  };

  const filtered = repoLabels?.filter((l) =>
    !search || l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative inline-block" ref={containerRef}>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-[10px] text-muted-foreground gap-1"
        onClick={() => setOpen(!open)}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Edit
      </Button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-56 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <Input
              type="text"
              placeholder="Filter labels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {!repoLabels ? (
              <div className="p-2 text-xs text-muted-foreground text-center">Loading...</div>
            ) : filtered && filtered.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground text-center">No labels found</div>
            ) : (
              filtered?.map((label) => {
                const active = currentNames.has(label.name);
                const isUpdating = updating === label.name;
                return (
                  <button
                    key={label.name}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left hover:bg-accent transition-colors cursor-pointer",
                      isUpdating && "opacity-50 pointer-events-none"
                    )}
                    onClick={() => toggleLabel(label)}
                  >
                    <Checkbox checked={active} className="pointer-events-none" />
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: `#${label.color}` }}
                    />
                    <span className="truncate flex-1">{label.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quick Actions ─────────────────────────────────────────────────

function QuickActions({ pr, token, onRefresh, onOptimisticUpdate }: { pr: DashboardPR; token: string; onRefresh: () => void; onOptimisticUpdate?: (patch: Partial<DashboardPR>) => void }) {
  const [action, setAction] = useState<"request_changes" | "merge" | "close" | null>(null);
  const [mergeMethod, setMergeMethod] = useState<"squash" | "merge" | "rebase">("squash");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const doApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await submitReview(token, pr.repo, pr.number, "APPROVE");
      setSuccess("Approved!");
      onOptimisticUpdate?.({ reviewState: "approved" });
      onRefresh();
      setTimeout(() => setSuccess(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const doSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (action === "request_changes") {
        if (!body.trim()) { setError("Body required"); setLoading(false); return; }
        await submitReview(token, pr.repo, pr.number, "REQUEST_CHANGES", body);
        setSuccess("Changes requested!");
      } else if (action === "merge") {
        await mergePR(token, pr.repo, pr.number, mergeMethod);
        setSuccess("Merged!");
      } else if (action === "close") {
        if (body.trim()) {
          await postComment(token, pr.repo, pr.number, body);
        }
        await closePR(token, pr.repo, pr.number);
        setSuccess("Closed!");
      }
      setBody("");
      if (action === "request_changes") {
        onOptimisticUpdate?.({ reviewState: "changes_requested" });
      }
      onRefresh();
      setTimeout(() => { setSuccess(null); setAction(null); }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger render={<Button variant="outline" size="xs" className="text-[11px] h-6 gap-0.5 px-1.5" onClick={doApprove} disabled={loading} />}>
            <CheckIcon /> Approve
          </TooltipTrigger>
          <TooltipContent>Approve this PR</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={
            <Button
              variant={action === "request_changes" ? "default" : "outline"}
              size="xs"
              className="text-[11px] h-6 gap-0.5 px-1.5"
              onClick={() => setAction(action === "request_changes" ? null : "request_changes")}
            />
          }>
            <XIcon /> Changes
          </TooltipTrigger>
          <TooltipContent>Request changes</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={
            <Button
              variant={action === "merge" ? "default" : "outline"}
              size="xs"
              className="text-[11px] h-6 gap-0.5 px-1.5"
              onClick={() => setAction(action === "merge" ? null : "merge")}
            />
          }>
            <MergeIcon /> Merge
          </TooltipTrigger>
          <TooltipContent>Merge this PR</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={
            <Button
              variant={action === "close" ? "destructive" : "outline"}
              size="xs"
              className="text-[11px] h-6 gap-0.5 px-1.5"
              onClick={() => setAction(action === "close" ? null : "close")}
            />
          }>
            <CircleXIcon /> Close
          </TooltipTrigger>
          <TooltipContent>Close this PR</TooltipContent>
        </Tooltip>
        {success && <span className="text-[11px] text-emerald-500 ml-1">{success}</span>}
        {error && <span className="text-[11px] text-red-500 ml-1">{error}</span>}
      </div>
      {action === "request_changes" && (
        <div className="flex gap-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What needs to change?" rows={2} className="text-xs flex-1" />
          <div className="flex flex-col gap-1">
            <Button size="sm" onClick={doSubmit} disabled={loading} className="text-xs">{loading ? "..." : "Submit"}</Button>
            <Button variant="ghost" size="sm" onClick={() => setAction(null)} className="text-xs">Cancel</Button>
          </div>
        </div>
      )}
      {action === "merge" && (
        <div className="flex items-center gap-2">
          <select
            value={mergeMethod}
            onChange={(e) => setMergeMethod(e.target.value as "squash" | "merge" | "rebase")}
            className="text-xs h-7 rounded border border-border bg-background px-1.5 outline-none"
          >
            <option value="squash">Squash and merge</option>
            <option value="merge">Create a merge commit</option>
            <option value="rebase">Rebase and merge</option>
          </select>
          <Button size="sm" onClick={doSubmit} disabled={loading} className="text-xs">{loading ? "Merging..." : "Confirm"}</Button>
          <Button variant="ghost" size="sm" onClick={() => setAction(null)} className="text-xs">Cancel</Button>
        </div>
      )}
      {action === "close" && (
        <div className="flex gap-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Leave a comment (optional)..." rows={2} className="text-xs flex-1" />
          <div className="flex flex-col gap-1">
            <Button size="sm" variant="destructive" onClick={doSubmit} disabled={loading} className="text-xs">{loading ? "Closing..." : "Close PR"}</Button>
            <Button variant="ghost" size="sm" onClick={() => setAction(null)} className="text-xs">Cancel</Button>
          </div>
        </div>
      )}
    </>
  );
}

function ReviewerManager({ pr, token, onRefresh }: { pr: DashboardPR; token: string; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [collaborators, setCollaborators] = useState<Array<{ login: string; avatar_url: string }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || collaborators !== null) return;
    setLoading(true);
    fetchCollaborators(token, pr.repo)
      .then(setCollaborators)
      .catch(() => setCollaborators([]))
      .finally(() => setLoading(false));
  }, [open, collaborators, token, pr.repo]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentReviewerLogins = new Set([
    ...pr.requestedReviewers.map((r) => r.login.toLowerCase()),
    ...pr.reviewers.map((r) => r.login.toLowerCase()),
  ]);

  const filtered = (collaborators ?? []).filter(
    (c) =>
      c.login.toLowerCase() !== pr.author.toLowerCase() &&
      !currentReviewerLogins.has(c.login.toLowerCase()) &&
      c.login.toLowerCase().includes(search.toLowerCase())
  );

  const doAdd = async (login: string) => {
    setError(null);
    try {
      await requestReviewers(token, pr.repo, pr.number, [login]);
      setOpen(false);
      setSearch("");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const doRemove = async (login: string) => {
    setError(null);
    try {
      await removeReviewRequest(token, pr.repo, pr.number, [login]);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const reviewStateColor = (state: string) => {
    switch (state) {
      case "APPROVED": return "text-emerald-500";
      case "CHANGES_REQUESTED": return "text-red-500";
      case "COMMENTED": return "text-blue-500";
      default: return "text-muted-foreground";
    }
  };

  const reviewStateLabel = (state: string) => {
    switch (state) {
      case "APPROVED": return "Approved";
      case "CHANGES_REQUESTED": return "Changes requested";
      case "COMMENTED": return "Commented";
      case "DISMISSED": return "Dismissed";
      default: return state;
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap relative">
      {/* Existing reviewers who have submitted reviews */}
      {pr.reviewers.map((r) => (
        <Tooltip key={r.login}>
          <TooltipTrigger render={
            <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted", reviewStateColor(r.state))}>
              {r.login}
              <span className="text-[8px] opacity-70">{reviewStateLabel(r.state)}</span>
            </span>
          } />
          <TooltipContent>{r.login}: {reviewStateLabel(r.state)}</TooltipContent>
        </Tooltip>
      ))}

      {/* Pending review requests */}
      {pr.requestedReviewers
        .filter((rr) => !pr.reviewers.some((r) => r.login.toLowerCase() === rr.login.toLowerCase()))
        .map((r) => (
        <Tooltip key={r.login}>
          <TooltipTrigger render={
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {r.login}
              <span className="text-[8px] opacity-70">Pending</span>
              <button
                onClick={(e) => { e.stopPropagation(); doRemove(r.login); }}
                className="ml-0.5 hover:text-red-500 transition-colors"
                title={`Remove review request from ${r.login}`}
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          } />
          <TooltipContent>Review requested from {r.login}</TooltipContent>
        </Tooltip>
      ))}

      {/* Add reviewer button */}
      <div ref={dropdownRef} className="relative">
        <Tooltip>
          <TooltipTrigger render={
            <Button
              variant="outline"
              size="xs"
              className="text-[10px] h-5 gap-0.5 px-1.5"
              onClick={() => setOpen(!open)}
            />
          }>
            <UserPlusIcon /> Reviewer
          </TooltipTrigger>
          <TooltipContent>Request a review</TooltipContent>
        </Tooltip>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="p-2 border-b border-border">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search collaborators..."
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {loading && <div className="p-3 text-xs text-muted-foreground text-center">Loading...</div>}
              {!loading && filtered.length === 0 && (
                <div className="p-3 text-xs text-muted-foreground text-center">No collaborators found</div>
              )}
              {filtered.map((c) => (
                <button
                  key={c.login}
                  onClick={() => doAdd(c.login)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left"
                >
                  <Avatar size="sm" className="size-4">
                    <AvatarImage src={c.avatar_url} alt={c.login} />
                    <AvatarFallback>{c.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{c.login}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}

function CommentsTab({ threadResolution, issueComments, threads, totalComments, token, pr, findThreadInfo, handleResolutionChanged, handleReviewCommentPosted, onIssueCommentPosted }: {
  threadResolution: ThreadResolution | null;
  issueComments: PRComment[] | null;
  threads: { root: ReviewComment; replies: ReviewComment[] }[];
  totalComments: number;
  token: string;
  pr: DashboardPR;
  findThreadInfo: (root: ReviewComment) => ReviewThreadInfo | undefined;
  handleResolutionChanged: (threadId: string, resolved: boolean) => void;
  handleReviewCommentPosted: (c: ReviewComment) => void;
  onIssueCommentPosted: (c: PRComment) => void;
}) {
  const [threadFilter, setThreadFilter] = useState<"all" | "unresolved" | "resolved">("all");
  const [resolvingAll, setResolvingAll] = useState(false);

  const unresolvedThreads = threadResolution?.threads.filter((t) => !t.isResolved) ?? [];
  const resolvedThreads = threadResolution?.threads.filter((t) => t.isResolved) ?? [];

  const filteredThreads = threads.filter((thread) => {
    if (threadFilter === "all") return true;
    const info = findThreadInfo(thread.root);
    if (!info) return threadFilter === "unresolved"; // default to showing if no info
    return threadFilter === "resolved" ? info.isResolved : !info.isResolved;
  });

  const resolveAll = async () => {
    setResolvingAll(true);
    try {
      await Promise.all(
        unresolvedThreads.map((t) => resolveReviewThread(token, t.id).then(() => handleResolutionChanged(t.id, true)))
      );
    } catch { /* ignore */ }
    setResolvingAll(false);
  };

  return (
    <div className="space-y-4">
      {/* Thread resolution summary */}
      {threadResolution && threadResolution.totalThreads > 0 && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
          threadResolution.resolvedThreads === threadResolution.totalThreads
            ? "bg-green-500/10 text-green-600 dark:text-green-400"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        )}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {threadResolution.resolvedThreads === threadResolution.totalThreads ? (
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
          <span className="flex-1">
            {threadResolution.resolvedThreads === threadResolution.totalThreads
              ? `All ${threadResolution.totalThreads} review threads resolved`
              : `${threadResolution.resolvedThreads} of ${threadResolution.totalThreads} review threads resolved`
            }
          </span>
          {unresolvedThreads.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="text-[10px] h-5 px-2 text-amber-600 dark:text-amber-400 hover:text-green-600"
              onClick={resolveAll}
              disabled={resolvingAll}
            >
              {resolvingAll ? "Resolving..." : `Resolve all (${unresolvedThreads.length})`}
            </Button>
          )}
        </div>
      )}

      {/* Issue comments (general PR comments) */}
      {issueComments && issueComments.length > 0 && (
        <div className="space-y-0">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" />
            {issueComments.map((c) => (
              <div key={c.id} className="relative flex gap-3 py-2">
                <div className="relative z-10 shrink-0">
                  <Avatar size="sm" className="size-[30px] ring-2 ring-background">
                    <AvatarImage src={c.user.avatar_url} alt={c.user.login} />
                    <AvatarFallback>{c.user.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0 bg-muted rounded-lg px-3 py-2 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-foreground">{c.user.login}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                    <a href={c.html_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] text-muted-foreground hover:text-primary transition-colors">
                      view on GitHub
                    </a>
                  </div>
                  <div className="text-[13px] text-foreground break-words prose-gh [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <Markdown content={c.body} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review comment threads */}
      {threads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mt-2">
            <Separator className="flex-1" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Review threads</span>
            <Separator className="flex-1" />
          </div>

          {/* Filter pills */}
          {threadResolution && threadResolution.totalThreads > 0 && (
            <div className="flex items-center gap-1">
              {(["all", "unresolved", "resolved"] as const).map((f) => {
                const count = f === "all" ? threads.length : f === "unresolved" ? unresolvedThreads.length : resolvedThreads.length;
                return (
                  <button
                    key={f}
                    onClick={() => setThreadFilter(f)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full transition-colors capitalize",
                      threadFilter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {filteredThreads.map((thread) => (
            <ReviewThread
              key={thread.root.id}
              thread={thread}
              token={token}
              repo={pr.repo}
              prNumber={pr.number}
              onReplyPosted={handleReviewCommentPosted}
              threadInfo={findThreadInfo(thread.root)}
              onResolutionChanged={handleResolutionChanged}
            />
          ))}
          {filteredThreads.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-2">
              No {threadFilter} threads
            </p>
          )}
        </div>
      )}

      {totalComments === 0 && <p className="text-xs text-muted-foreground italic">No comments</p>}

      {/* Issue comment form */}
      <CommentForm
        token={token}
        repo={pr.repo}
        number={pr.number}
        onPosted={onIssueCommentPosted}
      />
    </div>
  );
}

function SidePanel({ pr, token, onClose, onRefresh, onOptimisticUpdate }: { pr: DashboardPR; token: string; onClose: () => void; onRefresh: () => void; onOptimisticUpdate?: (patch: Partial<DashboardPR>) => void }) {
  const [files, setFiles] = useState<PRFile[] | null>(null);
  const [issueComments, setIssueComments] = useState<PRComment[] | null>(null);
  const [reviewComments, setReviewComments] = useState<ReviewComment[] | null>(null);
  const [onDevelop, setOnDevelop] = useState<"yes" | "no" | "no-branch" | null>(null);
  const [prLabels, setPrLabels] = useState(pr.labels);
  const [commits, setCommits] = useState<PRCommit[] | null>(null);
  const [conflictFiles, setConflictFiles] = useState<ConflictFile[] | null>(null);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"description" | "changes" | "comments" | "commits" | "ci" | "conflicts">("description");
  const [checkRuns, setCheckRuns] = useState<CheckRun[] | null>(null);
  const [checkRunsLoading, setCheckRunsLoading] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [workflowJobs, setWorkflowJobs] = useState<WorkflowJob[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set());
  const [jobLogs, setJobLogs] = useState<Record<number, string>>({});
  const [jobLogsLoading, setJobLogsLoading] = useState<Set<number>>(new Set());
  const [threadResolution, setThreadResolution] = useState<ThreadResolution | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchThreadResolutions(token, pr.repo, pr.number).then((res) => {
      if (!cancelled) setThreadResolution(res);
    });
    return () => { cancelled = true; };
  }, [token, pr.repo, pr.number]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTab("description");
    setOnDevelop(null);
    Promise.allSettled([
      fetchPRFiles(token, pr.repo, pr.number),
      fetchIssueComments(token, pr.repo, pr.number),
      fetchReviewComments(token, pr.repo, pr.number),
      checkOnDevelop(token, pr.repo, pr.headSha),
      fetchPRCommits(token, pr.repo, pr.number),
    ]).then(([f, ic, rc, d, cm]) => {
      if (cancelled) return;
      setFiles(f.status === "fulfilled" ? f.value : []);
      setIssueComments(ic.status === "fulfilled" ? ic.value : []);
      setReviewComments(rc.status === "fulfilled" ? rc.value : []);
      setOnDevelop(d.status === "fulfilled" ? d.value : null);
      setCommits(cm.status === "fulfilled" ? cm.value : []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [token, pr.repo, pr.number, pr.headSha]);

  // Silent periodic refresh of mutable panel data
  const { isVisible } = useDocumentVisibility();
  const checkRunsLoaded = checkRuns !== null;
  useEffect(() => {
    if (!isVisible) return;
    const id = setInterval(async () => {
      const [ic, rc, tr] = await Promise.allSettled([
        fetchIssueComments(token, pr.repo, pr.number),
        fetchReviewComments(token, pr.repo, pr.number),
        fetchThreadResolutions(token, pr.repo, pr.number),
      ]);
      if (ic.status === "fulfilled") setIssueComments(ic.value);
      if (rc.status === "fulfilled") setReviewComments(rc.value);
      if (tr.status === "fulfilled") setThreadResolution(tr.value);

      if (checkRunsLoaded && pr.headSha) {
        const [runs, jobs] = await Promise.allSettled([
          fetchCheckRuns(token, pr.repo, pr.headSha),
          fetchWorkflowJobs(token, pr.repo, pr.headSha),
        ]);
        if (runs.status === "fulfilled") setCheckRuns(runs.value);
        if (jobs.status === "fulfilled") setWorkflowJobs(jobs.value);
      }
    }, SIDEPANEL_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, pr.repo, pr.number, pr.headSha, isVisible, checkRunsLoaded]);

  // Lazy-load conflict files when the tab is opened
  useEffect(() => {
    if (tab !== "conflicts" || conflictFiles !== null || !pr.hasConflicts || !pr.baseRef || !pr.headRef) return;
    let cancelled = false;
    setConflictsLoading(true);
    fetchConflictFiles(token, pr.repo, pr.number, pr.baseRef, pr.headRef).then((cf) => {
      if (cancelled) return;
      setConflictFiles(cf);
      setConflictsLoading(false);
    });
    return () => { cancelled = true; };
  }, [tab, conflictFiles, token, pr.repo, pr.number, pr.hasConflicts, pr.baseRef, pr.headRef]);

  // Lazy-load check runs and workflow jobs when the CI tab is opened
  useEffect(() => {
    if (tab !== "ci" || checkRuns !== null || !pr.headSha) return;
    let cancelled = false;
    setCheckRunsLoading(true);
    Promise.all([
      fetchCheckRuns(token, pr.repo, pr.headSha),
      fetchWorkflowJobs(token, pr.repo, pr.headSha).catch(() => [] as WorkflowJob[]),
    ]).then(([runs, jobs]) => {
      if (cancelled) return;
      setCheckRuns(runs);
      setWorkflowJobs(jobs);
      setCheckRunsLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setCheckRuns([]);
      setWorkflowJobs([]);
      setCheckRunsLoading(false);
    });
    return () => { cancelled = true; };
  }, [tab, checkRuns, token, pr.repo, pr.headSha]);

  const handleRerunFailed = async () => {
    if (!pr.headSha) return;
    setRerunning(true);
    try {
      await rerunFailedChecks(token, pr.repo, pr.headSha);
      // Refresh check runs after a brief delay
      setTimeout(() => {
        setCheckRuns(null); // triggers re-fetch
      }, 2000);
    } catch { /* ignore */ }
    setRerunning(false);
  };

  const toggleRunExpanded = (runId: number) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  const findJobForCheckRun = (run: CheckRun): WorkflowJob | undefined =>
    workflowJobs.find((j) => j.name === run.name);

  const loadJobLogs = async (jobId: number) => {
    if (jobLogs[jobId] || jobLogsLoading.has(jobId)) return;
    setJobLogsLoading((prev) => new Set(prev).add(jobId));
    try {
      const logs = await fetchJobLogs(token, pr.repo, jobId);
      setJobLogs((prev) => ({ ...prev, [jobId]: logs }));
    } catch {
      setJobLogs((prev) => ({ ...prev, [jobId]: "Failed to load logs." }));
    }
    setJobLogsLoading((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
  };

  const totalComments = (issueComments?.length ?? 0) + (reviewComments?.length ?? 0);

  const threads = reviewComments ? groupIntoThreads(reviewComments) : [];

  const handleReviewCommentPosted = (c: ReviewComment) => {
    setReviewComments((prev) => prev ? [...prev, c] : [c]);
  };

  const findThreadInfo = (root: ReviewComment): ReviewThreadInfo | undefined => {
    if (!threadResolution) return undefined;
    return threadResolution.threads.find((t) =>
      t.path === root.path && (t.line === root.line || t.originalLine === root.original_line)
    );
  };

  const handleResolutionChanged = (threadId: string, resolved: boolean) => {
    setThreadResolution((prev) => {
      if (!prev) return prev;
      const updated = prev.threads.map((t) => t.id === threadId ? { ...t, isResolved: resolved } : t);
      return {
        ...prev,
        threads: updated,
        resolvedThreads: updated.filter((t) => t.isResolved).length,
      };
    });
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Panel header */}
      <div className="shrink-0 px-4 py-2 border-b border-border space-y-1.5">
        {/* Row 1: title + close */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground font-mono shrink-0">{pr.repo.split("/")[1]}#{pr.number}</span>
          <h2 className="text-sm font-semibold text-foreground leading-snug truncate flex-1">{pr.title}</h2>
          <Button variant="ghost" size="icon-xs" onClick={onClose} className="shrink-0">
            <XIcon />
          </Button>
        </div>

        {/* Row 2: meta + status + actions — all inline */}
        <div className="flex items-center gap-2 flex-wrap">
          <Avatar size="sm" className="size-4">
            <AvatarImage src={pr.authorAvatar} alt={pr.author} />
            <AvatarFallback>{pr.author.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground">{pr.author}</span>
          <span className="text-[11px] text-muted-foreground">{timeAgo(pr.updatedAt)}</span>
          {pr.headRef && (
            <>
              <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px] text-muted-foreground truncate max-w-[150px]" title={pr.headRef}>{pr.headRef}</code>
              {pr.baseRef && (
                <>
                  <span className="text-[10px] text-muted-foreground">&rarr;</span>
                  <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px] text-muted-foreground">{pr.baseRef}</code>
                </>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0" onClick={() => navigator.clipboard.writeText(pr.headRef)} />
                  }
                >
                  <CopyIcon />
                </TooltipTrigger>
                <TooltipContent>Copy branch</TooltipContent>
              </Tooltip>
            </>
          )}
          <CIBadge status={pr.ciStatus} />
          {pr.isDraft && <Badge variant="secondary" className="text-[9px] uppercase tracking-wider font-semibold px-1 py-0 h-auto">Draft</Badge>}
          <ReviewBadge state={pr.reviewState} />
          {pr.hasConflicts && (
            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-auto gap-0.5">
              <AlertIcon /> Conflicts
            </Badge>
          )}
          {onDevelop === "yes" && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-auto text-emerald-500 gap-0.5">
              <CheckIcon /> On develop
            </Badge>
          )}
          {prLabels.map((label) => (
            <span
              key={label.name}
              className="text-[9px] font-medium px-1 py-0 rounded-full"
              style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}`, border: `1px solid #${label.color}30` }}
            >
              {label.name}
            </span>
          ))}
          <LabelEditor currentLabels={prLabels} token={token} repo={pr.repo} prNumber={pr.number} onLabelsChanged={setPrLabels} />
          <a href={pr.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-[11px] font-medium text-primary hover:underline shrink-0">
            Open on GitHub
          </a>
        </div>

        {/* Row 3: reviewers */}
        <ReviewerManager pr={pr} token={token} onRefresh={onRefresh} />

        {/* Row 4: quick actions */}
        <div className="flex items-center gap-1.5">
          <QuickActions pr={pr} token={token} onRefresh={onRefresh} onOptimisticUpdate={onOptimisticUpdate} />
        </div>

        {/* Row 4: tabs */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
        >
          <TabsList>
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="changes">Changes{files ? ` (${files.length})` : ""}</TabsTrigger>
            <TabsTrigger value="comments">
              Comments{totalComments > 0 ? ` (${totalComments})` : ""}
              {threadResolution && threadResolution.totalThreads > 0 && (
                <span className={cn(
                  "ml-1 text-[9px] font-medium px-1 rounded-full",
                  threadResolution.resolvedThreads === threadResolution.totalThreads
                    ? "bg-green-500/10 text-green-500"
                    : "bg-amber-500/10 text-amber-500"
                )}>
                  {threadResolution.resolvedThreads}/{threadResolution.totalThreads}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="commits">Commits{commits ? ` (${commits.length})` : ""}</TabsTrigger>
            <TabsTrigger value="ci">CI/CD</TabsTrigger>
            {pr.hasConflicts && (
              <TabsTrigger value="conflicts" className="text-destructive">Conflicts</TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

      {/* Panel content */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div key={tab} className="px-5 py-4 animate-fade-in">
          {loading ? (
            <div className="space-y-3 stagger-children">
              <div className="h-3 w-3/4 skeleton-shimmer rounded" />
              <div className="h-3 w-1/2 skeleton-shimmer rounded" />
              <div className="h-3 w-2/3 skeleton-shimmer rounded" />
              <div className="h-3 w-1/3 skeleton-shimmer rounded" />
            </div>
          ) : (
            <>
              {tab === "description" && (
                <div className="text-sm text-foreground break-words prose-gh [&>*:first-child]:mt-0">
                  {pr.body ? <Markdown content={pr.body} /> : <span className="text-muted-foreground italic">No description</span>}
                </div>
              )}

              {tab === "changes" && files && (
                <ChangesTabContent
                  files={files}
                  reviewComments={reviewComments ?? []}
                  token={token}
                  pr={pr}
                  onCommentPosted={handleReviewCommentPosted}
                />
              )}

              {tab === "comments" && (
                <CommentsTab
                  threadResolution={threadResolution}
                  issueComments={issueComments}
                  threads={threads}
                  totalComments={totalComments}
                  token={token}
                  pr={pr}
                  findThreadInfo={findThreadInfo}
                  handleResolutionChanged={handleResolutionChanged}
                  handleReviewCommentPosted={handleReviewCommentPosted}
                  onIssueCommentPosted={(c) => setIssueComments((prev) => prev ? [...prev, c] : [c])}
                />
              )}

              {tab === "commits" && commits && (
                <div className="space-y-0">
                  {commits.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No commits</p>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" />
                      {commits.map((commit, i) => {
                        const firstLine = commit.commit.message.split("\n")[0];
                        const rest = commit.commit.message.split("\n").slice(1).join("\n").trim();
                        return (
                          <div key={commit.sha} className="relative flex gap-3 py-2 group">
                            {/* Timeline dot */}
                            <div className="relative z-10 mt-1 shrink-0">
                              {commit.author ? (
                                <Avatar size="sm" className="size-[30px] ring-2 ring-background">
                                  <AvatarImage src={commit.author.avatar_url} alt={commit.author.login} />
                                  <AvatarFallback>{commit.author.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className="size-[30px] rounded-full bg-muted ring-2 ring-background flex items-center justify-center">
                                  <span className="text-[10px] text-muted-foreground">{commit.commit.author.name.slice(0, 2).toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <a
                                href={commit.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-foreground hover:text-primary hover:underline leading-snug line-clamp-2"
                              >
                                {firstLine}
                              </a>
                              {rest && (
                                <pre className="mt-1 text-[11px] text-muted-foreground font-mono whitespace-pre-wrap line-clamp-3">{rest}</pre>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-muted-foreground">
                                  {commit.author?.login ?? commit.commit.author.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{timeAgo(commit.commit.author.date)}</span>
                                <code className="text-[10px] text-muted-foreground font-mono bg-muted px-1 py-0.5 rounded">{commit.sha.slice(0, 7)}</code>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "ci" && (
                <div className="space-y-3">
                  {checkRunsLoading ? (
                    <div className="space-y-3 stagger-children">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-4 h-4 skeleton-shimmer rounded-full" />
                          <div className="h-3 flex-1 skeleton-shimmer rounded" />
                          <div className="h-3 w-16 skeleton-shimmer rounded" />
                        </div>
                      ))}
                    </div>
                  ) : checkRuns && checkRuns.length > 0 ? (
                    <>
                      {/* Summary bar */}
                      <div className="flex items-center gap-3 pb-2 border-b border-border">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="flex items-center gap-1 text-emerald-500">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            {checkRuns.filter((r) => r.conclusion === "success" || r.conclusion === "skipped" || r.conclusion === "neutral").length} passed
                          </span>
                          {checkRuns.some((r) => r.conclusion === "failure" || r.conclusion === "timed_out") && (
                            <span className="flex items-center gap-1 text-red-500">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              {checkRuns.filter((r) => r.conclusion === "failure" || r.conclusion === "timed_out").length} failed
                            </span>
                          )}
                          {checkRuns.some((r) => r.status !== "completed") && (
                            <span className="flex items-center gap-1 text-amber-500">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              {checkRuns.filter((r) => r.status !== "completed").length} running
                            </span>
                          )}
                        </div>
                        <div className="flex-1" />
                        {checkRuns.some((r) => r.conclusion === "failure" || r.conclusion === "timed_out") && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={rerunning}
                            onClick={handleRerunFailed}
                            className="text-xs h-7"
                          >
                            {rerunning ? "Re-running..." : "Re-run failed"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCheckRuns(null)}
                          className="text-xs h-7"
                        >
                          Refresh
                        </Button>
                      </div>

                      {/* Check runs list */}
                      {checkRuns
                        .sort((a, b) => {
                          const order = (r: CheckRun) =>
                            r.conclusion === "failure" || r.conclusion === "timed_out" ? 0
                            : r.status !== "completed" ? 1
                            : 2;
                          return order(a) - order(b);
                        })
                        .map((run) => {
                          const isExpanded = expandedRuns.has(run.id);
                          const job = findJobForCheckRun(run);
                          return (
                        <div key={run.id} className="rounded-lg border border-border overflow-hidden">
                          <button
                            onClick={() => toggleRunExpanded(run.id)}
                            className="flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-muted/50 transition-colors group/ci"
                          >
                            {/* Status icon */}
                            <span className="shrink-0">
                              {run.status !== "completed" ? (
                                <span className="flex w-4 h-4 items-center justify-center">
                                  <span className="w-3 h-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                                </span>
                              ) : run.conclusion === "success" ? (
                                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : run.conclusion === "failure" || run.conclusion === "timed_out" ? (
                                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : run.conclusion === "skipped" ? (
                                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : (
                                <span className="w-4 h-4 flex items-center justify-center">
                                  <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                                </span>
                              )}
                            </span>

                            {/* Name and app */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate group-hover/ci:text-primary transition-colors">
                                {run.name}
                              </p>
                              {run.app && (
                                <p className="text-[11px] text-muted-foreground truncate">{run.app.name}</p>
                              )}
                            </div>

                            {/* Duration */}
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {run.started_at && run.completed_at
                                ? formatDuration(new Date(run.completed_at).getTime() - new Date(run.started_at).getTime())
                                : run.started_at
                                  ? "running..."
                                  : "queued"}
                            </span>

                            {/* Chevron */}
                            <svg className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", isExpanded && "rotate-90")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="border-t border-border bg-muted/30 px-3 py-2 space-y-2">
                              {/* Steps */}
                              {job && job.steps.length > 0 ? (
                                <div className="space-y-0.5">
                                  {job.steps.map((step) => (
                                    <div key={step.number} className="flex items-center gap-2 py-0.5 text-xs">
                                      <span className="shrink-0">
                                        {step.status !== "completed" ? (
                                          <span className="w-3 h-3 flex items-center justify-center">
                                            <span className="w-2 h-2 rounded-full border border-amber-500 border-t-transparent animate-spin" />
                                          </span>
                                        ) : step.conclusion === "success" ? (
                                          <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                        ) : step.conclusion === "failure" ? (
                                          <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                        ) : step.conclusion === "skipped" ? (
                                          <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                        ) : (
                                          <span className="w-3 h-3 flex items-center justify-center">
                                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                                          </span>
                                        )}
                                      </span>
                                      <span className={cn("flex-1 truncate", step.conclusion === "failure" ? "text-red-500 font-medium" : "text-muted-foreground")}>
                                        {step.name}
                                      </span>
                                      {step.started_at && step.completed_at && (
                                        <span className="text-[10px] text-muted-foreground/70 shrink-0">
                                          {formatDuration(new Date(step.completed_at).getTime() - new Date(step.started_at).getTime())}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted-foreground italic">No step details available</p>
                              )}

                              {/* Actions row */}
                              <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                                {job && (
                                  <button
                                    onClick={() => loadJobLogs(job.id)}
                                    disabled={jobLogsLoading.has(job.id)}
                                    className="text-[11px] text-primary hover:underline disabled:opacity-50"
                                  >
                                    {jobLogsLoading.has(job.id) ? "Loading logs..." : jobLogs[job.id] ? "Logs loaded" : "View logs"}
                                  </button>
                                )}
                                <div className="flex-1" />
                                <a
                                  href={run.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Open in GitHub
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </a>
                              </div>

                              {/* Logs */}
                              {job && jobLogs[job.id] && (
                                <div className="mt-1">
                                  <pre className="text-[10px] leading-relaxed font-mono bg-background rounded p-2 max-h-80 overflow-auto whitespace-pre-wrap break-all border border-border/50">
                                    {jobLogs[job.id].split("\n").map((line, i) => {
                                      // Strip timestamp prefix (e.g., "2024-01-15T10:00:00.0000000Z ")
                                      const cleaned = line.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/, "");
                                      // Skip group markers
                                      if (cleaned.startsWith("##[group]") || cleaned === "##[endgroup]") return null;
                                      const isError = cleaned.startsWith("##[error]");
                                      const display = cleaned.replace(/^##\[(error|warning|notice|debug)]\s?/, "");
                                      return (
                                        <span key={i} className={isError ? "text-red-500" : "text-muted-foreground"}>
                                          {display}{"\n"}
                                        </span>
                                      );
                                    })}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                          );
                        })}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      {!pr.headSha ? "No head SHA available" : "No check runs found for this PR."}
                    </p>
                  )}
                </div>
              )}

              {tab === "conflicts" && pr.hasConflicts && (
                <div className="space-y-4">
                  {conflictsLoading ? (
                    <div className="space-y-3 stagger-children">
                      <div className="h-3 w-3/4 skeleton-shimmer rounded" />
                      <div className="h-3 w-1/2 skeleton-shimmer rounded" />
                      <div className="h-20 w-full skeleton-shimmer rounded" />
                    </div>
                  ) : conflictFiles && conflictFiles.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <Badge variant="destructive" className="text-[10px]">{conflictFiles.length} conflicting file{conflictFiles.length > 1 ? "s" : ""}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Files modified in both <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">{pr.baseRef}</code> and <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">{pr.headRef}</code>
                        </span>
                      </div>

                      {/* Resolution guidance */}
                      <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-2">
                        <p className="text-xs font-medium text-orange-600 dark:text-orange-400">To resolve these conflicts locally:</p>
                        <div className="space-y-1">
                          <button
                            className="group flex items-center gap-2 w-full text-left"
                            onClick={() => navigator.clipboard.writeText(`git fetch origin && git checkout ${pr.headRef} && git merge origin/${pr.baseRef}`)}
                          >
                            <code className="flex-1 text-[11px] font-mono bg-background/80 rounded px-2 py-1.5 border border-border/50 text-foreground">
                              git fetch origin && git checkout {pr.headRef} && git merge origin/{pr.baseRef}
                            </code>
                            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0">click to copy</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Resolve conflicts in your editor, then commit and push.</p>
                      </div>

                      {conflictFiles.map((cf) => (
                        <ConflictFileView key={cf.filename} file={cf} baseRef={pr.baseRef} headRef={pr.headRef} />
                      ))}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      {conflictFiles ? "Could not determine conflicting files." : "Loading conflict information..."}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
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
      rehypePlugins={[rehypeRaw, rehypeHighlight]}
      components={{
        a: ({ ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all" />
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = className?.startsWith("language-");
          return isBlock ? (
            <pre className="bg-muted border border-border rounded-lg px-4 py-3 overflow-x-auto my-4 text-[13px] leading-relaxed font-mono">
              <code className={className} {...props}>{children}</code>
            </pre>
          ) : (
            <code className="bg-muted border border-border px-1.5 py-0.5 rounded-md text-[13px] font-mono" {...props}>{children}</code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        img: ({ alt, ...props }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={alt ?? ""} {...props} className="max-w-full rounded-lg my-3 border border-border" />
        ),
        table: ({ ...props }) => (
          <div className="overflow-x-auto my-4 rounded-lg border border-border">
            <table className="text-[13px] w-full" {...props} />
          </div>
        ),
        th: ({ ...props }) => <th className="border-b border-border px-3 py-2 bg-muted text-left text-xs font-semibold" {...props} />,
        td: ({ ...props }) => <td className="border-b border-border px-3 py-2" {...props} />,
        ul: ({ ...props }) => <ul className="list-disc pl-6 my-3 space-y-1.5" {...props} />,
        ol: ({ ...props }) => <ol className="list-decimal pl-6 my-3 space-y-1.5" {...props} />,
        li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
        blockquote: ({ ...props }) => (
          <blockquote className="border-l-[3px] border-border pl-4 my-4 text-muted-foreground" {...props} />
        ),
        h1: ({ ...props }) => <h1 className="text-xl font-semibold mt-6 mb-3 pb-2 border-b border-border" {...props} />,
        h2: ({ ...props }) => <h2 className="text-lg font-semibold mt-5 mb-2 pb-1.5 border-b border-border" {...props} />,
        h3: ({ ...props }) => <h3 className="text-base font-semibold mt-4 mb-2" {...props} />,
        h4: ({ ...props }) => <h4 className="text-sm font-semibold mt-3 mb-1.5" {...props} />,
        p: ({ ...props }) => <p className="my-3 leading-relaxed" {...props} />,
        hr: () => <Separator className="my-6" />,
        input: ({ ...props }) => <input {...props} disabled className="mr-2 accent-primary align-middle" />,
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
    <div className="pt-4 mt-2">
      <Separator className="mb-4" />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a comment..."
        rows={3}
        className="text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-muted-foreground">Markdown supported &middot; {navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl"}+Enter to submit</span>
        <Button
          size="sm"
          onClick={submit}
          disabled={posting || !body.trim()}
        >
          {posting ? "Posting..." : "Comment"}
        </Button>
      </div>
    </div>
  );
}

// ── Skeleton Card ──────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-card border border-border border-l-[3px] border-l-transparent px-3 py-2.5 flex items-center gap-3">
      <div className="w-7 h-7 rounded-full skeleton-shimmer" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 w-3/4 skeleton-shimmer rounded" />
        <div className="h-3 w-1/3 skeleton-shimmer rounded" />
      </div>
    </div>
  );
}

// ── PR Group ───────────────────────────────────────────────────────

function urgencyScore(pr: DashboardPR): number {
  let score = 0;
  if (pr.ciStatus === "failure") score += 100;
  if (pr.hasConflicts) score += 80;
  if (pr.reviewState === "changes_requested") score += 60;
  // Stale review request (>24h since updated)
  const hoursSinceUpdate = (Date.now() - new Date(pr.updatedAt).getTime()) / 3600000;
  if (pr.reviewRequestedFromMe && hoursSinceUpdate > 24) score += 40;
  // Older PRs float up
  const daysSinceCreated = (Date.now() - new Date(pr.createdAt).getTime()) / 86400000;
  if (daysSinceCreated > 7) score += 20;
  if (daysSinceCreated > 14) score += 20;
  return score;
}

function PRGroup({
  title,
  prs,
  selectedId,
  onSelect,
  seenIds,
  onToggleSeen,
  defaultOpen = true,
  batchMode,
  batchSelected,
  onBatchToggle,
}: {
  title: string;
  prs: DashboardPR[];
  selectedId: number | null;
  onSelect: (pr: DashboardPR) => void;
  seenIds: Set<string>;
  onToggleSeen: (pr: DashboardPR) => void;
  defaultOpen?: boolean;
  batchMode: boolean;
  batchSelected: Set<number>;
  onBatchToggle: (pr: DashboardPR) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Only animate stagger on first expand, not on re-renders from state changes (e.g. toggling seen)
  const hasExpandedRef = useRef(defaultOpen);

  const categoryBadgeVariant: Record<string, "destructive" | "outline" | "secondary"> = {
    "Needs My Attention": "destructive",
    "Waiting on Others": "outline",
    Other: "secondary",
  };

  const variant = categoryBadgeVariant[title] ?? "secondary";
  const isAttention = title === "Needs My Attention";

  const sorted = [...prs].sort((a, b) => {
    const aSeen = seenIds.has(`${a.repo}#${a.number}`);
    const bSeen = seenIds.has(`${b.repo}#${b.number}`);
    if (aSeen !== bSeen) return aSeen ? 1 : -1;
    // Priority sort for "Needs Attention"
    if (isAttention) {
      const urgDiff = urgencyScore(b) - urgencyScore(a);
      if (urgDiff !== 0) return urgDiff;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-2 px-1 cursor-pointer"
      >
        <ChevronIcon open={open} />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Badge variant={variant}>
          {prs.length}
        </Badge>
      </button>
      {open && (() => {
        const shouldAnimate = !hasExpandedRef.current;
        hasExpandedRef.current = true;
        return (
        <div className={cn("space-y-1.5 pb-3", shouldAnimate && "stagger-children")}>
          {sorted.map((pr) => (
            <PRCard
              key={pr.id}
              pr={pr}
              selected={pr.id === selectedId}
              seen={seenIds.has(`${pr.repo}#${pr.number}`)}
              onSelect={() => onSelect(pr)}
              onToggleSeen={() => onToggleSeen(pr)}
              batchMode={batchMode}
              batchSelected={batchSelected.has(pr.id)}
              onBatchToggle={() => onBatchToggle(pr)}
            />
          ))}
        </div>
        );
      })()}
    </section>
  );
}

// ── Empty State ────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in-up">
      <InboxIcon />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">
          {hasFilters ? "No PRs match your filters" : "No open pull requests"}
        </p>
        <p className="text-xs text-muted-foreground">
          {hasFilters ? "Try adjusting your filters or search terms" : "You're all caught up!"}
        </p>
      </div>
    </div>
  );
}

// ── Analytics Icons ─────────────────────────────────────────────────

function BarChartIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M19 12H5m0 0l7 7m-7-7l7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendUpIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="17 6 23 6 23 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Analytics Page ─────────────────────────────────────────────────

function AnalyticsPage({ token, username, org, onBack }: {
  token: string;
  username: string;
  org: string | null;
  onBack: () => void;
}) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState(12);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAnalytics(token, username, weeks, org)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [token, username, weeks, org]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeftIcon /></Button>
            <h2 className="text-lg font-semibold">Analytics</h2>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 skeleton-shimmer rounded-xl" />)}
          </div>
          <div className="h-64 skeleton-shimmer rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 skeleton-shimmer rounded-xl" />
            <div className="h-48 skeleton-shimmer rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeftIcon /></Button>
            <h2 className="text-lg font-semibold">Analytics</h2>
          </div>
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const avgCycleHours = data.prCycleTimes.length > 0
    ? data.prCycleTimes.reduce((s, p) => s + p.cycleHours, 0) / data.prCycleTimes.length
    : 0;

  const formatCycleTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const maxWeeklyTotal = Math.max(
    1,
    ...data.weeklyStats.map((w) => w.prsOpened + w.prsMerged + w.reviewsGiven + w.commentsGiven)
  );

  const totalReviews = data.reviewBreakdown.approved + data.reviewBreakdown.changesRequested + data.reviewBreakdown.commented;

  return (
    <div className="flex-1 overflow-y-auto p-6 animate-fade-in-down">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeftIcon /></Button>
            <h2 className="text-lg font-semibold">Performance Analytics</h2>
          </div>
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground cursor-pointer"
          >
            <option value={4}>Last 4 weeks</option>
            <option value={8}>Last 8 weeks</option>
            <option value={12}>Last 12 weeks</option>
          </select>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="PRs Opened" value={data.totals.prsOpened} color="text-blue-500" bg="bg-blue-500/10" />
          <StatCard label="PRs Merged" value={data.totals.prsMerged} color="text-green-500" bg="bg-green-500/10" />
          <StatCard label="Reviews Given" value={data.totals.reviewsGiven} color="text-purple-500" bg="bg-purple-500/10" />
          <StatCard label="Avg Cycle Time" value={formatCycleTime(avgCycleHours)} color="text-amber-500" bg="bg-amber-500/10" />
        </div>

        {/* Weekly activity chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Weekly Activity</CardTitle>
            <CardDescription className="text-xs">Contributions per week over the last {weeks} weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-40">
              {data.weeklyStats.map((w) => {
                const total = w.prsOpened + w.prsMerged + w.reviewsGiven + w.commentsGiven;
                const pct = (total / maxWeeklyTotal) * 100;
                const d = new Date(w.weekStart);
                const label = `${d.getMonth() + 1}/${d.getDate()}`;
                return (
                  <Tooltip key={w.weekStart}>
                    <TooltipTrigger
                      render={
                        <div className="flex-1 flex flex-col items-center gap-1 cursor-default">
                          <div className="w-full flex flex-col items-stretch" style={{ height: "120px" }}>
                            <div className="flex-1" />
                            <div className="flex flex-col rounded-t-sm overflow-hidden" style={{ height: `${Math.max(pct, 2)}%` }}>
                              {w.commentsGiven > 0 && <div className="bg-amber-500/70 flex-1" style={{ flex: w.commentsGiven }} />}
                              {w.reviewsGiven > 0 && <div className="bg-purple-500/70 flex-1" style={{ flex: w.reviewsGiven }} />}
                              {w.prsMerged > 0 && <div className="bg-green-500/70 flex-1" style={{ flex: w.prsMerged }} />}
                              {w.prsOpened > 0 && <div className="bg-blue-500/70 flex-1" style={{ flex: w.prsOpened }} />}
                            </div>
                          </div>
                          <span className="text-[9px] text-muted-foreground">{label}</span>
                        </div>
                      }
                    />
                    <TooltipContent>
                      <div className="text-xs space-y-0.5">
                        <div className="font-medium">Week of {w.weekStart}</div>
                        <div className="text-blue-400">{w.prsOpened} PRs opened</div>
                        <div className="text-green-400">{w.prsMerged} PRs merged</div>
                        <div className="text-purple-400">{w.reviewsGiven} reviews</div>
                        <div className="text-amber-400">{w.commentsGiven} comments</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
              <LegendDot color="bg-blue-500" label="PRs Opened" />
              <LegendDot color="bg-green-500" label="PRs Merged" />
              <LegendDot color="bg-purple-500" label="Reviews" />
              <LegendDot color="bg-amber-500" label="Comments" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Review breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Review Breakdown</CardTitle>
              <CardDescription className="text-xs">{totalReviews} reviews sampled</CardDescription>
            </CardHeader>
            <CardContent>
              {totalReviews === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No reviews in this period</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex rounded-full overflow-hidden h-3">
                    {data.reviewBreakdown.approved > 0 && (
                      <div className="bg-green-500" style={{ width: `${(data.reviewBreakdown.approved / totalReviews) * 100}%` }} />
                    )}
                    {data.reviewBreakdown.changesRequested > 0 && (
                      <div className="bg-red-500" style={{ width: `${(data.reviewBreakdown.changesRequested / totalReviews) * 100}%` }} />
                    )}
                    {data.reviewBreakdown.commented > 0 && (
                      <div className="bg-amber-500" style={{ width: `${(data.reviewBreakdown.commented / totalReviews) * 100}%` }} />
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <LegendDot color="bg-green-500" label={`Approved (${data.reviewBreakdown.approved})`} />
                    <LegendDot color="bg-red-500" label={`Changes (${data.reviewBreakdown.changesRequested})`} />
                    <LegendDot color="bg-amber-500" label={`Commented (${data.reviewBreakdown.commented})`} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PR Cycle Times */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">PR Cycle Time</CardTitle>
              <CardDescription className="text-xs">Time from open to merge ({data.prCycleTimes.length} PRs)</CardDescription>
            </CardHeader>
            <CardContent>
              {data.prCycleTimes.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No merged PRs in this period</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const sorted = [...data.prCycleTimes].sort((a, b) => a.cycleHours - b.cycleHours);
                    const median = sorted[Math.floor(sorted.length / 2)];
                    const fastest = sorted[0];
                    const slowest = sorted[sorted.length - 1];
                    return (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-green-500/10 p-2">
                          <div className="text-lg font-semibold text-green-500">{formatCycleTime(fastest.cycleHours)}</div>
                          <div className="text-[10px] text-muted-foreground">Fastest</div>
                        </div>
                        <div className="rounded-lg bg-blue-500/10 p-2">
                          <div className="text-lg font-semibold text-blue-500">{formatCycleTime(median.cycleHours)}</div>
                          <div className="text-[10px] text-muted-foreground">Median</div>
                        </div>
                        <div className="rounded-lg bg-amber-500/10 p-2">
                          <div className="text-lg font-semibold text-amber-500">{formatCycleTime(slowest.cycleHours)}</div>
                          <div className="text-[10px] text-muted-foreground">Slowest</div>
                        </div>
                      </div>
                    );
                  })()}
                  <ScrollArea className="h-28">
                    <div className="space-y-1">
                      {data.prCycleTimes.slice(0, 20).map((pr) => {
                        const maxHours = Math.max(...data.prCycleTimes.map((p) => p.cycleHours));
                        const pct = (pr.cycleHours / maxHours) * 100;
                        return (
                          <a key={`${pr.repo}#${pr.prNumber}`} href={pr.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-muted transition-colors group">
                            <div className="flex-1 min-w-0 truncate text-foreground group-hover:text-foreground">
                              {pr.prTitle}
                            </div>
                            <div className="shrink-0 w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", pr.cycleHours < 24 ? "bg-green-500" : pr.cycleHours < 72 ? "bg-amber-500" : "bg-red-500")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-muted-foreground w-10 text-right">{formatCycleTime(pr.cycleHours)}</span>
                          </a>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top repos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Repository Activity</CardTitle>
            <CardDescription className="text-xs">Your most active repositories</CardDescription>
          </CardHeader>
          <CardContent>
            {data.repoActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No activity in this period</p>
            ) : (
              <div className="space-y-2">
                {data.repoActivity.slice(0, 10).map((repo) => {
                  const total = repo.prsAuthored + repo.reviewsGiven + repo.commentsGiven;
                  const maxTotal = Math.max(...data.repoActivity.map((r) => r.prsAuthored + r.reviewsGiven + r.commentsGiven));
                  const pct = (total / maxTotal) * 100;
                  return (
                    <div key={repo.repo} className="flex items-center gap-3">
                      <span className="text-xs text-foreground w-48 shrink-0 truncate font-mono">{repo.repo}</span>
                      <div className="flex-1 h-5 rounded-full overflow-hidden flex bg-muted">
                        {repo.prsAuthored > 0 && (
                          <div className="bg-blue-500/70 h-full" style={{ width: `${(repo.prsAuthored / total) * pct}%` }} />
                        )}
                        {repo.reviewsGiven > 0 && (
                          <div className="bg-purple-500/70 h-full" style={{ width: `${(repo.reviewsGiven / total) * pct}%` }} />
                        )}
                        {repo.commentsGiven > 0 && (
                          <div className="bg-amber-500/70 h-full" style={{ width: `${(repo.commentsGiven / total) * pct}%` }} />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right shrink-0">{total}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border">
                  <LegendDot color="bg-blue-500" label="PRs" />
                  <LegendDot color="bg-purple-500" label="Reviews" />
                  <LegendDot color="bg-amber-500" label="Comments" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent merged PRs with code volume */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recently Merged PRs</CardTitle>
            <CardDescription className="text-xs">Your latest merged pull requests with code volume</CardDescription>
          </CardHeader>
          <CardContent>
            {data.prCycleTimes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No merged PRs in this period</p>
            ) : (
              <div className="space-y-1">
                {data.prCycleTimes.slice(0, 15).map((pr) => (
                  <a key={`${pr.repo}#${pr.prNumber}`} href={pr.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 text-xs py-1.5 px-2 rounded hover:bg-muted transition-colors">
                    <span className="flex-1 min-w-0 truncate text-foreground">{pr.prTitle}</span>
                    <span className="text-muted-foreground shrink-0">{pr.repo.split("/")[1]}#{pr.prNumber}</span>
                    <span className="text-green-500 shrink-0 font-mono">+{pr.additions}</span>
                    <span className="text-red-500 shrink-0 font-mono">-{pr.deletions}</span>
                    <span className="text-muted-foreground shrink-0 w-12 text-right">{formatCycleTime(pr.cycleHours)}</span>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: string | number; color: string; bg: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className={cn("text-2xl font-bold", color)}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-2 h-2 rounded-full", color)} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────

interface DashboardProps {
  token: string;
  onDisconnect: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(delta);
    };
    const handleMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onResize]);

  return (
    <div
      className="w-1 shrink-0 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors relative group"
      onMouseDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        lastX.current = e.clientX;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

// ── Keyboard Shortcut Help ─────────────────────────────────────────

function KeyboardShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const shortcuts = [
    { key: "j / ↓", desc: "Next PR" },
    { key: "k / ↑", desc: "Previous PR" },
    { key: "Enter", desc: "Open selected PR" },
    { key: "Esc", desc: "Close panel" },
    { key: "n", desc: "Jump to next unseen PR" },
    { key: "s", desc: "Toggle seen on selected PR" },
    { key: "r", desc: "Refresh" },
    { key: "?", desc: "Toggle this help" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><KeyboardIcon /> Keyboard shortcuts</h3>
          <Button variant="ghost" size="icon-xs" onClick={onClose}><XIcon /></Button>
        </div>
        <div className="space-y-1.5">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">{s.desc}</span>
              <kbd className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded border border-border">{s.key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Notification Manager ──────────────────────────────────────────

function useNotifications(prs: DashboardPR[], enabled: boolean) {
  const prevPRsRef = useRef<Map<string, DashboardPR>>(new Map());

  useEffect(() => {
    if (!enabled || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || Notification.permission !== "granted") return;

    const prev = prevPRsRef.current;
    if (prev.size === 0) {
      // First load — populate without notifying
      const map = new Map<string, DashboardPR>();
      for (const pr of prs) map.set(`${pr.repo}#${pr.number}`, pr);
      prevPRsRef.current = map;
      return;
    }

    for (const pr of prs) {
      const key = `${pr.repo}#${pr.number}`;
      const old = prev.get(key);
      if (!old) continue;

      if (pr.category === "needs_attention" && old.category !== "needs_attention") {
        new Notification(`PR needs attention: ${pr.title}`, {
          body: `${pr.repo}#${pr.number} — moved to "Needs Attention"`,
          icon: pr.authorAvatar,
        });
      }
    }

    const map = new Map<string, DashboardPR>();
    for (const pr of prs) map.set(`${pr.repo}#${pr.number}`, pr);
    prevPRsRef.current = map;
  }, [prs, enabled]);
}

// ── Activity Tracker ────────────────────────────────────────────────

function ActivityTracker({ token, username, org }: { token: string; username: string; org: string | null }) {
  const [activity, setActivity] = useState<DailyActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<"reviews" | "comments" | "merges" | null>(null);

  const { isVisible: activityVisible } = useDocumentVisibility();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDailyActivity(token, username, org).then((data) => {
      if (!cancelled) { setActivity(data); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, username, org]);

  // Periodic silent refresh
  useEffect(() => {
    if (!activityVisible) return;
    const id = setInterval(() => {
      fetchDailyActivity(token, username, org).then(setActivity).catch(() => {});
    }, ACTIVITY_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, username, org, activityVisible]);

  if (loading) {
    return (
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-4 w-20 skeleton-shimmer rounded" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-6 w-14 skeleton-shimmer rounded-full" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!activity) return null;

  const stats = [
    { key: "reviews" as const, label: "Reviews", count: activity.reviewsSubmitted.length, color: "text-blue-500", bg: "bg-blue-500/10" },
    { key: "comments" as const, label: "Comments", count: activity.commentsMade.length, color: "text-amber-500", bg: "bg-amber-500/10" },
    { key: "merges" as const, label: "Merged", count: activity.prsMerged.length, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  const total = stats.reduce((s, x) => s + x.count, 0);

  return (
    <div className="border-b border-border">
      <div className="px-4 py-2 flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">Today</span>
        <div className="flex items-center gap-1.5">
          {stats.map((s) => (
            <button
              key={s.key}
              onClick={() => setExpanded(expanded === s.key ? null : s.key)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
                expanded === s.key ? `${s.bg} ${s.color}` : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={s.color}>{s.count}</span>
              {s.label}
            </button>
          ))}
        </div>
        {total === 0 && <span className="text-xs text-muted-foreground">No activity yet</span>}
      </div>
      {expanded && (
        <div className="px-4 pb-2 max-h-48 overflow-y-auto animate-fade-in-down">
          <div className="space-y-1 stagger-children">
            {expanded === "reviews" && activity.reviewsSubmitted.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block text-xs py-1 px-2 rounded hover:bg-muted transition-colors">
                <span className="text-foreground">{r.prTitle}</span>
                <span className="text-muted-foreground ml-1.5">{r.repo}#{r.prNumber}</span>
                <span className={cn("ml-1.5", r.state === "APPROVED" ? "text-green-500" : r.state === "CHANGES_REQUESTED" ? "text-red-500" : "text-muted-foreground")}>{r.state.toLowerCase().replace("_", " ")}</span>
              </a>
            ))}
            {expanded === "comments" && activity.commentsMade.map((c, i) => (
              <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="block text-xs py-1 px-2 rounded hover:bg-muted transition-colors">
                <span className="text-foreground">{c.prTitle}</span>
                <span className="text-muted-foreground ml-1.5">{c.repo}#{c.prNumber}</span>
              </a>
            ))}
            {expanded === "merges" && activity.prsMerged.map((m, i) => (
              <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="block text-xs py-1 px-2 rounded hover:bg-muted transition-colors">
                <span className="text-foreground">{m.prTitle}</span>
                <span className="text-muted-foreground ml-1.5">{m.repo}#{m.prNumber}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function useDeferredValue<T>(value: T, delay: number): { current: T; isOpen: boolean } {
  const [deferred, setDeferred] = useState(value);
  const [isOpen, setIsOpen] = useState(!!value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setDeferred(value);
      // RAF to ensure the DOM renders before triggering the transition
      requestAnimationFrame(() => setIsOpen(true));
    } else {
      setIsOpen(false);
      timeoutRef.current = setTimeout(() => setDeferred(value), delay);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [value, delay]);

  return { current: deferred || value, isOpen: !!value };
}

export function Dashboard({ token, onDisconnect, theme, setTheme }: DashboardProps) {
  const [org, setOrg] = useLocalStorage<string | null>("gh-dashboard-org", null);
  const [orgs, setOrgs] = useState<Array<{ login: string; avatar_url: string }>>([]);
  const [view, setView] = useState<"dashboard" | "analytics">("dashboard");
  const { prs, user, loading, enriching, error, refresh, lastRefreshed, updatePR } = usePRs(token, org);

  // Fetch user orgs on mount
  useEffect(() => {
    fetchUserOrgs(token).then(setOrgs).catch(() => setOrgs([]));
  }, [token]);
  const { filters, setFilter, filteredPRs, groupedPRs, availableRepos, availableAuthors, availableLabels } =
    useFilters(prs);
  const [selectedPR, setSelectedPR] = useState<DashboardPR | null>(null);
  const panel = useDeferredValue(selectedPR, 350);
  // theme and setTheme are passed as props from page level
  const [leftWidth, setLeftWidth] = useState(420);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    const map = loadPRSeenMap();
    const ids = new Set<string>();
    for (const key of Object.keys(map)) ids.add(key);
    return ids;
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<number>>(new Set());

  const handleBatchToggle = useCallback((pr: DashboardPR) => {
    setBatchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pr.id)) next.delete(pr.id);
      else next.add(pr.id);
      return next;
    });
  }, []);

  const batchMarkSeen = useCallback(() => {
    for (const pr of prs) {
      if (batchSelected.has(pr.id)) markPRSeen(pr);
    }
    setSeenIds((prev) => {
      const next = new Set(prev);
      for (const pr of prs) {
        if (batchSelected.has(pr.id)) next.add(`${pr.repo}#${pr.number}`);
      }
      return next;
    });
    setBatchSelected(new Set());
    setBatchMode(false);
  }, [prs, batchSelected]);

  const batchSelectAll = useCallback(() => {
    setBatchSelected(new Set(filteredPRs.map((pr) => pr.id)));
  }, [filteredPRs]);

  const batchSelectNone = useCallback(() => {
    setBatchSelected(new Set());
  }, []);

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try { return localStorage.getItem("gh-notifications") === "true"; } catch { return false; }
  });
  const handleResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.max(300, Math.min(800, w + delta)));
  }, []);

  // Notifications
  useNotifications(prs, notificationsEnabled);

  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem("gh-notifications", String(next)); } catch { /* ignore */ }
      if (next && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
      return next;
    });
  }, []);

  // Compute which PRs are actually "seen" (not updated since last viewed)
  const seenPRIds = React.useMemo(() => {
    const result = new Set<string>();
    const map = loadPRSeenMap();
    for (const pr of prs) {
      const key = `${pr.repo}#${pr.number}`;
      const lastSeen = map[key];
      if (lastSeen && new Date(lastSeen).getTime() >= new Date(pr.updatedAt).getTime()) {
        result.add(key);
      }
    }
    return result;
  }, [prs, seenIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flat list of all visible PRs for keyboard navigation
  const flatPRList = React.useMemo(() => {
    const result: DashboardPR[] = [];
    for (const [, groupPRs] of groupedPRs.entries()) {
      const sorted = [...groupPRs].sort((a, b) => {
        const aSeen = seenPRIds.has(`${a.repo}#${a.number}`);
        const bSeen = seenPRIds.has(`${b.repo}#${b.number}`);
        if (aSeen !== bSeen) return aSeen ? 1 : -1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      result.push(...sorted);
    }
    return result;
  }, [groupedPRs, seenPRIds]);

  const handleSelectPR = useCallback((pr: DashboardPR) => {
    setSelectedPR(pr);
  }, []);

  const handleToggleSeen = useCallback((pr: DashboardPR) => {
    const key = `${pr.repo}#${pr.number}`;
    const map = loadPRSeenMap();
    const isSeen = map[key] && new Date(map[key]).getTime() >= new Date(pr.updatedAt).getTime();
    if (isSeen) {
      unmarkPRSeen(pr);
      setSeenIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      markPRSeen(pr);
      setSeenIds((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }
  }, []);

  // Bulk mark all visible PRs as seen
  const markAllSeen = useCallback(() => {
    for (const pr of filteredPRs) {
      markPRSeen(pr);
    }
    setSeenIds((prev) => {
      const next = new Set(prev);
      for (const pr of filteredPRs) next.add(`${pr.repo}#${pr.number}`);
      return next;
    });
  }, [filteredPRs]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const currentIndex = selectedPR ? flatPRList.findIndex((p) => p.id === selectedPR.id) : -1;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(currentIndex + 1, flatPRList.length - 1);
        if (flatPRList[next]) setSelectedPR(flatPRList[next]);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(currentIndex - 1, 0);
        if (flatPRList[next]) setSelectedPR(flatPRList[next]);
      } else if (e.key === "Enter" && !selectedPR && flatPRList.length > 0) {
        e.preventDefault();
        setSelectedPR(flatPRList[0]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (showShortcuts) setShowShortcuts(false);
        else setSelectedPR(null);
      } else if (e.key === "n") {
        e.preventDefault();
        const nextUnseen = flatPRList.find((p) => !seenPRIds.has(`${p.repo}#${p.number}`));
        if (nextUnseen) setSelectedPR(nextUnseen);
      } else if (e.key === "s" && selectedPR) {
        e.preventDefault();
        handleToggleSeen(selectedPR);
      } else if (e.key === "r") {
        e.preventDefault();
        refresh();
      } else if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedPR, flatPRList, seenPRIds, handleToggleSeen, refresh, showShortcuts]);

  const hasActiveFilters =
    !!filters.search || !!filters.repo || !!filters.author || !!filters.label;

  // Keep selectedPR in sync with updated PR data
  const currentSelected = selectedPR ? prs.find((p) => p.id === selectedPR.id) ?? selectedPR : null;

  return (
    <TooltipProvider>
      <KeyboardShortcutHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <div className="h-screen flex flex-col bg-background">
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
          org={org}
          orgs={orgs}
          onOrgChange={setOrg}
        />

        {view === "dashboard" && user && <ActivityTracker token={token} username={user.login} org={org} />}

        {view === "analytics" && user ? (
          <AnalyticsPage token={token} username={user.login} org={org} onBack={() => setView("dashboard")} />
        ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: PR list */}
          <div
            className={`${currentSelected || panel.current ? "shrink-0" : "flex-1 max-w-5xl mx-auto"} flex flex-col overflow-hidden transition-all duration-300 ease-out`}
            style={(currentSelected || panel.current) ? { width: leftWidth } : undefined}
          >
            <div className="px-4 shrink-0">
              {error && (
                <div className="mt-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center justify-between">
                  <span>{error}</span>
                  <Button variant="link" size="xs" onClick={onDisconnect} className="text-red-400">Disconnect</Button>
                </div>
              )}
              <FilterBar
                filters={filters}
                setFilter={setFilter}
                availableRepos={availableRepos}
                availableAuthors={availableAuthors}
                availableLabels={availableLabels}
              />
              {/* Toolbar: compact actions */}
              <div className="flex items-center gap-1.5 pb-2">
                {batchMode ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[11px] text-muted-foreground">{batchSelected.size} selected</span>
                    <Button variant="ghost" size="sm" className="text-[11px] h-6 px-2" onClick={batchSelectAll}>All</Button>
                    <Button variant="ghost" size="sm" className="text-[11px] h-6 px-2" onClick={batchSelectNone}>None</Button>
                    <div className="flex-1" />
                    <Button variant="secondary" size="sm" className="text-[11px] h-6 px-2" onClick={batchMarkSeen} disabled={batchSelected.size === 0}>
                      Mark seen ({batchSelected.size})
                    </Button>
                    <Button variant="ghost" size="sm" className="text-[11px] h-6 px-2" onClick={() => { setBatchMode(false); setBatchSelected(new Set()); }}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" className="text-[11px] h-6 px-2" onClick={() => setBatchMode(true)}>
                      Select
                    </Button>
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" className="text-[11px] h-6 px-2" onClick={markAllSeen}>
                      Mark all seen
                    </Button>
                  </>
                )}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant={notificationsEnabled ? "secondary" : "ghost"}
                        size="icon-xs"
                        onClick={toggleNotifications}
                      />
                    }
                  >
                    <BellIcon />
                  </TooltipTrigger>
                  <TooltipContent>{notificationsEnabled ? "Notifications on" : "Enable notifications"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="icon-xs" onClick={() => setView("analytics")} />
                    }
                  >
                    <BarChartIcon />
                  </TooltipTrigger>
                  <TooltipContent>Analytics</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="icon-xs" onClick={() => setShowShortcuts(true)} />
                    }
                  >
                    <KeyboardIcon />
                  </TooltipTrigger>
                  <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {loading ? (
                <div className="space-y-1.5 stagger-children">
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
                      onSelect={handleSelectPR}
                      seenIds={seenPRIds}
                      onToggleSeen={handleToggleSeen}
                      defaultOpen={group !== "Other"}
                      batchMode={batchMode}
                      batchSelected={batchSelected}
                      onBatchToggle={handleBatchToggle}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resize handle */}
          {(currentSelected || panel.current) && <ResizeHandle onResize={handleResize} />}

          {/* Right: Side panel */}
          {(currentSelected || panel.current) && (
            <div
              className="flex-1 min-w-0 overflow-hidden transition-all duration-300 ease-out"
              style={{
                transform: panel.isOpen ? "translateX(0)" : "translateX(100%)",
                opacity: panel.isOpen ? 1 : 0,
              }}
            >
              {(panel.current ?? currentSelected) && (
                <SidePanel
                  key={(panel.current ?? currentSelected)!.id}
                  pr={(panel.current ?? currentSelected)!}
                  token={token}
                  onClose={() => setSelectedPR(null)}
                  onRefresh={refresh}
                  onOptimisticUpdate={(patch) => updatePR((panel.current ?? currentSelected)!.id, patch)}
                />
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </TooltipProvider>
  );
}
