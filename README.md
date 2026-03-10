# GitHub PR Dashboard

A personal GitHub Pull Request dashboard built with Next.js 16, designed to help you stay on top of code reviews across all your repositories. Authenticate with your GitHub token and get a unified, prioritized view of every PR that needs your attention.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)
![License](https://img.shields.io/badge/License-Apache_2.0-blue)

## Features

### Core
- **Unified PR inbox** — See all PRs you authored, are assigned to, were requested to review, or are mentioned in, across every repo and org
- **Smart categorization** — PRs are auto-grouped into *Needs Attention*, *Waiting on Others*, *Approved / Ready*, and *Done*
- **Priority sorting** — PRs requiring your action are sorted by urgency (requested reviews, failing CI, conflicts, age)
- **Real-time enrichment** — Background-fetches CI status, merge conflicts, review states, and diff stats

### Review & Actions
- **Full side panel** — Description, file changes with syntax-highlighted diffs, comments, commits, CI checks, and merge conflicts — all without leaving the dashboard
- **Quick actions** — Approve, request changes, squash-merge, or close PRs directly from the dashboard
- **Inline comments** — Reply to review threads, post new comments on specific diff lines
- **Resolve conversations** — Resolve / unresolve review threads individually or batch-resolve all at once
- **Thread filtering** — Filter review threads by resolved / unresolved status

### Productivity
- **Batch operations** — Select multiple PRs and mark them as seen in one click
- **PR age indicators** — Color-coded pills showing how long a PR has been open
- **Activity tracker** — Daily stats for reviews given, comments posted, and PRs merged
- **Keyboard shortcuts** — Navigate and act without touching the mouse
- **Seen / unseen tracking** — Locally track which PRs you've already looked at
- **Dark / light / system theme** — Warm orange-accented theme with smooth transitions

### Code Display
- **Syntax-highlighted diffs** — Language-aware highlighting for 14+ languages in all diff views
- **Markdown rendering** — Full GFM support with code block highlighting in PR descriptions and comments
- **Quick-diff preview** — Expandable diff hunk previews on review comment threads

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | [TypeScript 5](https://www.typescriptlang.org) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Components | [shadcn/ui](https://ui.shadcn.com) (base-ui) |
| Syntax highlighting | [highlight.js](https://highlightjs.org) + [rehype-highlight](https://github.com/rehypejs/rehype-highlight) |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) + remark-gfm + rehype-raw |
| API | GitHub REST API + GitHub GraphQL API |
| Deployment | [Blaxel](https://blaxel.ai) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [pnpm](https://pnpm.io) (recommended) or npm/yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/github-tracker.git
cd github-tracker

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and connect with your GitHub Personal Access Token.

### GitHub Token

The dashboard uses a GitHub Personal Access Token (classic) with the following scopes:

| Scope | Purpose |
|-------|---------|
| `repo` | Access private repositories, PR details, and write actions (merge, close, comment) |
| `read:org` | List organizations for filtering |

You can create a token at [github.com/settings/tokens](https://github.com/settings/tokens).

### Environment Variables

No environment variables are required for basic usage. The token is stored locally in your browser's `localStorage`.

For GitHub OAuth device flow (optional):

```env
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_oauth_app_client_id
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── oauth/          # OAuth device flow endpoints
│   ├── globals.css          # Theme variables, animations, highlight.js overrides
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Entry point — token screen or dashboard
├── components/
│   └── ui/                  # shadcn/ui primitives
└── lib/
    ├── components.tsx       # All dashboard components
    ├── constants.ts         # Keyboard shortcuts, config
    ├── github.ts            # GitHub API functions and types
    ├── hooks.ts             # Custom React hooks (data fetching, filters)
    └── utils.ts             # Utility functions (cn, etc.)
```

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch
```

Tests cover:
- **Pure functions** — `isBot`, `categorizePR`, `timeAgo`
- **GitHub API layer** — all REST and GraphQL functions with mocked fetch (auth headers, pagination, error handling, close/merge/resolve flows)
- **Filter & grouping hook** — `useFilters` with all filter combinations, search, grouping modes, and edge cases

## Deployment

### Manual deploy

```bash
# Install the Blaxel CLI
npm install -g @blaxel/cli

# Deploy
bl deploy
```

The included `blaxel.toml` configures a sandbox with 4GB memory and port 3000 exposed.

### CI/CD (GitHub Actions)

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that auto-deploys to Blaxel on every push to `main`.

Add these secrets to your GitHub repository (**Settings > Secrets and variables > Actions**):

| Secret | Description |
|--------|-------------|
| `BL_API_KEY` | Blaxel API key for CLI authentication. Generate one from your [Blaxel workspace settings](https://app.blaxel.ai). |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | GitHub OAuth App Client ID (for device flow login). Create one at [github.com/settings/developers](https://github.com/settings/developers). |

The workflow writes the Client ID to `.env` at build time so it's inlined by Next.js during the Docker build — the secret never appears in source code or the git history.

## Screenshots

*Coming soon — contributions welcome!*

## License

This project is licensed under the Apache License 2.0 — see the [LICENSE](LICENSE) file for details.
