import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchUser,
  fetchOpenPRs,
  fetchPRFiles,
  fetchIssueComments,
  fetchCheckRuns,
  postComment,
  submitReview,
  closePR,
  mergePR,
  addLabels,
  removeLabel,
  checkOnDevelop,
  fetchThreadResolutions,
  resolveReviewThread,
  unresolveReviewThread,
  requestReviewers,
  removeReviewRequest,
  fetchCollaborators,
} from "../lib/github";

// ── Mock fetch ───────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function errorResponse(status: number, body: string) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

const TOKEN = "ghp_test_token_123";

// ── fetchUser ────────────────────────────────────────────────────────

describe("fetchUser", () => {
  it("returns the authenticated user", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ login: "octocat", avatar_url: "https://example.com/avatar.png" })
    );

    const user = await fetchUser(TOKEN);

    expect(user.login).toBe("octocat");
    expect(user.avatar_url).toBe("https://example.com/avatar.png");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/user",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
      })
    );
  });

  it("throws on API error", async () => {
    mockFetch.mockReturnValueOnce(errorResponse(401, "Bad credentials"));

    await expect(fetchUser(TOKEN)).rejects.toThrow("GitHub API 401");
  });
});

// ── fetchOpenPRs ─────────────────────────────────────────────────────

describe("fetchOpenPRs", () => {
  it("maps search results to DashboardPR[]", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        total_count: 1,
        items: [
          {
            id: 123,
            number: 42,
            title: "Add feature",
            body: "Description here",
            html_url: "https://github.com/owner/repo/pull/42",
            repository_url: "https://api.github.com/repos/owner/repo",
            user: { login: "octocat", avatar_url: "https://example.com/avatar.png" },
            labels: [{ name: "bug", color: "d73a4a" }],
            draft: false,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
          },
        ],
      })
    );

    const prs = await fetchOpenPRs(TOKEN, "octocat");

    expect(prs).toHaveLength(1);
    expect(prs[0].id).toBe(123);
    expect(prs[0].number).toBe(42);
    expect(prs[0].title).toBe("Add feature");
    expect(prs[0].repo).toBe("owner/repo");
    expect(prs[0].author).toBe("octocat");
    expect(prs[0].labels).toEqual([{ name: "bug", color: "d73a4a" }]);
    expect(prs[0].isDraft).toBe(false);
    // Initial values before enrichment
    expect(prs[0].ciStatus).toBe("unknown");
    expect(prs[0].reviewState).toBe("unknown");
    expect(prs[0].hasConflicts).toBe(false);
    expect(prs[0].additions).toBe(0);
    expect(prs[0].deletions).toBe(0);
  });

  it("paginates when there are more results than one page", async () => {
    // First page: 100 items
    const items100 = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      number: i,
      title: `PR ${i}`,
      body: "",
      html_url: `https://github.com/owner/repo/pull/${i}`,
      repository_url: "https://api.github.com/repos/owner/repo",
      user: { login: "octocat", avatar_url: "" },
      labels: [],
      draft: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    }));

    mockFetch
      .mockReturnValueOnce(jsonResponse({ total_count: 110, items: items100 }))
      .mockReturnValueOnce(
        jsonResponse({
          total_count: 110,
          items: items100.slice(0, 10).map((item) => ({ ...item, id: item.id + 100 })),
        })
      );

    const prs = await fetchOpenPRs(TOKEN, "octocat");

    expect(prs).toHaveLength(110);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("filters by org when provided", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ total_count: 0, items: [] }));

    await fetchOpenPRs(TOKEN, "octocat", "my-org");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain(encodeURIComponent("org:my-org"));
  });

  it("detects bot authors", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        total_count: 1,
        items: [
          {
            id: 1,
            number: 1,
            title: "Bump deps",
            body: "",
            html_url: "https://github.com/owner/repo/pull/1",
            repository_url: "https://api.github.com/repos/owner/repo",
            user: { login: "dependabot[bot]", avatar_url: "" },
            labels: [],
            draft: false,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
          },
        ],
      })
    );

    const prs = await fetchOpenPRs(TOKEN, "octocat");
    expect(prs[0].isBot).toBe(true);
  });
});

// ── fetchPRFiles ─────────────────────────────────────────────────────

describe("fetchPRFiles", () => {
  it("returns files changed in a PR", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse([
        { filename: "src/index.ts", status: "modified", additions: 10, deletions: 5, patch: "@@ -1,5 +1,10 @@" },
        { filename: "README.md", status: "added", additions: 20, deletions: 0 },
      ])
    );

    const files = await fetchPRFiles(TOKEN, "owner/repo", 42);

    expect(files).toHaveLength(2);
    expect(files[0].filename).toBe("src/index.ts");
    expect(files[0].additions).toBe(10);
    expect(files[1].status).toBe("added");
  });
});

// ── fetchIssueComments ───────────────────────────────────────────────

describe("fetchIssueComments", () => {
  it("returns comments on a PR", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse([
        {
          id: 1,
          user: { login: "reviewer", avatar_url: "" },
          body: "Looks good!",
          created_at: "2024-01-01T00:00:00Z",
          html_url: "https://github.com/owner/repo/pull/42#issuecomment-1",
        },
      ])
    );

    const comments = await fetchIssueComments(TOKEN, "owner/repo", 42);

    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe("Looks good!");
    expect(comments[0].user.login).toBe("reviewer");
  });
});

// ── fetchCheckRuns ───────────────────────────────────────────────────

describe("fetchCheckRuns", () => {
  it("returns check runs for a commit", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        total_count: 2,
        check_runs: [
          {
            id: 1,
            name: "test",
            status: "completed",
            conclusion: "success",
            started_at: "2024-01-01T00:00:00Z",
            completed_at: "2024-01-01T00:05:00Z",
            html_url: "https://github.com/owner/repo/runs/1",
            app: { name: "GitHub Actions", slug: "github-actions" },
            output: { title: "Tests passed", summary: "All tests passed" },
          },
          {
            id: 2,
            name: "lint",
            status: "completed",
            conclusion: "failure",
            started_at: "2024-01-01T00:00:00Z",
            completed_at: "2024-01-01T00:02:00Z",
            html_url: "https://github.com/owner/repo/runs/2",
            app: { name: "GitHub Actions", slug: "github-actions" },
            output: { title: "Lint failed", summary: null },
          },
        ],
      })
    );

    const runs = await fetchCheckRuns(TOKEN, "owner/repo", "abc123");

    expect(runs).toHaveLength(2);
    expect(runs[0].conclusion).toBe("success");
    expect(runs[1].conclusion).toBe("failure");
  });
});

// ── postComment ──────────────────────────────────────────────────────

describe("postComment", () => {
  it("posts a comment and returns it", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        id: 99,
        user: { login: "octocat", avatar_url: "" },
        body: "My comment",
        created_at: "2024-01-01T00:00:00Z",
        html_url: "https://github.com/owner/repo/pull/42#issuecomment-99",
      })
    );

    const comment = await postComment(TOKEN, "owner/repo", 42, "My comment");

    expect(comment.id).toBe(99);
    expect(comment.body).toBe("My comment");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues/42/comments");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ body: "My comment" });
  });

  it("throws on error", async () => {
    mockFetch.mockReturnValueOnce(errorResponse(403, "Forbidden"));
    await expect(postComment(TOKEN, "owner/repo", 42, "test")).rejects.toThrow("GitHub API 403");
  });
});

// ── submitReview ─────────────────────────────────────────────────────

describe("submitReview", () => {
  it("submits an approval", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({}));

    await submitReview(TOKEN, "owner/repo", 42, "APPROVE");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/pulls/42/reviews");
    expect(JSON.parse(options.body)).toEqual({ event: "APPROVE" });
  });

  it("submits changes requested with body", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({}));

    await submitReview(TOKEN, "owner/repo", 42, "REQUEST_CHANGES", "Please fix this");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.event).toBe("REQUEST_CHANGES");
    expect(body.body).toBe("Please fix this");
  });

  it("throws on error", async () => {
    mockFetch.mockReturnValueOnce(errorResponse(422, "Unprocessable"));
    await expect(submitReview(TOKEN, "owner/repo", 42, "APPROVE")).rejects.toThrow("GitHub API 422");
  });
});

// ── closePR ──────────────────────────────────────────────────────────

describe("closePR", () => {
  it("closes a PR via PATCH", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ state: "closed" }));

    await closePR(TOKEN, "owner/repo", 42);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/pulls/42");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({ state: "closed" });
  });

  it("throws on error", async () => {
    mockFetch.mockReturnValueOnce(errorResponse(404, "Not Found"));
    await expect(closePR(TOKEN, "owner/repo", 999)).rejects.toThrow("GitHub API 404");
  });
});

// ── mergePR ──────────────────────────────────────────────────────────

describe("mergePR", () => {
  it("squash merges by default", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ merged: true }));

    await mergePR(TOKEN, "owner/repo", 42);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.merge_method).toBe("squash");
  });

  it("supports different merge methods", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ merged: true }));

    await mergePR(TOKEN, "owner/repo", 42, "rebase");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.merge_method).toBe("rebase");
  });

  it("throws when merge is not possible", async () => {
    mockFetch.mockReturnValueOnce(errorResponse(405, "Not allowed"));
    await expect(mergePR(TOKEN, "owner/repo", 42)).rejects.toThrow("GitHub API 405");
  });
});

// ── addLabels / removeLabel ──────────────────────────────────────────

describe("addLabels", () => {
  it("adds labels to a PR", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([]));

    await addLabels(TOKEN, "owner/repo", 42, ["bug", "priority:high"]);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues/42/labels");
    expect(JSON.parse(options.body)).toEqual({ labels: ["bug", "priority:high"] });
  });
});

describe("removeLabel", () => {
  it("removes a label from a PR", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([]));

    await removeLabel(TOKEN, "owner/repo", 42, "bug");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues/42/labels/bug");
    expect(options.method).toBe("DELETE");
  });
});

// ── checkOnDevelop ───────────────────────────────────────────────────

describe("checkOnDevelop", () => {
  it('returns "yes" when commit is on develop', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ ahead_by: 0, status: "behind" }));

    const result = await checkOnDevelop(TOKEN, "owner/repo", "abc123");
    expect(result).toBe("yes");
  });

  it('returns "no" when commit is ahead of develop', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ ahead_by: 3, status: "ahead" }));

    const result = await checkOnDevelop(TOKEN, "owner/repo", "abc123");
    expect(result).toBe("no");
  });

  it('returns "no-branch" when develop branch does not exist', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(404, "Not Found"));

    const result = await checkOnDevelop(TOKEN, "owner/repo", "abc123");
    expect(result).toBe("no-branch");
  });

  it('returns "no" for empty headSha', async () => {
    const result = await checkOnDevelop(TOKEN, "owner/repo", "");
    expect(result).toBe("no");
  });
});

// ── Thread Resolution (GraphQL) ──────────────────────────────────────

describe("fetchThreadResolutions", () => {
  it("returns thread resolution counts and details", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  { id: "RT_1", isResolved: true, path: "src/index.ts", line: 10, originalLine: 10 },
                  { id: "RT_2", isResolved: false, path: "src/app.ts", line: 20, originalLine: 20 },
                  { id: "RT_3", isResolved: true, path: "README.md", line: 5, originalLine: 5 },
                ],
              },
            },
          },
        },
      })
    );

    const result = await fetchThreadResolutions(TOKEN, "owner/repo", 42);

    expect(result.totalThreads).toBe(3);
    expect(result.resolvedThreads).toBe(2);
    expect(result.threads).toHaveLength(3);
    expect(result.threads[0]).toEqual({
      id: "RT_1",
      isResolved: true,
      path: "src/index.ts",
      line: 10,
      originalLine: 10,
    });
  });

  it("returns empty on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchThreadResolutions(TOKEN, "owner/repo", 42);

    expect(result.totalThreads).toBe(0);
    expect(result.resolvedThreads).toBe(0);
    expect(result.threads).toEqual([]);
  });
});

describe("resolveReviewThread", () => {
  it("resolves a thread and returns true", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: { resolveReviewThread: { thread: { isResolved: true } } },
      })
    );

    const result = await resolveReviewThread(TOKEN, "RT_123");
    expect(result).toBe(true);
  });
});

describe("unresolveReviewThread", () => {
  it("unresolves a thread and returns true", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: { unresolveReviewThread: { thread: { isResolved: false } } },
      })
    );

    const result = await unresolveReviewThread(TOKEN, "RT_123");
    expect(result).toBe(true);
  });
});

// ── Review request management ────────────────────────────────────────

describe("requestReviewers", () => {
  it("sends POST with reviewers array", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
    );

    await requestReviewers(TOKEN, "owner/repo", 42, ["alice", "bob"]);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/pulls/42/requested_reviewers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reviewers: ["alice", "bob"] }),
      })
    );
  });

  it("throws on error", async () => {
    mockFetch.mockReturnValueOnce(errorResponse(422, "Validation failed"));

    await expect(requestReviewers(TOKEN, "owner/repo", 42, ["invalid"])).rejects.toThrow(
      "GitHub API 422"
    );
  });
});

describe("removeReviewRequest", () => {
  it("sends DELETE with reviewers array", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
    );

    await removeReviewRequest(TOKEN, "owner/repo", 42, ["alice"]);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/pulls/42/requested_reviewers",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ reviewers: ["alice"] }),
      })
    );
  });
});

describe("fetchCollaborators", () => {
  it("fetches repo collaborators", async () => {
    const collabs = [
      { login: "alice", avatar_url: "https://avatar/alice" },
      { login: "bob", avatar_url: "https://avatar/bob" },
    ];
    mockFetch.mockReturnValueOnce(jsonResponse(collabs));

    const result = await fetchCollaborators(TOKEN, "owner/repo");

    expect(result).toEqual(collabs);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/collaborators?per_page=100",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
  });
});

// ── API headers ──────────────────────────────────────────────────────

describe("API headers", () => {
  it("sends correct auth and version headers", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ login: "test", avatar_url: "" }));

    await fetchUser(TOKEN);

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers.Accept).toBe("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });
});
