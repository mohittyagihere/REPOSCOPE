import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import java from "highlight.js/lib/languages/java";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import cpp from "highlight.js/lib/languages/cpp";
import c from "highlight.js/lib/languages/c";
import ruby from "highlight.js/lib/languages/ruby";
import markdown from "highlight.js/lib/languages/markdown";
import makefile from "highlight.js/lib/languages/makefile";
import "highlight.js/styles/github-dark.css";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown,
  ChevronRight, CircleAlert, Code2, Copy, ExternalLink, File, FileCode2, FileText,
  Folder, GitBranch, GitCommitHorizontal, GitFork, Globe2, LoaderCircle, Search,
  RefreshCw, Shield, Star, Users
} from "lucide-react";
import {
  getFileContent, getProfile, getReadme, getRepository, getRepositoryCommits,
  getRepositoryContents, getRepositoryIssues, getRepositoryLanguages, searchRepositories
} from "./api";

const formatNumber = value => new Intl.NumberFormat("en", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value || 0);
const formatDate = value => value ? new Date(value).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "—";
const relativeDate = value => {
  if (!value) return "Unknown";
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
};
const languagePalette = ["#3776ab", "#e34c26", "#f1e05a", "#563d7c", "#3178c6", "#89e051", "#b07219", "#2b7489"];
const languageOptions = ["JavaScript", "TypeScript", "Python", "Java", "Go", "Rust", "C++", "HTML", "CSS", "C", "Ruby", "PHP", "Kotlin", "Swift"];
[
  ["javascript", javascript], ["typescript", typescript], ["python", python],
  ["bash", bash], ["json", json], ["xml", xml], ["css", css], ["sql", sql],
  ["yaml", yaml], ["java", java], ["go", go], ["rust", rust], ["cpp", cpp],
  ["c", c], ["ruby", ruby], ["markdown", markdown], ["makefile", makefile]
].forEach(([name, language]) => hljs.registerLanguage(name, language));

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Loading({ label = "Loading..." }) {
  return <div className="state-panel"><LoaderCircle className="spin" size={20}/><span>{label}</span></div>;
}

function ErrorState({ message, onRetry }) {
  return <div className="state-panel error-state"><CircleAlert size={19}/><span>{message}</span>{onRetry && <button className="button secondary" onClick={onRetry}>Try again</button>}</div>;
}

function EmptyState({ title, detail }) {
  return <div className="empty-panel"><Folder size={22}/><b>{title}</b>{detail && <span>{detail}</span>}</div>;
}

export function Dashboard({ initialUsername, savedProfiles, onToggleSaved, navigate }) {
  const [username, setUsername] = useState(initialUsername || "torvalds");
  const [query, setQuery] = useState(initialUsername || "torvalds");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("stars");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const perPage = 8;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getProfile(initialUsername || "torvalds", controller.signal)
      .then(result => {
        setData(result);
        setUsername(result.user.login);
        setQuery(result.user.login);
      })
      .catch(reason => {
        if (reason.name !== "AbortError") setError(reason.message || "Unable to load this profile.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initialUsername, refreshKey]);

  const repos = data?.repos || [];
  const filteredRepos = useMemo(() => {
    const list = repos.filter(repo => `${repo.name} ${repo.description || ""} ${repo.language || ""}`.toLowerCase().includes(filter.toLowerCase()));
    return [...list].sort((a, b) => sort === "stars" ? b.stargazers_count - a.stargazers_count
      : sort === "forks" ? b.forks_count - a.forks_count
      : new Date(b.updated_at) - new Date(a.updated_at));
  }, [repos, filter, sort]);
  const languages = useMemo(() => {
    const counts = {};
    repos.forEach(repo => { if (repo.language) counts[repo.language] = (counts[repo.language] || 0) + 1; });
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return Object.entries(counts).map(([name, count]) => ({ name, count, percent: total ? count / total * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [repos]);
  const visibleRepos = filteredRepos.slice((page - 1) * perPage, page * perPage);
  const pages = Math.max(1, Math.ceil(filteredRepos.length / perPage));
  const stars = repos.reduce((total, repo) => total + repo.stargazers_count, 0);
  const forks = repos.reduce((total, repo) => total + repo.forks_count, 0);

  function submitSearch(event) {
    event.preventDefault();
    const clean = query.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9-]{1,39}$/.test(clean)) {
      setError("Enter a valid GitHub username using letters, numbers, or hyphens.");
      return;
    }
    if (clean === username && !initialUsername) {
      setError("");
      return;
    }
    navigate(`/profile/${encodeURIComponent(clean)}`);
  }

  async function copyProfile() {
    try {
      await navigator.clipboard.writeText(data.user.html_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  }

  return (
    <div className="page dashboard-page">
      <PageHeading eyebrow="PROFILE INTELLIGENCE" title="Developer dashboard" description="A clear snapshot of a developer's public GitHub work."
        action={data && <button className="button secondary" onClick={() => setRefreshKey(key => key + 1)} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""}/> Refresh data</button>}/>
      <form className="search-form" onSubmit={submitSearch}>
        <Search size={17}/>
        <span className="search-prefix">github.com/</span>
        <input aria-label="GitHub username" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a GitHub username"/>
        <button className="button primary" type="submit">Analyze profile <ArrowRight size={15}/></button>
      </form>
      {error && <ErrorState message={error}/>}
      {loading ? <Loading label={`Loading ${initialUsername || "GitHub"} profile...`}/> : data && (
        <>
          <ProfileCard
            user={data.user}
            isSaved={savedProfiles.includes(data.user.login)}
            onToggleSaved={() => onToggleSaved(data.user.login)}
            onCopy={copyProfile}
            copied={copied}
          />
          <div className="metric-grid">
            <Metric icon={<BookOpen/>} label="PUBLIC REPOSITORIES" value={formatNumber(data.user.public_repos)} note="Owned by this account"/>
            <Metric icon={<Users/>} label="FOLLOWERS" value={formatNumber(data.user.followers)} note={`${formatNumber(data.user.following)} following`}/>
            <Metric icon={<Star/>} label="TOTAL STARS" value={formatNumber(stars)} note="Across listed repositories"/>
            <Metric icon={<GitFork/>} label="TOTAL FORKS" value={formatNumber(forks)} note="Across listed repositories"/>
          </div>
          <div className="dashboard-grid">
            <section className="panel repository-panel">
              <div className="panel-header">
                <div><div className="section-label">PUBLIC PROJECTS</div><h2>Repositories <span className="count-badge">{filteredRepos.length}</span></h2></div>
                <button className="button ghost" onClick={() => navigate("/explore")}>Explore all <ArrowUpRight size={14}/></button>
              </div>
              <div className="list-tools">
                <label className="inline-search"><Search size={14}/><input aria-label="Filter profile repositories" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }} placeholder="Filter repositories..."/></label>
                <label className="select-wrap"><span>Sort by</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="stars">Stars</option><option value="forks">Forks</option><option value="updated">Recently updated</option></select><ChevronDown size={13}/></label>
              </div>
              {visibleRepos.length ? <div className="repo-list">{visibleRepos.map(repo => <RepositoryRow key={repo.id} repo={repo} navigate={navigate}/>)}</div>
                : <EmptyState title="No repositories found" detail={filter ? "Try a different search term." : "This profile has no public repositories."}/>}
              <Pagination page={page} pages={pages} onPage={setPage} count={filteredRepos.length} perPage={perPage}/>
            </section>
            <aside className="dashboard-aside">
              <section className="panel language-panel">
                <div className="section-label">TECHNOLOGY MIX</div><h2>Languages</h2>
                {languages.length ? <>
                  <div className="language-track">{languages.slice(0, 8).map((lang, index) => <span key={lang.name} style={{ width: `${lang.percent}%`, background: languagePalette[index % languagePalette.length] }} title={`${lang.name}: ${lang.count} repositories`}/>)}</div>
                  <div className="language-rows">{languages.slice(0, 6).map((lang, index) => <div className="language-row" key={lang.name}><span><i style={{ background: languagePalette[index % languagePalette.length] }}/>{lang.name}</span><b>{lang.percent.toFixed(0)}%</b></div>)}</div>
                </> : <p className="muted-copy">No language data in the listed repositories.</p>}
              </section>
              <section className="panel recent-panel">
                <div className="section-label">LATEST UPDATES</div><h2>Recently updated</h2>
                {repos.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 5).map(repo => (
                  <button className="recent-item" key={repo.id} onClick={() => navigate(`/repo/${encodeURIComponent(data.user.login)}/${encodeURIComponent(repo.name)}`)}>
                    <span><b>{repo.name}</b><small>{relativeDate(repo.updated_at)}</small></span><ChevronRight size={14}/>
                  </button>
                ))}
                {!repos.length && <p className="muted-copy">No recent repository activity.</p>}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function ProfileCard({ user, isSaved, onToggleSaved, onCopy, copied }) {
  return (
    <section className="profile-card panel">
      <div className="profile-main">
        <img src={user.avatar_url} alt={`${user.login}'s avatar`} className="avatar"/>
        <div className="profile-info">
          <h2>{user.name || user.login}</h2>
          <a className="profile-handle" href={user.html_url} target="_blank" rel="noreferrer">@{user.login} <ExternalLink size={12}/></a>
          {user.bio && <p className="profile-bio">{user.bio}</p>}
          <div className="profile-meta">
            {user.location && <span><Globe2 size={13}/>{user.location}</span>}
            {user.company && <span><Users size={13}/>{user.company}</span>}
            {user.blog && <a href={user.blog.startsWith("http") ? user.blog : `https://${user.blog}`} target="_blank" rel="noreferrer"><Globe2 size={13}/>{user.blog.replace(/^https?:\/\//, "")}</a>}
            <span><BookOpen size={13}/>Joined {formatDate(user.created_at)}</span>
          </div>
        </div>
      </div>
      <div className="profile-actions">
        <button className={`button ${isSaved ? "secondary saved" : "secondary"}`} onClick={onToggleSaved}>{isSaved ? <Check size={15}/> : <Star size={15}/>} {isSaved ? "Saved" : "Save profile"}</button>
        <button className="button secondary" onClick={onCopy}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? "Copied" : "Copy profile link"}</button>
      </div>
    </section>
  );
}

function Metric({ icon, label, value, note }) {
  return <div className="metric-card"><div className="metric-heading"><span>{label}</span>{icon}</div><b>{value}</b><small>{note}</small></div>;
}

function RepositoryRow({ repo, navigate }) {
  const path = `/repo/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}`;
  return (
    <article className="repository-row">
      <div className="repo-row-icon"><Code2 size={15}/></div>
      <div className="repo-row-main">
        <a href={path} onClick={event => { event.preventDefault(); navigate(path); }}>{repo.name}<ArrowUpRight size={13}/></a>
        <p>{repo.description || "No description provided."}</p>
        <div className="repo-row-meta">{repo.language && <span>{repo.language}</span>}<span><Star size={12}/>{formatNumber(repo.stargazers_count)}</span><span><GitFork size={12}/>{formatNumber(repo.forks_count)}</span><span>Updated {relativeDate(repo.updated_at)}</span></div>
      </div>
    </article>
  );
}

function Pagination({ page, pages, onPage, count, perPage }) {
  return <div className="pagination">
    <span>{count ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, count)} of ${count}` : "0 results"}</span>
    <div><button className="button small secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>{page} / {pages}</span><button className="button small secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></div>
  </div>;
}

export function Explore({ navigate }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [sort, setSort] = useState("stars");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchVersion, setSearchVersion] = useState(0);

  useEffect(() => {
    if (!submittedQuery && !language) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    searchRepositories({ query: submittedQuery, language, sort, page }, controller.signal)
      .then(setResult)
      .catch(reason => { if (reason.name !== "AbortError") setError(reason.message || "Repository search failed."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [submittedQuery, language, sort, page, searchVersion]);

  function submit(event) {
    event.preventDefault();
    setPage(1);
    setSubmittedQuery(query.trim());
    setSearchVersion(version => version + 1);
  }

  return <div className="page">
    <PageHeading eyebrow="PUBLIC REPOSITORIES" title="Explore GitHub" description="Search public projects by topic, language, and community activity."/>
    <form className="explore-form" onSubmit={submit}>
      <label className="explore-search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Try “accessibility”, “game engine”..." aria-label="Search public repositories"/></label>
      <label className="select-wrap"><span>Language</span><select value={language} onChange={event => { setLanguage(event.target.value); setPage(1); }}><option value="">Any language</option>{languageOptions.map(option => <option key={option}>{option}</option>)}</select><ChevronDown size={13}/></label>
      <label className="select-wrap"><span>Sort</span><select value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="stars">Most stars</option><option value="forks">Most forks</option><option value="updated">Recently updated</option></select><ChevronDown size={13}/></label>
      <button className="button primary" type="submit">Search repositories</button>
    </form>
    {error && <ErrorState message={error}/>}
    {loading ? <Loading label="Searching public repositories..."/> : result ? <>
      <div className="results-caption"><b>{formatNumber(result.total_count)}</b> repositories found{result.incomplete_results && <span> · GitHub returned partial results</span>}</div>
      <section className="panel explore-results">
        {result.items.length ? result.items.map(repo => <ExploreRepository key={repo.id} repo={repo} navigate={navigate}/>) : <EmptyState title="No repositories found" detail="Try another search or language."/>}
      </section>
      <Pagination page={page} pages={Math.max(1, Math.min(50, Math.ceil(result.total_count / 20)))} onPage={setPage} count={Math.min(result.total_count, 1000)} perPage={20}/>
    </> : <EmptyState title="Find your next project" detail="Enter a keyword or choose a programming language to search GitHub."/>}
  </div>;
}

function ExploreRepository({ repo, navigate }) {
  const path = `/repo/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}`;
  return <article className="explore-repo">
    <div className="explore-repo-main">
      <div className="repo-owner">{repo.owner.login} /</div>
      <a className="explore-repo-title" href={path} onClick={event => { event.preventDefault(); navigate(path); }}>{repo.name}<ArrowUpRight size={14}/></a>
      <p>{repo.description || "No description provided."}</p>
      {!!repo.topics?.length && <div className="topic-list">{repo.topics.slice(0, 6).map(topic => <span className="topic" key={topic}>{topic}</span>)}</div>}
    </div>
    <div className="explore-repo-stats">
      {repo.language && <span>{repo.language}</span>}<span><Star size={13}/>{formatNumber(repo.stargazers_count)}</span><span><GitFork size={13}/>{formatNumber(repo.forks_count)}</span><small>{relativeDate(repo.updated_at)}</small>
    </div>
  </article>;
}

export function SavedProfiles({ profiles, onToggle, navigate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!profiles.length) { setData([]); return undefined; }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all(profiles.map(async username => {
      try { return await getProfile(username, controller.signal); }
      catch (reason) { if (reason.name === "AbortError") throw reason; return { user: { login: username, error: reason.message }, repos: [] }; }
    })).then(setData)
      .catch(reason => { if (reason.name !== "AbortError") setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [profiles]);

  return <div className="page">
    <PageHeading eyebrow="YOUR WORKSPACE" title="Saved profiles" description="Keep the GitHub accounts you return to within easy reach."/>
    {error && <ErrorState message={error}/>}
    {loading ? <Loading label="Loading saved profiles..."/> : data.length ? <div className="saved-grid">{data.map(({ user, repos }) => <article className="saved-card panel" key={user.login}>
      {!user.error && <img src={user.avatar_url} alt="" className="saved-avatar"/>}
      <div className="saved-card-content"><b>{user.name || user.login}</b><span>@{user.login}</span>{user.error ? <small>{user.error}</small> : <small>{formatNumber(user.public_repos)} repositories · {formatNumber(user.followers)} followers</small>}</div>
      <div className="saved-card-actions"><button className="button secondary small" onClick={() => navigate(`/profile/${encodeURIComponent(user.login)}`)}>Open profile</button><button className="button danger small" onClick={() => onToggle(user.login)} aria-label={`Remove ${user.login}`}>Remove</button></div>
    </article>)}</div> : <EmptyState title="No saved profiles yet" detail="Save a profile from the dashboard to see it here."/>}
  </div>;
}

export function RepositoryWorkspace({ route, navigate }) {
  const { owner, repo, query } = route;
  const file = query.get("file") || "";
  const directory = query.get("path") || "";
  const tab = file || directory ? "files" : query.get("tab") || "overview";
  const [repository, setRepository] = useState(null);
  const [readme, setReadme] = useState(null);
  const [readmeError, setReadmeError] = useState("");
  const [languages, setLanguages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [supplementalError, setSupplementalError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSupplementalError("");
    setRepository(null);
    setReadme(null);
    setReadmeError("");
    setLanguages({});
    getRepository(owner, repo, controller.signal).then(async detail => {
      setRepository(detail);
      const [readmeResult, languageResult] = await Promise.allSettled([
        getReadme(owner, repo, controller.signal),
        getRepositoryLanguages(owner, repo, controller.signal)
      ]);
      if (controller.signal.aborted) return;
      if (readmeResult.status === "fulfilled") setReadme(readmeResult.value);
      else {
        const message = readmeResult.reason.message || "README preview could not be loaded.";
        setReadmeError(message);
      }
      if (languageResult.status === "fulfilled") setLanguages(languageResult.value);
      else setSupplementalError(current => [current, languageResult.reason.message || "Language data could not be loaded."].filter(Boolean).join(" "));
    }).catch(reason => { if (reason.name !== "AbortError") setError(reason.message || "Unable to load this repository."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [owner, repo]);

  function setTab(nextTab) {
    navigate(`/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}?tab=${nextTab}`);
  }

  if (loading) return <div className="page"><Loading label={`Loading ${owner}/${repo}...`}/></div>;
  if (error || !repository) return <div className="page"><ErrorState message={error || "Repository details are unavailable."}/></div>;

  return <div className="page repository-workspace">
    <div className="repo-breadcrumb"><a href="/explore" onClick={event => { event.preventDefault(); navigate("/explore"); }}>Explore</a><ChevronRight size={14}/><a href={`/profile/${encodeURIComponent(owner)}`} onClick={event => { event.preventDefault(); navigate(`/profile/${encodeURIComponent(owner)}`); }}>{owner}</a><ChevronRight size={14}/><b>{repo}</b></div>
    <div className="repo-heading">
      <div className="repo-title-block"><div className="repo-owner-line"><img src={repository.owner.avatar_url} alt="" className="owner-avatar"/><a href={`/profile/${encodeURIComponent(owner)}`} onClick={event => { event.preventDefault(); navigate(`/profile/${encodeURIComponent(owner)}`); }}>{owner}</a><span>/</span><h1>{repository.name}</h1><span className="visibility-badge">{repository.private ? "Private" : repository.visibility || "Public"}</span></div>
        <p>{repository.description || "No description provided."}</p>
        {!!repository.topics?.length && <div className="topic-list">{repository.topics.map(topic => <span className="topic" key={topic}>{topic}</span>)}</div>}
      </div>
      <a className="button secondary" href={repository.html_url} target="_blank" rel="noreferrer">GitHub <ExternalLink size={14}/></a>
    </div>
    <div className="repo-stats-strip">
      <span><Star size={15}/><b>{formatNumber(repository.stargazers_count)}</b> stars</span>
      <span><GitFork size={15}/><b>{formatNumber(repository.forks_count)}</b> forks</span>
      <span><Users size={15}/><b>{formatNumber(repository.subscribers_count)}</b> watchers</span>
      <span><CircleAlert size={15}/><b>{formatNumber(repository.open_issues_count)}</b> open issues &amp; PRs</span>
    </div>
    <nav className="repo-tabs" aria-label="Repository sections">
      {[["overview", "Overview", BookOpen], ["files", "Files", Folder], ["activity", "Activity", GitCommitHorizontal]].map(([key, label, Icon]) => <button key={key} className={tab === key ? "repo-tab active" : "repo-tab"} onClick={() => setTab(key)}><Icon size={15}/>{label}</button>)}
    </nav>
    {supplementalError && <div className="inline-warning"><CircleAlert size={15}/>{supplementalError}</div>}
    {tab === "overview" && <RepositoryOverview repository={repository} readme={readme} readmeError={readmeError} languages={languages} navigate={navigate} owner={owner} repo={repo}/>}
    {tab === "files" && <FileExplorer owner={owner} repo={repo} path={directory} file={file} navigate={navigate}/>}
    {tab === "activity" && <ActivityViewer owner={owner} repo={repo}/>}
  </div>;
}

function RepositoryOverview({ repository, readme, readmeError, languages, navigate, owner, repo }) {
  const entries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  return <div className="repo-overview-grid">
    <div className="overview-primary">
      <section className="panel readme-panel">
        <div className="panel-header"><h2><BookOpen size={17}/> README</h2>{readme && <span className="section-label">RENDERED MARKDOWN</span>}</div>
        {readmeError ? <EmptyState title="README preview unavailable" detail={readmeError}/> : readme !== null ? <ReadmeViewer markdown={readme}/> : <EmptyState title="No README found" detail="This repository does not include a README file."/>}
      </section>
    </div>
    <aside className="overview-aside">
      <section className="panel about-panel"><div className="section-label">ABOUT</div><h2>Repository details</h2>
        {repository.homepage && <a className="detail-link" href={repository.homepage.startsWith("http") ? repository.homepage : `https://${repository.homepage}`} target="_blank" rel="noreferrer"><Globe2 size={14}/>{repository.homepage.replace(/^https?:\/\//, "")}<ExternalLink size={12}/></a>}
        <DetailRow icon={<Code2 size={14}/>} label="Language" value={repository.language || "Not specified"}/>
        <DetailRow icon={<GitBranch size={14}/>} label="Default branch" value={repository.default_branch}/>
        <DetailRow icon={<BookOpen size={14}/>} label="Created" value={formatDate(repository.created_at)}/>
        <DetailRow icon={<ArrowDown size={14}/>} label="Last updated" value={formatDate(repository.updated_at)}/>
        {repository.license && <DetailRow icon={<Shield size={14}/>} label="License" value={repository.license.spdx_id || repository.license.name}/>}
      </section>
      {!!entries.length && <section className="panel language-panel"><div className="section-label">LANGUAGE BREAKDOWN</div><h2>Languages</h2>
        {entries.slice(0, 8).map(([name, bytes], index) => <div className="language-row" key={name}><span><i style={{ background: languagePalette[index % languagePalette.length] }}/>{name}</span><b>{formatBytes(bytes)}</b></div>)}
      </section>}
      <section className="panel quick-links"><div className="section-label">REPOSITORY</div><button onClick={() => navigate(`/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}?tab=files`)}><Folder size={15}/> Browse files <ChevronRight size={14}/></button><button onClick={() => navigate(`/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}?tab=activity`)}><GitCommitHorizontal size={15}/> Recent activity <ChevronRight size={14}/></button></section>
    </aside>
  </div>;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function DetailRow({ icon, label, value }) {
  return <div className="detail-row"><span>{icon}{label}</span><b>{value || "—"}</b></div>;
}

function ReadmeViewer({ markdown }) {
  return <article className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children, ...props }) => {
      const external = href && /^https?:\/\//i.test(href);
      return <a href={href} {...props} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{children}{external && <ExternalLink size={11} className="markdown-external"/>}</a>;
    },
    code: ({ className, children, ...props }) => <code className={className} {...props}>{children}</code>
  }}>{markdown}</ReactMarkdown></article>;
}

function FileExplorer({ owner, repo, path, file, navigate }) {
  const [items, setItems] = useState([]);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    if (file) {
      setContent(null);
      getFileContent(owner, repo, file, controller.signal)
        .then(setContent)
        .catch(reason => { if (reason.name !== "AbortError") setError(reason.message || "Unable to read this file."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else {
      setItems([]);
      getRepositoryContents(owner, repo, path, controller.signal)
        .then(result => setItems(Array.isArray(result) ? result.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1) : []))
        .catch(reason => { if (reason.name !== "AbortError") setError(reason.message || "Unable to load this folder."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    return () => controller.abort();
  }, [owner, repo, path, file, retry]);

  const filePath = file || path;
  const segments = filePath ? filePath.split("/") : [];
  const directorySegments = file ? segments.slice(0, -1) : segments;
  const folderPath = directorySegments.join("/");
  const names = segments;
  function navigateFolder(nextPath) {
    navigate(`/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}?tab=files${nextPath ? `&path=${encodeURIComponent(nextPath)}` : ""}`);
  }
  function navigateFile(nextPath) {
    navigate(`/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}?tab=files&file=${encodeURIComponent(nextPath)}`);
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(content.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  }

  return <section className="panel file-panel">
    <div className="file-toolbar">
      <div className="breadcrumbs file-breadcrumbs">
        <button onClick={() => navigateFolder("")} aria-label="Repository root"><Folder size={14}/></button>
        {names.map((segment, index) => {
          const currentPath = names.slice(0, index + 1).join("/");
          const isLastFile = file && index === names.length - 1;
          return <span className="breadcrumb-segment" key={currentPath}><ChevronRight size={13}/>{isLastFile ? <b>{segment}</b> : <button onClick={() => navigateFolder(currentPath)}>{segment}</button>}</span>;
        })}
      </div>
      {file && <button className="button secondary small" onClick={() => navigateFolder(folderPath)}><ArrowLeft size={13}/> Back to folder</button>}
    </div>
    {loading ? <Loading label={file ? "Loading file..." : "Loading folder..."}/> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)}/> : file && !content ? <Loading label="Loading file..."/> : file
      ? content?.tooLarge || content?.binary || content?.text === null
        ? <div className="file-message"><File size={20}/><b>{content?.tooLarge ? "File is too large to preview" : "This file cannot be displayed as text"}</b><span>{content?.tooLarge ? "Files over 1 MB are not loaded into the browser." : "Binary or unsupported file types cannot be rendered in the code viewer."}</span></div>
        : <CodeViewer file={content} copied={copied} onCopy={copyCode}/>
      : items.length ? <div className="file-list">{items.map(item => <button key={item.path} className="file-list-row" onClick={() => item.type === "dir" ? navigateFolder(item.path) : navigateFile(item.path)}>
        {item.type === "dir" ? <Folder size={16}/> : <FileIcon name={item.name}/>}<span>{item.name}</span>{item.type === "file" && <small>{extension(item.name) || "file"} · {formatBytes(item.size)}</small>}<ChevronRight size={14}/>
      </button>)}</div> : <EmptyState title="This folder is empty" detail="There are no files or folders at this location."/>}
  </section>;
}

function extension(name) {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index + 1).toUpperCase() : "";
}

function FileIcon({ name }) {
  const ext = extension(name).toLowerCase();
  return ["js", "jsx", "ts", "tsx", "py", "java", "go", "rs", "css", "html", "json", "sh", "sql"].includes(ext)
    ? <FileCode2 size={16}/> : ["md", "txt", "rst"].includes(ext) ? <FileText size={16}/> : <File size={16}/>;
}

const highlightLanguages = {
  js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python",
  rb: "ruby", yml: "yaml", md: "markdown", sh: "bash", h: "c", hpp: "cpp",
  cs: "csharp", rs: "rust", go: "go", java: "java", html: "xml", svg: "xml"
};

function CodeViewer({ file, copied, onCopy }) {
  const lines = file.text.split("\n");
  const ext = extension(file.name).toLowerCase();
  const language = file.name.toLowerCase() === "makefile" ? "makefile" : highlightLanguages[ext] || ext;
  let highlighted;
  try {
    highlighted = language && hljs.getLanguage(language)
      ? hljs.highlight(file.text, { language }).value
      : hljs.highlightAuto(file.text).value;
  } catch {
    highlighted = hljs.highlightAuto(file.text).value;
  }
  return <div className="code-viewer">
    <div className="code-toolbar"><span><FileCode2 size={15}/>{file.path} <small>{language || "text"}</small></span><button className="button secondary small" onClick={onCopy}>{copied ? <Check size={13}/> : <Copy size={13}/>} {copied ? "Copied" : "Copy code"}</button></div>
    <div className="code-scroller"><ol className="line-numbers" aria-hidden="true">{lines.map((_, index) => <li key={index}>{index + 1}</li>)}</ol><pre><code className={`hljs language-${language}`} dangerouslySetInnerHTML={{ __html: highlighted }}/></pre></div>
  </div>;
}

function ActivityViewer({ owner, repo }) {
  const [commits, setCommits] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      getRepositoryCommits(owner, repo, controller.signal),
      getRepositoryIssues(owner, repo, controller.signal)
    ]).then(([commitList, issueList]) => {
      setCommits(commitList);
      setIssues(issueList.filter(issue => !issue.pull_request));
    }).catch(reason => { if (reason.name !== "AbortError") setError(reason.message || "Unable to load repository activity."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [owner, repo]);
  if (loading) return <Loading label="Loading recent commits and open issues..."/>;
  if (error) return <ErrorState message={error}/>;
  return <div className="activity-grid">
    <section className="panel activity-panel"><div className="panel-header"><h2><GitCommitHorizontal size={17}/> Recent commits</h2></div>
      {commits.length ? commits.map(commit => <article className="activity-item" key={commit.sha}>
        <GitCommitHorizontal size={15}/><div><b>{commit.commit.message.split("\n")[0]}</b><span>{commit.commit.author?.name || commit.author?.login || "Unknown author"} · {formatDate(commit.commit.author?.date)}</span></div><code>{commit.sha.slice(0, 7)}</code>
      </article>) : <EmptyState title="No commits found"/>}
    </section>
    <section className="panel activity-panel"><div className="panel-header"><h2><CircleAlert size={17}/> Open issues <span className="count-badge">{issues.length}</span></h2></div>
      {issues.length ? issues.map(issue => <article className="issue-item" key={issue.id}><a href={issue.html_url} target="_blank" rel="noreferrer">{issue.title}<ExternalLink size={12}/></a><span>#{issue.number} opened {relativeDate(issue.created_at)}</span><div className="issue-labels">{issue.labels.map(label => <span key={label.id} className="topic">{label.name}</span>)}</div></article>) : <EmptyState title="No open issues" detail="This repository has no open issues."/>}
    </section>
  </div>;
}

export function Architecture() {
  const flow = ["User", "React UI / Pages", "Application State & Navigation", "API Service Layer", "GitHub REST API", "Data Processing", "UI Rendering"];
  const endpoints = [
    ["GET /users/{username}", "Public profile details and account statistics."],
    ["GET /users/{username}/repos", "The dashboard's public repository list."],
    ["GET /users/{username}/events/public", "A capped recent sample of public activity for Developer DNA and behaviour indicators."],
    ["GET /search/repositories", "Keyword and language-filtered public repository results."],
    ["GET /repos/{owner}/{repo}", "Repository metadata, counts, visibility, topics, branch and license."],
    ["GET /repos/{owner}/{repo}/contents/{path}", "Root directory, folder entries, and encoded file contents."],
    ["GET /repos/{owner}/{repo}/readme", "Repository README content, decoded and rendered as Markdown."],
    ["GET /repos/{owner}/{repo}/languages", "Repository language byte counts."],
    ["GET /repos/{owner}/{repo}/commits", "Recent commit messages, authors, dates and short hashes."],
    ["GET /repos/{owner}/{repo}/issues", "Open issues and labels (pull requests are excluded from the issue list)."]
  ];
  return <div className="page architecture-page">
    <PageHeading eyebrow="UNDER THE HOOD" title="System architecture" description="How RepoScope turns public GitHub data into an interactive, navigable workspace."/>
    <section className="panel architecture-flow"><div className="section-label">APPLICATION DATA FLOW</div><div className="flow-list">{flow.map((step, index) => <div className="flow-step" key={step}><span>{step}</span>{index < flow.length - 1 && <ArrowDown size={15}/>}</div>)}</div></section>
    <section className="panel"><div className="panel-header"><div><div className="section-label">COMPONENTS</div><h2>Responsibilities</h2></div></div>
      <div className="architecture-components">{[
        ["App", "Owns history-based routing, global navigation, saved profiles, and theme preference."],
        ["Dashboard / Profile", "Loads a user and their repositories; provides profile statistics, sorting, filtering, language mix and saved-profile actions."],
        ["Explore", "Searches GitHub's public repository index and filters by language and popularity."],
        ["Repository Workspace", "Combines repository metadata, overview, file navigation and recent activity under a shareable route."],
        ["File Explorer", "Lists repository contents, builds folder breadcrumbs and routes to file previews."],
        ["Code Viewer", "Displays text source with line numbers, practical syntax highlighting and copy support; it never executes code."],
        ["README Viewer", "Renders GitHub-flavored Markdown with external links identified."],
        ["Activity Viewer", "Shows recent commits and open issues, including author, date, labels and status context."],
        ["Theme management", "Persists the selected color scheme in localStorage and applies theme variables to all views."],
        ["Developer DNA / Behaviour Analysis", "Builds language, portfolio and recent-event summaries, applies documented heuristic formulas, and exports a PDF report."],
        ["Profile Comparison", "Compares two profiles with shared metrics, language distributions, evidence-backed differences and no overall winner."],
        ["Developer analysis module", "Calculates deterministic indicators from public profile, repository and event data; unavailable inputs remain N/A."],
        ["API service layer", "Centralizes public REST requests, username validation, cancellation, short-lived profile/activity caching and API errors."]
      ].map(([name, description]) => <div className="architecture-component" key={name}><b>{name}</b><p>{description}</p></div>)}</div>
    </section>
    <section className="panel"><div className="section-label">DATA SOURCES</div><h2>GitHub API endpoints</h2><div className="endpoint-list">{endpoints.map(([endpoint, description]) => <div className="endpoint-row" key={endpoint}><code>{endpoint}</code><span>{description}</span></div>)}</div></section>
    <section className="panel"><div className="section-label">REPOSITORY MAP</div><h2>Project structure</h2><div className="project-tree"><TreeRow depth={0} label="reposcope/" detail="Vite application root"/><TreeRow depth={1} label="index.html" detail="HTML entry point and theme bootstrap"/><TreeRow depth={1} label="package.json" detail="Scripts and React/Vite dependencies"/><TreeRow depth={1} label="package-lock.json" detail="Reproducible dependency versions"/><TreeRow depth={1} label="vite.config.js" detail="Vite and React plugin configuration"/><TreeRow depth={1} label="src/" detail="Application source"/><TreeRow depth={2} label="App.jsx" detail="Routes, shared shell, navigation and persisted app state"/><TreeRow depth={2} label="api.js" detail="GitHub REST service, caching, response validation and errors"/><TreeRow depth={2} label="pages.jsx" detail="Dashboard, Explore, repository workspace, architecture and settings views"/><TreeRow depth={2} label="intelligence/" detail="Developer intelligence features"/><TreeRow depth={3} label="analysis.js" detail="Evidence-based metrics, scoring formulas and comparisons"/><TreeRow depth={3} label="components.jsx" detail="Reusable intelligence charts, metrics, and score cards"/><TreeRow depth={3} label="pages.jsx" detail="Developer DNA, behaviour analysis, and profile comparison pages"/><TreeRow depth={3} label="report.js" detail="Dependency-free PDF report generation"/><TreeRow depth={3} label="useDeveloperProfile.js" detail="Cancellable profile and public activity data hook"/><TreeRow depth={2} label="main.jsx" detail="React root and global stylesheet entry"/><TreeRow depth={2} label="styles.css" detail="Shared component styles, responsive layout and theme variables"/><TreeRow depth={1} label="README.md" detail="Project setup, feature, methodology and API documentation"/></div></section>
  </div>;
}

function TreeRow({ depth, label, detail }) {
  return <div className="tree-row" style={{ paddingLeft: `${depth * 22}px` }}><code>{label}</code><span>{detail}</span></div>;
}

export function SettingsPage({ theme, setTheme, savedProfiles, onClearSaved }) {
  return <div className="page">
    <PageHeading eyebrow="PREFERENCES" title="Settings" description="Customize how RepoScope looks and manage locally stored data."/>
    <section className="panel settings-panel"><div className="settings-row"><div><b>Appearance</b><p>Choose the color scheme used throughout RepoScope.</p></div><div className="segmented-control"><button className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")}>Light</button><button className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")}>Dark</button></div></div>
      <div className="settings-row"><div><b>Saved profiles</b><p>{savedProfiles.length} profile{savedProfiles.length === 1 ? "" : "s"} stored in this browser.</p></div><button className="button danger" disabled={!savedProfiles.length} onClick={onClearSaved}>Clear saved profiles</button></div>
      <div className="settings-row"><div><b>Data & privacy</b><p>RepoScope only requests public GitHub data. Preferences and saved usernames stay in this browser.</p></div><a className="button secondary" href="https://docs.github.com/en/rest" target="_blank" rel="noreferrer">GitHub API docs <ExternalLink size={14}/></a></div>
    </section>
  </div>;
}
