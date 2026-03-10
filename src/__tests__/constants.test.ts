import { describe, it, expect } from "vitest";
import { isBot, categorizePR, timeAgo } from "../lib/constants";
import type { DashboardPR } from "../lib/github";

// ── isBot ────────────────────────────────────────────────────────────

describe("isBot", () => {
  it("detects known bots by exact username", () => {
    expect(isBot("dependabot[bot]")).toBe(true);
    expect(isBot("renovate[bot]")).toBe(true);
    expect(isBot("github-actions[bot]")).toBe(true);
    expect(isBot("codecov[bot]")).toBe(true);
    expect(isBot("mergify[bot]")).toBe(true);
  });

  it("detects bots by suffix", () => {
    expect(isBot("my-custom[bot]")).toBe(true);
    expect(isBot("deploy-bot")).toBe(true);
  });

  it("returns false for regular users", () => {
    expect(isBot("octocat")).toBe(false);
    expect(isBot("john-doe")).toBe(false);
    expect(isBot("bot-lover")).toBe(false); // "bot" in middle, not suffix
  });
});

// ── categorizePR ─────────────────────────────────────────────────────

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
    ...overrides,
  };
}

describe("categorizePR", () => {
  const me = "testuser";

  describe("needs_attention", () => {
    it("flags PRs where review is requested from me", () => {
      const pr = makePR({ author: "other", reviewRequestedFromMe: true });
      expect(categorizePR(pr, me)).toBe("needs_attention");
    });

    it("flags my PRs with changes requested", () => {
      const pr = makePR({ reviewState: "changes_requested" });
      expect(categorizePR(pr, me)).toBe("needs_attention");
    });

    it("flags my PRs with failing CI", () => {
      const pr = makePR({ ciStatus: "failure" });
      expect(categorizePR(pr, me)).toBe("needs_attention");
    });

    it("flags my PRs with merge conflicts", () => {
      const pr = makePR({ hasConflicts: true });
      expect(categorizePR(pr, me)).toBe("needs_attention");
    });

    it("flags other's PRs with new commits since my review", () => {
      const pr = makePR({ author: "other", hasNewCommitsSinceMyReview: true });
      expect(categorizePR(pr, me)).toBe("needs_attention");
    });
  });

  describe("waiting", () => {
    it("marks my PRs awaiting review as waiting", () => {
      const pr = makePR({ reviewState: "review_required" });
      expect(categorizePR(pr, me)).toBe("waiting");
    });

    it("marks my PRs with pending CI as waiting", () => {
      const pr = makePR({ ciStatus: "pending" });
      expect(categorizePR(pr, me)).toBe("waiting");
    });
  });

  describe("other", () => {
    it("marks my approved PRs as other", () => {
      const pr = makePR({ reviewState: "approved" });
      expect(categorizePR(pr, me)).toBe("other");
    });

    it("marks other people's PRs without review request as other", () => {
      const pr = makePR({ author: "other", reviewRequestedFromMe: false });
      expect(categorizePR(pr, me)).toBe("other");
    });

    it("handles case-insensitive username comparison", () => {
      const pr = makePR({ author: "TestUser", reviewState: "changes_requested" });
      expect(categorizePR(pr, "testuser")).toBe("needs_attention");
    });
  });

  describe("priority order", () => {
    it("approved takes precedence over CI failure for own PRs", () => {
      const pr = makePR({ reviewState: "approved", ciStatus: "failure" });
      // approved check comes first, returns "other"
      expect(categorizePR(pr, me)).toBe("other");
    });
  });
});

// ── timeAgo ──────────────────────────────────────────────────────────

describe("timeAgo", () => {
  it("shows 'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe("just now");
  });

  it("shows minutes", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("shows hours", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe("3h ago");
  });

  it("shows days", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoDaysAgo)).toBe("2d ago");
  });

  it("shows months", () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoMonthsAgo)).toBe("2mo ago");
  });
});
