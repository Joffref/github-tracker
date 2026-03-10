"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  fetchUser,
  fetchOpenPRs,
  enrichAllPRs,
  type DashboardPR,
  type GitHubUser,
  type CIStatus,
  type ReviewState,
} from "./github";
import { categorizePR, REFRESH_INTERVAL_MS } from "./constants";

// ── useLocalStorage ────────────────────────────────────────────────

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (v: T) => void] {
  const [stored, setStored] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const item = localStorage.getItem(key);
      if (item !== null) setStored(JSON.parse(item));
    } catch {
      // ignore
    }
  }, [key]);

  const setValue = useCallback(
    (value: T) => {
      setStored(value);
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // ignore
      }
    },
    [key]
  );

  return [stored, setValue];
}

// ── useTheme ──────────────────────────────────────────────────────

export type Theme = "light" | "dark" | "system";

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem("gh-dashboard-theme") as Theme | null;
    if (stored === "light" || stored === "dark") setThemeState(stored);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    const root = document.documentElement;
    if (t === "system") {
      localStorage.removeItem("gh-dashboard-theme");
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    } else if (t === "dark") {
      localStorage.setItem("gh-dashboard-theme", "dark");
      root.classList.add("dark");
    } else {
      localStorage.setItem("gh-dashboard-theme", "light");
      root.classList.remove("dark");
    }
  }, []);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return [theme, setTheme];
}

// ── usePRs ─────────────────────────────────────────────────────────

interface UsePRsReturn {
  prs: DashboardPR[];
  user: GitHubUser | null;
  loading: boolean;
  enriching: boolean;
  error: string | null;
  refresh: () => void;
  lastRefreshed: Date | null;
}

export function usePRs(token: string | null, org?: string | null): UsePRsReturn {
  const [prs, setPRs] = useState<DashboardPR[]>([]);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const abortRef = useRef(false);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    const isBackgroundRefresh = hasLoadedOnce.current;

    // Only show full loading state on initial load
    if (!isBackgroundRefresh) {
      setLoading(true);
    }
    setError(null);
    abortRef.current = false;

    try {
      const ghUser = await fetchUser(token);
      if (abortRef.current) return;
      setUser(ghUser);

      const rawPRs = await fetchOpenPRs(token, ghUser.login, org);
      if (abortRef.current) return;

      // Categorize with initial data
      const categorized = rawPRs.map((pr) => ({
        ...pr,
        category: categorizePR(pr, ghUser.login),
      }));

      if (isBackgroundRefresh) {
        // Merge: update existing PRs in place, add new ones, remove closed ones
        setPRs((prev) => {
          const prevMap = new Map(prev.map((p) => [p.id, p]));
          return categorized.map((pr) => {
            const existing = prevMap.get(pr.id);
            if (existing) {
              // Keep enriched data if the PR hasn't been updated since
              if (existing.updatedAt === pr.updatedAt) return existing;
              // PR was updated — use new base data, preserve enriched fields that are still valid
              return { ...existing, ...pr, category: categorizePR(pr, ghUser.login) };
            }
            return pr;
          });
        });
      } else {
        setPRs(categorized);
      }

      setLoading(false);
      hasLoadedOnce.current = true;
      setLastRefreshed(new Date());

      // Enrich in background
      setEnriching(true);
      await enrichAllPRs(token, categorized, ghUser.login, (_index, enrichedPR) => {
        if (abortRef.current) return;
        const recategorized = {
          ...enrichedPR,
          category: categorizePR(enrichedPR, ghUser.login),
        };
        setPRs((prev) => {
          const idx = prev.findIndex((p) => p.id === recategorized.id);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = recategorized;
          return next;
        });
      });
      setEnriching(false);
    } catch (err) {
      if (abortRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to fetch");
      setLoading(false);
      setEnriching(false);
    }
  }, [token, org]);

  // Reset when org changes
  useEffect(() => {
    hasLoadedOnce.current = false;
    setPRs([]);
    setLastRefreshed(null);
  }, [org]);

  useEffect(() => {
    load();
    return () => {
      abortRef.current = true;
    };
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, load]);

  return { prs, user, loading, enriching, error, refresh: load, lastRefreshed };
}

// ── useFilters ─────────────────────────────────────────────────────

export type GroupBy = "none" | "repo" | "author" | "status";

export interface FilterState {
  repo: string | null;
  author: string | null;
  ciStatus: CIStatus | null;
  reviewStatus: ReviewState | null;
  label: string | null;
  isDraft: boolean | null;
  hasConflicts: boolean | null;
  groupBy: GroupBy;
  hideBots: boolean;
  hideOnDevelop: boolean;
  search: string;
}

const defaultFilters: FilterState = {
  repo: null,
  author: null,
  ciStatus: null,
  reviewStatus: null,
  label: null,
  isDraft: null,
  hasConflicts: null,
  groupBy: "none",
  hideBots: false,
  hideOnDevelop: false,
  search: "",
};

export function useFilters(prs: DashboardPR[]) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const setFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const filteredPRs = useMemo(() => {
    return prs.filter((pr) => {
      if (filters.hideBots && pr.isBot) return false;
      if (filters.hideOnDevelop && pr.onDevelop === "yes") return false;
      if (filters.repo && pr.repo !== filters.repo) return false;
      if (filters.author && pr.author !== filters.author) return false;
      if (filters.ciStatus && pr.ciStatus !== filters.ciStatus) return false;
      if (filters.reviewStatus && pr.reviewState !== filters.reviewStatus)
        return false;
      if (filters.label && !pr.labels.some((l) => l.name === filters.label))
        return false;
      if (filters.isDraft === true && !pr.isDraft) return false;
      if (filters.isDraft === false && pr.isDraft) return false;
      if (filters.hasConflicts === true && !pr.hasConflicts) return false;
      if (filters.hasConflicts === false && pr.hasConflicts) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match =
          pr.title.toLowerCase().includes(q) ||
          pr.repo.toLowerCase().includes(q) ||
          pr.author.toLowerCase().includes(q) ||
          pr.labels.some((l) => l.name.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [prs, filters]);

  const groupedPRs = useMemo(() => {
    const groups = new Map<string, DashboardPR[]>();
    if (filters.groupBy === "none") {
      // Default: group by category
      const attention: DashboardPR[] = [];
      const waiting: DashboardPR[] = [];
      const other: DashboardPR[] = [];
      for (const pr of filteredPRs) {
        if (pr.category === "needs_attention") attention.push(pr);
        else if (pr.category === "waiting") waiting.push(pr);
        else other.push(pr);
      }
      if (attention.length) groups.set("Needs My Attention", attention);
      if (waiting.length) groups.set("Waiting on Others", waiting);
      if (other.length) groups.set("Other", other);
    } else {
      for (const pr of filteredPRs) {
        const key =
          filters.groupBy === "repo"
            ? pr.repo
            : filters.groupBy === "author"
              ? pr.author
              : filters.groupBy === "status"
                ? pr.reviewState
                : "";
        const arr = groups.get(key) ?? [];
        arr.push(pr);
        groups.set(key, arr);
      }
    }
    return groups;
  }, [filteredPRs, filters.groupBy]);

  const availableRepos = useMemo(
    () => [...new Set(prs.filter((p) => !p.isBot || !filters.hideBots).map((p) => p.repo))].sort(),
    [prs, filters.hideBots]
  );

  const availableAuthors = useMemo(
    () => [...new Set(prs.filter((p) => !p.isBot || !filters.hideBots).map((p) => p.author))].sort(),
    [prs, filters.hideBots]
  );

  const availableLabels = useMemo(
    () => [...new Set(prs.flatMap((p) => p.labels.map((l) => l.name)))].sort(),
    [prs]
  );

  return {
    filters,
    setFilter,
    filteredPRs,
    groupedPRs,
    availableRepos,
    availableAuthors,
    availableLabels,
  };
}
