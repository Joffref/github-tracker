import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFilters } from "../lib/hooks";
import type { DashboardPR } from "../lib/github";

function makePR(overrides: Partial<DashboardPR> = {}): DashboardPR {
  return {
    id: 1,
    number: 42,
    title: "Test PR",
    body: "",
    url: "https://github.com/owner/repo/pull/42",
    repo: "owner/repo",
    author: "testuser",
    authorAvatar: "",
    isBot: false,
    labels: [],
    isDraft: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hasConflicts: false,
    ciStatus: "unknown",
    reviewState: "unknown",
    reviewRequestedFromMe: false,
    reviewers: [],
    category: "other",
    headSha: "abc123",
    baseRef: "main",
    headRef: "feature",
    onDevelop: null,
    additions: 10,
    deletions: 5,
    changedFiles: 3,
    hasNewCommitsSinceMyReview: false,
    requestedReviewers: [],
    ...overrides,
  };
}

const samplePRs: DashboardPR[] = [
  makePR({ id: 1, title: "Fix auth bug", repo: "org/frontend", author: "alice", category: "needs_attention", ciStatus: "failure", labels: [{ name: "bug", color: "d73a4a" }] }),
  makePR({ id: 2, title: "Add search", repo: "org/frontend", author: "bob", category: "waiting", isDraft: true }),
  makePR({ id: 3, title: "Update deps", repo: "org/backend", author: "dependabot[bot]", isBot: true, category: "other" }),
  makePR({ id: 4, title: "Refactor API", repo: "org/backend", author: "alice", category: "needs_attention", hasConflicts: true }),
  makePR({ id: 5, title: "Docs update", repo: "org/docs", author: "carol", category: "other", onDevelop: "yes", reviewState: "approved" }),
];

// ── useFilters ───────────────────────────────────────────────────────

describe("useFilters", () => {
  describe("initial state", () => {
    it("returns all PRs unfiltered", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      expect(result.current.filteredPRs).toHaveLength(5);
    });

    it("groups by category by default", () => {
      const { result } = renderHook(() => useFilters(samplePRs));
      const groups = result.current.groupedPRs;

      expect(groups.has("Needs My Attention")).toBe(true);
      expect(groups.has("Waiting on Others")).toBe(true);
      expect(groups.has("Other")).toBe(true);
      expect(groups.get("Needs My Attention")!.length).toBe(2);
      expect(groups.get("Waiting on Others")!.length).toBe(1);
      expect(groups.get("Other")!.length).toBe(2);
    });
  });

  describe("filtering by repo", () => {
    it("filters to a specific repo", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("repo", "org/frontend"));

      expect(result.current.filteredPRs).toHaveLength(2);
      expect(result.current.filteredPRs.every((pr) => pr.repo === "org/frontend")).toBe(true);
    });

    it("clears repo filter with null", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("repo", "org/frontend"));
      act(() => result.current.setFilter("repo", null));

      expect(result.current.filteredPRs).toHaveLength(5);
    });
  });

  describe("filtering by author", () => {
    it("filters to a specific author", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("author", "alice"));

      expect(result.current.filteredPRs).toHaveLength(2);
    });
  });

  describe("filtering by CI status", () => {
    it("shows only PRs with matching CI status", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("ciStatus", "failure"));

      expect(result.current.filteredPRs).toHaveLength(1);
      expect(result.current.filteredPRs[0].title).toBe("Fix auth bug");
    });
  });

  describe("filtering by draft status", () => {
    it("shows only draft PRs", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("isDraft", true));

      expect(result.current.filteredPRs).toHaveLength(1);
      expect(result.current.filteredPRs[0].title).toBe("Add search");
    });

    it("shows only non-draft PRs", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("isDraft", false));

      expect(result.current.filteredPRs).toHaveLength(4);
    });
  });

  describe("filtering by conflicts", () => {
    it("shows only PRs with conflicts", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("hasConflicts", true));

      expect(result.current.filteredPRs).toHaveLength(1);
      expect(result.current.filteredPRs[0].title).toBe("Refactor API");
    });
  });

  describe("filtering by label", () => {
    it("shows only PRs with a specific label", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("label", "bug"));

      expect(result.current.filteredPRs).toHaveLength(1);
      expect(result.current.filteredPRs[0].title).toBe("Fix auth bug");
    });
  });

  describe("hide bots", () => {
    it("filters out bot PRs", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("hideBots", true));

      expect(result.current.filteredPRs).toHaveLength(4);
      expect(result.current.filteredPRs.every((pr) => !pr.isBot)).toBe(true);
    });
  });

  describe("hide on develop", () => {
    it("filters out PRs already on develop", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("hideOnDevelop", true));

      expect(result.current.filteredPRs).toHaveLength(4);
      expect(result.current.filteredPRs.every((pr) => pr.onDevelop !== "yes")).toBe(true);
    });
  });

  describe("search", () => {
    it("searches by title", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("search", "auth"));

      expect(result.current.filteredPRs).toHaveLength(1);
      expect(result.current.filteredPRs[0].title).toBe("Fix auth bug");
    });

    it("searches by repo", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("search", "backend"));

      expect(result.current.filteredPRs).toHaveLength(2);
    });

    it("searches by author", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("search", "carol"));

      expect(result.current.filteredPRs).toHaveLength(1);
    });

    it("searches by label name", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("search", "bug"));

      expect(result.current.filteredPRs).toHaveLength(1);
    });

    it("search is case-insensitive", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("search", "FIX AUTH"));

      expect(result.current.filteredPRs).toHaveLength(1);
    });
  });

  describe("grouping", () => {
    it("groups by repo", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("groupBy", "repo"));

      const groups = result.current.groupedPRs;
      expect(groups.has("org/frontend")).toBe(true);
      expect(groups.has("org/backend")).toBe(true);
      expect(groups.has("org/docs")).toBe(true);
      expect(groups.get("org/frontend")!.length).toBe(2);
      expect(groups.get("org/backend")!.length).toBe(2);
    });

    it("groups by author", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("groupBy", "author"));

      const groups = result.current.groupedPRs;
      expect(groups.has("alice")).toBe(true);
      expect(groups.get("alice")!.length).toBe(2);
    });

    it("groups by review status", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("groupBy", "status"));

      const groups = result.current.groupedPRs;
      expect(groups.has("unknown")).toBe(true);
      expect(groups.has("approved")).toBe(true);
    });
  });

  describe("available options", () => {
    it("computes available repos", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      expect(result.current.availableRepos).toEqual([
        "org/backend",
        "org/docs",
        "org/frontend",
      ]);
    });

    it("computes available authors", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      expect(result.current.availableAuthors).toContain("alice");
      expect(result.current.availableAuthors).toContain("bob");
      expect(result.current.availableAuthors).toContain("carol");
    });

    it("computes available labels", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      expect(result.current.availableLabels).toEqual(["bug"]);
    });

    it("excludes bots from available authors when hideBots is on", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => result.current.setFilter("hideBots", true));

      expect(result.current.availableAuthors).not.toContain("dependabot[bot]");
    });
  });

  describe("combined filters", () => {
    it("applies multiple filters together", () => {
      const { result } = renderHook(() => useFilters(samplePRs));

      act(() => {
        result.current.setFilter("repo", "org/frontend");
        result.current.setFilter("author", "alice");
      });

      expect(result.current.filteredPRs).toHaveLength(1);
      expect(result.current.filteredPRs[0].title).toBe("Fix auth bug");
    });
  });

  describe("empty input", () => {
    it("handles empty PR array", () => {
      const { result } = renderHook(() => useFilters([]));

      expect(result.current.filteredPRs).toHaveLength(0);
      expect(result.current.groupedPRs.size).toBe(0);
      expect(result.current.availableRepos).toEqual([]);
    });
  });
});
