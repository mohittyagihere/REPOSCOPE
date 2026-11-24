# RepoScope

RepoScope is a client-side GitHub exploration platform built with React, Vite, and the public GitHub REST API. Explore profiles and repositories, browse repository files, read rendered documentation, review recent commits and issues, and compare evidence-based public developer portfolios.

## Features

- Search a GitHub username and inspect profile and repository statistics.
- Filter and sort a profile's repositories, inspect language distribution, and save profiles locally.
- Search GitHub's public repository index by keyword and programming language.
- Open shareable repository routes at `/repo/{owner}/{repository}`.
- Browse repository folders, follow breadcrumbs, and preview text source with line numbers, syntax highlighting, and copy support.
- Read GitHub-flavored Markdown README files, recent commits, and open issues.
- Switch between saved light and dark themes.
- Review the live app structure and API flow on the System Architecture page.
- Analyze Developer DNA, recent public activity, and portfolio patterns at `/intelligence/dna/{username}`.
- Review deterministic, formula-documented behaviour indicators at `/intelligence/behaviour/{username}`.
- Compare two public profiles at `/intelligence/compare/{usernameA}/{usernameB}`.
- Export a Developer DNA report as a PDF without an additional PDF dependency.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`; preview it with `npm run preview`.

RepoScope does not require an API token. GitHub applies rate limits to public unauthenticated API requests. The client reports API errors and does not embed credentials.

## API endpoints

The reusable service layer in `src/api.js` calls:

- `GET /users/{username}` and `GET /users/{username}/repos`
- `GET /users/{username}/events/public`
- `GET /search/repositories`
- `GET /repos/{owner}/{repo}`
- `GET /repos/{owner}/{repo}/contents/{path}`
- `GET /repos/{owner}/{repo}/readme`
- `GET /repos/{owner}/{repo}/languages`
- `GET /repos/{owner}/{repo}/commits`
- `GET /repos/{owner}/{repo}/issues`

All data is public GitHub data. File previews are limited to 1 MB and never execute downloaded code.
Profile/repository lists are cached in memory for 60 seconds and public events for 120 seconds. Developer language summaries use each repository's returned primary-language label; they do not issue one language request per repository.

## Developer intelligence methodology

The five 0–100 indicators are heuristic measurements of the available public portfolio, not official GitHub scores, productivity measures, skill ratings, or psychological assessments:

- **Consistency:** 40% from `min(events in the available 90-day window / 30, 1)`, 40% from the share of three rolling 30-day periods containing events, and up to 20% for the most recent event (20 points at 14 days or less; 10 points at 15–30 days).
- **Technical exploration:** 70% from `min(distinct detected primary languages / 6, 1)` and 30% from `min(listed public repositories / 20, 1)`. It is unavailable without detected languages.
- **Specialization:** the percentage of repositories with a detected primary language that use the most common language.
- **Collaboration:** 40% from the forked-repository share and 60% from `min(qualifying public events in repositories owned by others / 10, 1)`. It is unavailable if the public events endpoint fails.
- **Project building:** 40% from `min(original repositories / 10, 1)`, 30% from repositories with a description or topic, and 30% from `min(stars across listed repositories / 500, 1)`.

The classification labels and generated observations are based on explicit thresholds and displayed evidence. Public events are a recent, capped sample, not complete history; private activity is never available to this frontend. A missing endpoint or missing language data is shown as unavailable rather than converted to a zero score.

## Project structure

```text
reposcope/
├── index.html       # HTML entry and pre-render theme preference
├── package.json     # Scripts and dependencies
├── package-lock.json # Reproducible dependency versions
├── vite.config.js   # Vite configuration
├── README.md
└── src/
    ├── App.jsx      # Browser-history routes, navigation, shared shell and persisted app state
    ├── api.js       # Validated GitHub REST service and error handling
    ├── main.jsx     # React entry point and global CSS
    ├── pages.jsx    # Dashboard, Explore, Saved Profiles, repository workspace and supporting views
    ├── styles.css   # Responsive layout, reusable UI and light/dark theme tokens
    └── intelligence/
        ├── analysis.js            # Public-data metrics, heuristic scores and comparisons
        ├── components.jsx         # Shared intelligence metrics, charts and score cards
        ├── pages.jsx              # Developer DNA, behaviour and comparison pages
        ├── report.js              # Browser-generated PDF export
        └── useDeveloperProfile.js # Cancellable profile and public events hook
```

## Notes

- Profile repository data is limited to the first 100 repositories returned by GitHub.
- GitHub Search limits results to the first 1,000 matches.
- Repository file content is previewed only when it is text and no larger than 1 MB.
- The repository overview's open-issues count is GitHub's `open_issues_count`, which includes open pull requests.
- Theme and saved profile usernames are stored in the browser's localStorage.
