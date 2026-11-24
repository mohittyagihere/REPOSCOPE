import { useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, CalendarDays, CircleAlert, Download, GitBranch,
  GitPullRequest, RefreshCw, Star, Users
} from "lucide-react";
import { analyzeDeveloper, compareDevelopers } from "./analysis";
import { useDeveloperProfile } from "./useDeveloperProfile";
import { downloadDeveloperReport } from "./report";
import {
  ActivityTimeline, DeveloperMetric, DeveloperProfileCard, IntelligenceError,
  IntelligenceHeading, IntelligenceLoading, IntelligenceScoreCard,
  IntelligenceSectionTitle, LanguageDistribution, ScoreGrid, UsernameSearch
} from "./components";

const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const humanizeEvent = type => type?.replace(/Event$/, "").replace(/([a-z])([A-Z])/g, "$1 $2") || "Public event";
const count = value => Number(value || 0).toLocaleString();
const dateLabel = value => value ? new Date(value).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "Date unavailable";

function validateUsername(value) {
  const clean = value.trim().replace(/^@/, "");
  return USERNAME_PATTERN.test(clean) ? clean : "";
}

function InlineError({ message }) {
  return message ? <div className="intelligence-inline-error" role="alert">{message}</div> : null;
}

function useAnalysis(username) {
  const profile = useDeveloperProfile(username);
  const analysis = useMemo(() => profile.data ? analyzeDeveloper(profile.data) : null, [profile.data]);
  return { ...profile, analysis };
}

export function DeveloperDNA({ username = "", navigate }) {
  const [draft, setDraft] = useState(username);
  const [formError, setFormError] = useState("");
  const { analysis, data, loading, error, refresh } = useAnalysis(username);

  function submit(event) {
    event.preventDefault();
    const clean = validateUsername(draft);
    if (!clean) {
      setFormError("Enter a valid GitHub username using letters, numbers, and hyphens.");
      return;
    }
    setFormError("");
    navigate(`/intelligence/dna/${encodeURIComponent(clean)}`);
  }

  return <div className="page intelligence-page">
    <IntelligenceHeading eyebrow="DEVELOPER INTELLIGENCE / 01" title="Developer DNA" description="A data-grounded map of a developer's public technical portfolio and activity."
      action={analysis && <div className="intelligence-actions">
        <button className="button secondary" onClick={() => navigate(`/intelligence/behaviour/${encodeURIComponent(username)}`)}><Activity size={14}/> Behaviour analysis</button>
        <button className="button secondary" onClick={() => downloadDeveloperReport(analysis)}><Download size={14}/> Export PDF</button>
        <button className="button secondary" onClick={refresh} disabled={loading} aria-label="Refresh developer data"><RefreshCw size={14} className={loading ? "spin" : ""}/></button>
      </div>}/>
    <UsernameSearch value={draft} onChange={value => { setDraft(value); setFormError(""); }} onSubmit={submit} placeholder="Enter a GitHub username"/>
    <InlineError message={formError}/>
    {loading && <IntelligenceLoading label={`Analyzing public data for @${username}...`}/>}
    {!loading && error && <IntelligenceError message={error}/>}
    {!username && !loading && <div className="intelligence-empty-state"><Users size={20}/><b>Explore a developer profile</b><span>Enter a GitHub username to build a shareable public-data report.</span></div>}
    {analysis && <>
      <DeveloperProfileCard analysis={analysis}/>
      {data.eventsError && <div className="intelligence-data-notice"><Activity size={15}/><span>Public activity is unavailable: {data.eventsError} Profile and repository metrics are still shown.</span></div>}
      <div className="metric-grid intelligence-metric-grid">
        <DeveloperMetric label="PUBLIC REPOSITORIES" value={count(analysis.user.public_repos)} note={`${analysis.repos.length} included in this response`}/>
        <DeveloperMetric label="ORIGINAL REPOSITORIES" value={count(analysis.originalRepos.length)} note="Not marked as forks"/>
        <DeveloperMetric label="FORKED REPOSITORIES" value={count(analysis.forkedRepos.length)} note="In the returned portfolio"/>
        <DeveloperMetric label="STARS RECEIVED" value={count(analysis.totalStars)} note="Across listed repositories"/>
        <DeveloperMetric label="FORKS RECEIVED" value={count(analysis.totalForks)} note="Across listed repositories"/>
        <DeveloperMetric label="LANGUAGES DETECTED" value={count(analysis.languageDistribution.length)} note="Primary-language labels"/>
      </div>
      <div className="intelligence-dashboard-grid">
        <section className="panel intelligence-panel">
          <IntelligenceSectionTitle eyebrow="TECHNICAL IDENTITY" title="Language distribution" detail={analysis.languageRepoCount ? `${analysis.languageRepoCount} of ${analysis.repos.length} fetched repositories have a detected primary language.` : "GitHub did not report primary languages for the fetched repositories."}/>
          <LanguageDistribution distribution={analysis.languageDistribution}/>
          {analysis.dominantLanguage && <div className="dominant-language"><span>Most common</span><b>{analysis.dominantLanguage.language}</b><small>{analysis.dominantLanguage.count} repositories</small></div>}
        </section>
        <section className="panel intelligence-panel portfolio-panel">
          <IntelligenceSectionTitle eyebrow="PORTFOLIO" title="Project patterns" detail="Repository counts describe the returned public profile list, not private or deleted work."/>
          <div className="portfolio-stats">
            <PortfolioStat icon={<GitBranch size={15}/>} label="Created in last 90 days" value={analysis.recentCreatedCount}/>
            <PortfolioStat icon={<CalendarDays size={15}/>} label="Updated in last 30 days" value={analysis.recentlyUpdatedCount}/>
            <PortfolioStat icon={<Star size={15}/>} label="Most popular project" value={analysis.mostPopularRepository?.name || "None returned"} note={analysis.mostPopularRepository ? `${count(analysis.mostPopularRepository.stargazers_count)} stars` : ""}/>
          </div>
        </section>
        <section className="panel intelligence-panel">
          <IntelligenceSectionTitle eyebrow="PUBLIC ACTIVITY" title="Recent activity timeline" detail="GitHub returns a limited recent public-event sample; this is not a full contribution calendar."/>
          {analysis.eventsAvailable ? <ActivityTimeline periods={analysis.activityByPeriod}/> : <p className="intelligence-empty">Public event history is unavailable; no activity score is calculated.</p>}
          {analysis.eventsAvailable && <div className="activity-type-list">{analysis.activityTypes.slice(0, 5).map(item => <span key={item.type}>{humanizeEvent(item.type)} <b>{item.count}</b></span>)}</div>}
        </section>
        <section className="panel intelligence-panel">
          <IntelligenceSectionTitle eyebrow="RECENT PUBLIC EVENTS" title="Latest activity" detail={`${analysis.events.length} event(s) returned by GitHub's recent public events endpoint.`}/>
          {analysis.events.length ? <div className="event-list">{analysis.events.slice(0, 8).map((event, index) => <div className="event-row" key={event.id || `${event.type}-${event.created_at}-${index}`}>
            <Activity size={14}/><div><b>{humanizeEvent(event.type)}</b><span>{event.repo?.name || "Repository unavailable"}</span></div><time>{dateLabel(event.created_at)}</time>
          </div>)}</div> : <p className="intelligence-empty">{analysis.eventsAvailable ? "No public events were returned in the available sample." : data.eventsError}</p>}
        </section>
        <section className="panel intelligence-panel recent-projects-panel">
          <IntelligenceSectionTitle eyebrow="REPOSITORY PORTFOLIO" title="Recently updated repositories"/>
          {analysis.recentRepos.length ? <div className="recent-project-list">{analysis.recentRepos.map(repo => <a key={repo.id} href={`/repo/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}`} onClick={event => { event.preventDefault(); navigate(`/repo/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}`); }}>
            <span><b>{repo.name}</b><small>{repo.description || "No public description"}</small></span><span className="recent-project-meta">{repo.language || "Language unavailable"} · {dateLabel(repo.updated_at)}<ArrowUpRight size={13}/></span>
          </a>)}</div> : <p className="intelligence-empty">No public repositories were returned for this profile.</p>}
        </section>
      </div>
      <InsightsPanel insights={analysis.insights}/>
      <DataLimitations items={analysis.limitations}/>
    </>}
  </div>;
}

export function BehaviourAnalysis({ username = "", navigate }) {
  const [draft, setDraft] = useState(username);
  const [formError, setFormError] = useState("");
  const { analysis, data, loading, error } = useAnalysis(username);

  function submit(event) {
    event.preventDefault();
    const clean = validateUsername(draft);
    if (!clean) {
      setFormError("Enter a valid GitHub username using letters, numbers, and hyphens.");
      return;
    }
    setFormError("");
    navigate(`/intelligence/behaviour/${encodeURIComponent(clean)}`);
  }

  return <div className="page intelligence-page">
    <IntelligenceHeading eyebrow="DEVELOPER INTELLIGENCE / 02" title="Behaviour analysis" description="Transparent heuristics describing observable patterns in public repositories and recent public events."
      action={analysis && <button className="button secondary" onClick={() => navigate(`/intelligence/dna/${encodeURIComponent(username)}`)}>Developer DNA <ArrowUpRight size={14}/></button>}/>
    <UsernameSearch value={draft} onChange={value => { setDraft(value); setFormError(""); }} onSubmit={submit}/>
    <InlineError message={formError}/>
    {loading && <IntelligenceLoading label={`Evaluating public indicators for @${username}...`}/>}
    {!loading && error && <IntelligenceError message={error}/>}
    {!username && !loading && <div className="intelligence-empty-state"><Activity size={20}/><b>Inspect observable patterns</b><span>Analysis uses only public GitHub profile, repository, language-label, and recent event data.</span></div>}
    {analysis && <>
      <DeveloperProfileCard analysis={analysis}/>
      {data.eventsError && <div className="intelligence-data-notice"><Activity size={15}/><span>Event-based consistency and collaboration indicators are unavailable. Other scores use the public repository data that loaded.</span></div>}
      <div className="behavior-disclaimer"><CircleAlert size={16}/><p>These are heuristic public-portfolio indicators—not official GitHub scores, productivity estimates, skill ratings, or psychological assessments. Every score below includes its calculation and observed evidence.</p></div>
      <section className="panel intelligence-panel">
        <IntelligenceSectionTitle eyebrow="FIVE PUBLIC-DATA DIMENSIONS" title="Behaviour indicators" detail="Scores are normalized to 0–100 using the documented formula shown on each card. N/A means required public data was unavailable."/>
        <ScoreGrid scores={analysis.scores}/>
      </section>
      <section className="panel intelligence-panel">
        <IntelligenceSectionTitle eyebrow="OBSERVABLE PATTERNS" title="Evidence-backed classifications" detail="A profile may match multiple thresholds; labels describe the portfolio signals below, not the developer's personality."/>
        {analysis.classifications.length ? <div className="classification-grid">{analysis.classifications.map(item => <article key={item.name} className="classification-card"><b>{item.name}</b><p>{item.evidence}</p></article>)}
        </div> : <p className="intelligence-empty">No classification threshold was met with the available data.</p>}
      </section>
      <InsightsPanel insights={analysis.insights} title="Things you might not know about yourself"/>
      <section className="panel intelligence-panel">
        <IntelligenceSectionTitle eyebrow="CONSISTENCY EVIDENCE" title="Public event frequency" detail="Three rolling 30-day periods from GitHub's available recent event sample."/>
        {analysis.eventsAvailable ? <ActivityTimeline periods={analysis.activityByPeriod}/> : <p className="intelligence-empty">Insufficient public event data to calculate this timeline.</p>}
      </section>
      <DataLimitations items={analysis.limitations}/>
    </>}
  </div>;
}

function PortfolioStat({ icon, label, value, note }) {
  return <div className="portfolio-stat">{icon}<span><small>{label}</small><b>{value}</b>{note && <small>{note}</small>}</span></div>;
}

function InsightsPanel({ insights, title = "Things you might not know about yourself" }) {
  return <section className="panel intelligence-panel insights-panel">
    <IntelligenceSectionTitle eyebrow="DATA-BASED OBSERVATIONS" title={title}/>
    {insights.length ? <ul>{insights.map((insight, index) => <li key={`${index}-${insight}`}>{insight}</li>)}</ul> : <p className="intelligence-empty">Not enough public data is available to produce observations.</p>}
  </section>;
}

function DataLimitations({ items }) {
  return <details className="data-limitations"><summary>Data limitations and methodology</summary><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></details>;
}

export function ProfileComparison({ firstUsername = "", secondUsername = "", navigate }) {
  const [firstDraft, setFirstDraft] = useState(firstUsername);
  const [secondDraft, setSecondDraft] = useState(secondUsername);
  const [formError, setFormError] = useState("");
  const hasPair = !!firstUsername && !!secondUsername;
  const sameProfile = hasPair && firstUsername.toLowerCase() === secondUsername.toLowerCase();
  const firstProfile = useAnalysis(hasPair ? firstUsername : "");
  const secondProfile = useAnalysis(hasPair && !sameProfile ? secondUsername : "");
  const first = firstProfile.analysis;
  const second = sameProfile ? first : secondProfile.analysis;
  const comparison = useMemo(() => first && second ? compareDevelopers(first, second, sameProfile) : null, [first, second, sameProfile]);
  const error = firstProfile.error || (!sameProfile && secondProfile.error);
  const loading = firstProfile.loading || (!sameProfile && secondProfile.loading);

  function submit(event) {
    event.preventDefault();
    const cleanFirst = validateUsername(firstDraft);
    const cleanSecond = validateUsername(secondDraft);
    if (!cleanFirst || !cleanSecond) {
      setFormError("Enter two valid GitHub usernames using letters, numbers, and hyphens.");
      return;
    }
    setFormError("");
    navigate(`/intelligence/compare/${encodeURIComponent(cleanFirst)}/${encodeURIComponent(cleanSecond)}`);
  }

  return <div className="page intelligence-page">
    <IntelligenceHeading eyebrow="DEVELOPER INTELLIGENCE / 03" title="Profile comparison" description="Compare two public GitHub portfolios side by side—without ranking one developer as better."/>
    <form className="comparison-search" onSubmit={submit}>
      <label><span>Developer A</span><input aria-label="Developer A username" value={firstDraft} onChange={event => setFirstDraft(event.target.value)} placeholder="GitHub username"/></label>
      <span className="comparison-vs">VS</span>
      <label><span>Developer B</span><input aria-label="Developer B username" value={secondDraft} onChange={event => setSecondDraft(event.target.value)} placeholder="GitHub username"/></label>
      <button className="button primary" type="submit">Compare profiles</button>
    </form>
    <InlineError message={formError}/>
    {loading && <IntelligenceLoading label="Comparing public GitHub profiles..."/>}
    {!loading && error && <IntelligenceError message={error}/>}
    {!hasPair && !loading && <div className="intelligence-empty-state"><GitPullRequest size={20}/><b>Choose two GitHub profiles</b><span>Comparison results are shareable at a URL containing both usernames.</span></div>}
    {comparison && <ComparisonReport first={first} second={second} comparison={comparison} firstData={firstProfile.data} secondData={sameProfile ? firstProfile.data : secondProfile.data}/>}
  </div>;
}

function ComparisonReport({ first, second, comparison, firstData, secondData }) {
  const languages = useMemo(() => compareLanguageDistribution(first, second), [first, second]);
  return <>
    {comparison.sameProfile && <div className="intelligence-data-notice"><Users size={15}/><span>Both entries resolve to the same username. The comparison shows two views of the same public account.</span></div>}
    <div className="comparison-profiles">
      <DeveloperProfileCard analysis={first}/>
      {!comparison.sameProfile && <DeveloperProfileCard analysis={second}/>}
    </div>
    <section className="panel intelligence-panel comparison-metrics-panel">
      <IntelligenceSectionTitle eyebrow="PUBLIC PROFILE METRICS" title="Side-by-side comparison" detail="Stars and forks are summed from each profile's returned repository list (up to 100 repositories)."/>
      <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Metric</th><th>@{first.user.login}</th><th>@{second.user.login}</th></tr></thead><tbody>
        {comparison.metrics.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{item.first === null ? "Unavailable" : count(item.first)}</td><td>{item.second === null ? "Unavailable" : count(item.second)}</td></tr>)}
      </tbody></table></div>
    </section>
    <section className="panel intelligence-panel">
      <IntelligenceSectionTitle eyebrow="TECHNICAL IDENTITY" title="Language distribution" detail="Each value is the share of repositories with a detected primary-language label."/>
      {languages.length ? <><div className="comparison-language-head"><span>Language</span><span>@{first.user.login} / @{second.user.login}</span></div><div className="comparison-language-list">{languages.map(item => <div className="comparison-language-row" key={item.language}>
        <b>{item.language}</b><ComparisonBar label={first.user.login} percent={item.firstPercent} value={item.firstCount}/><ComparisonBar label={second.user.login} percent={item.secondPercent} value={item.secondCount}/>
      </div>)}</div></> : <p className="intelligence-empty">Insufficient language data for comparison.</p>}
    </section>
    <section className="panel intelligence-panel">
      <IntelligenceSectionTitle eyebrow="DEVELOPER DNA" title="Heuristic indicators" detail="Dimensions are independent public-data indicators; a higher value is not an overall rating."/>
      <div className="comparison-scores">
        <div><h3>@{first.user.login}</h3><ScoreGrid scores={first.scores} compact/></div>
        <div><h3>@{second.user.login}</h3><ScoreGrid scores={second.scores} compact/></div>
      </div>
    </section>
    <div className="comparison-insights">
      <section className="panel intelligence-panel"><IntelligenceSectionTitle eyebrow="CALCULATED DIFFERENCES" title="What makes these developers different?"/>
        {comparison.differences.length ? <ul className="comparison-observations">{comparison.differences.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : <p className="intelligence-empty">No differences in the compared public metrics.</p>}
      </section>
      <section className="panel intelligence-panel"><IntelligenceSectionTitle eyebrow="SHARED SIGNALS" title="Similarities"/>
        {comparison.similarities.length ? <ul className="comparison-observations">{comparison.similarities.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : <p className="intelligence-empty">No close matches were detected in the metrics shown.</p>}
      </section>
    </div>
    <DataLimitations items={firstData?.eventsError || secondData?.eventsError ? [...first.limitations, "Public events for one or both profiles were unavailable; event-based comparison values are shown as unavailable."] : first.limitations}/>
  </>;
}

function compareLanguageDistribution(first, second) {
  const firstMap = new Map(first.languageDistribution.map(item => [item.language, item]));
  const secondMap = new Map(second.languageDistribution.map(item => [item.language, item]));
  return [...new Set([...firstMap.keys(), ...secondMap.keys()])].map(language => ({
    language,
    firstCount: firstMap.get(language)?.count || 0,
    secondCount: secondMap.get(language)?.count || 0,
    firstPercent: firstMap.get(language)?.percent || 0,
    secondPercent: secondMap.get(language)?.percent || 0
  })).sort((a, b) => (b.firstCount + b.secondCount) - (a.firstCount + a.secondCount));
}

function ComparisonBar({ label, percent, value }) {
  return <div className="comparison-bar-cell" aria-label={`${label}: ${value} repositories, ${percent.toFixed(1)} percent`}>
    <div className="comparison-bar-track"><span style={{ width: `${percent}%` }}/></div><small>{percent.toFixed(1)}% <i>({value})</i></small>
  </div>;
}

