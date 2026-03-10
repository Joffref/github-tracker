# Contributing to GitHub PR Dashboard

Thanks for your interest in contributing! This project is open to contributions of all kinds — bug fixes, new features, documentation, and design improvements.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/your-username/github-tracker.git
   cd github-tracker
   ```
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Create a branch** for your change:
   ```bash
   git checkout -b feat/my-feature
   ```
5. **Start the dev server**:
   ```bash
   pnpm dev
   ```

## Development

### Tech Overview

- **Next.js 16** with App Router — all pages are in `src/app/`
- **Tailwind CSS 4** — styles via utility classes; theme variables in `src/app/globals.css`
- **shadcn/ui** (base-ui variant, NOT Radix) — UI primitives in `src/components/ui/`
- **No external state management** — React `useState`/`useEffect` with custom hooks in `src/lib/hooks.ts`
- **GitHub API** — REST + GraphQL calls in `src/lib/github.ts`
- **All dashboard UI** lives in `src/lib/components.tsx`

### Key Files

| File | What it does |
|------|-------------|
| `src/lib/github.ts` | All GitHub API types, fetch functions, and mutations |
| `src/lib/components.tsx` | Dashboard components (cards, side panel, quick actions, etc.) |
| `src/lib/hooks.ts` | Custom hooks for data fetching, filtering, and enrichment |
| `src/lib/constants.ts` | Keyboard shortcuts and configuration |
| `src/app/globals.css` | CSS variables, animations, and highlight.js theme overrides |
| `src/app/page.tsx` | Entry point — routes between token screen and dashboard |

### Code Style

- **TypeScript** — strict mode, no `any` unless truly necessary
- **Functional components** with hooks
- **Tailwind utilities** over custom CSS — keep `globals.css` for theme variables and animations only
- **No unnecessary abstractions** — prefer simple, readable code over premature DRY
- Keep imports organized: React, types, API functions, components, utilities

### Commit Messages

Use clear, concise commit messages:

```
feat: add PR label management
fix: prevent stale index in enrichment callback
refactor: extract CommentsTab into separate component
docs: update README with deploy instructions
```

Prefix with `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, or `chore:`.

## What to Contribute

### Good first issues

- Add screenshots to the README
- Improve mobile responsiveness
- Add more language registrations for syntax highlighting
- Write unit tests for utility functions

### Feature ideas

- Notification system (browser notifications for new review requests)
- Custom PR grouping / filtering rules
- Multiple GitHub account support
- PR templates and saved replies
- Export / share dashboard views
- Webhook support for real-time updates

### Bug reports

When filing a bug, please include:

1. Steps to reproduce
2. Expected vs. actual behavior
3. Browser and OS
4. Console errors (if any)

## Pull Requests

1. **Keep PRs focused** — one feature or fix per PR
2. **Test your changes** — verify the build passes (`pnpm build`) and test manually in the browser
3. **Update the README** if you add user-facing features
4. **Write a clear PR description** — explain what changed and why

### PR Checklist

- [ ] `pnpm build` passes without errors
- [ ] `pnpm lint` passes
- [ ] Tested manually in browser (dark + light mode)
- [ ] No hardcoded secrets or tokens
- [ ] README updated (if applicable)

## Architecture Notes

### Data Flow

```
page.tsx
  └── Dashboard
        ├── useDashboardPRs (hook) → fetches + categorizes PRs
        │     ├── GitHub Search API (bulk fetch)
        │     └── Background enrichment (CI, conflicts, reviews, diff stats)
        ├── PRGroup → PRCard (per category)
        └── SidePanel (when a PR is selected)
              ├── Files tab → DiffView per file
              ├── Comments tab → CommentsTab
              │     ├── Issue comments (timeline)
              │     └── ReviewThread (per thread, with resolve/unresolve)
              ├── Commits tab → timeline
              ├── CI tab → CheckRun list
              └── Conflicts tab → ConflictFile list
```

### State Management

- **Token**: `localStorage` via `useLocalStorage` hook
- **PR list**: `useState` in `useDashboardPRs`, with background enrichment via `useEffect`
- **Seen tracking**: `localStorage` set of PR IDs
- **Theme**: `localStorage` + system preference detection via `useTheme` hook
- **Side panel**: `useDeferredValue` hook for smooth slide-in/out transitions

### GitHub API Usage

- **REST API**: Search, PR details, files, commits, comments, check runs, labels, merge, close
- **GraphQL API**: Review thread resolution status, resolve/unresolve mutations

Rate limiting is handled by the token's own limits. The dashboard batches requests and uses background enrichment to avoid hitting limits during initial load.

## Code of Conduct

Be kind, respectful, and constructive. We're all here to build something useful together.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
