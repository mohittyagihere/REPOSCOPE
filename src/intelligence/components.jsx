import { ArrowDown, ArrowUpRight, CircleAlert, LoaderCircle, Search } from "lucide-react";

export function IntelligenceHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading intelligence-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function UsernameSearch({ value, onChange, onSubmit, placeholder = "GitHub username", buttonLabel = "Analyze profile" }) {
  return (
    <form className="search-form intelligence-search" onSubmit={onSubmit}>
      <Search size={16}/>
      <span className="search-prefix">github.com/</span>
      <input value={value} onChange={event => onChange(event.target.value)} aria-label="GitHub username" placeholder={placeholder}/>
      <button className="button primary" type="submit">{buttonLabel}</button>
    </form>
  );
}

export function DeveloperMetric({ label, value, note }) {
  return <div className="metric-card intelligence-metric"><div className="metric-heading"><span>{label}</span></div><b>{value}</b>{note && <small>{note}</small>}</div>;
}

const SCORE_LABELS = {
  consistency: "Consistency",
  exploration: "Technical exploration",
  specialization: "Specialization",
  collaboration: "Collaboration",
  building: "Project building"
};

export function IntelligenceScoreCard({ name, result, compact = false }) {
  const label = SCORE_LABELS[name] || name;
  return (
    <article className={`score-card ${compact ? "compact" : ""}`}>
      <div className="score-card-heading"><b>{label}</b><strong>{result.value === null ? "N/A" : result.value}</strong></div>
      {result.value !== null && <div className="score-meter" role="meter" aria-label={`${label} indicator`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={result.value}><span style={{ width: `${result.value}%` }}/></div>}
      {result.value === null && <p className="score-unavailable"><CircleAlert size={13}/>{result.unavailableReason}</p>}
      {!compact && <>
        <p className="score-formula">{result.formula}</p>
        {!!result.evidence.length && <ul className="evidence-list">{result.evidence.map(item => <li key={item}>{item}</li>)}</ul>}
      </>}
    </article>
  );
}

export function ScoreGrid({ scores, compact = false }) {
  return <div className={`score-grid ${compact ? "compact" : ""}`}>
    {Object.entries(scores).map(([name, result]) => <IntelligenceScoreCard key={name} name={name} result={result} compact={compact}/>)}
  </div>;
}

export function LanguageDistribution({ distribution, emptyLabel = "No repository language data is available." }) {
  if (!distribution.length) return <p className="intelligence-empty">{emptyLabel}</p>;
  const total = distribution.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="intelligence-language-list">
      {distribution.map((item, index) => <div className="intelligence-language" key={item.language}>
        <div className="intelligence-language-label"><span><i className={`language-color color-${index % 8}`}/>{item.language}</span><b>{item.percent.toFixed(1)}% <small>{item.count}</small></b></div>
        <div className="language-meter"><span style={{ width: `${item.percent}%` }}/></div>
      </div>)}
      <div className="chart-caption">{total} repositories with a detected primary language</div>
    </div>
  );
}

export function ActivityTimeline({ periods }) {
  const max = Math.max(...periods.map(period => period.count), 1);
  return (
    <div className="activity-timeline">
      {periods.map(period => <div className="activity-period" key={period.label}>
        <div className="activity-bar-track"><span style={{ height: `${period.count ? Math.max(period.count / max * 100, 4) : 0}%` }}/></div>
        <b>{period.count}</b><span>{period.label}</span>
      </div>)}
      <p className="chart-caption"><ArrowDown size={12}/> Public event counts in GitHub's available recent sample; not a complete contribution history.</p>
    </div>
  );
}

export function DeveloperProfileCard({ analysis }) {
  const { user } = analysis;
  return <section className="panel intelligence-profile">
    <img className="intelligence-avatar" src={user.avatar_url} alt={`${user.login}'s avatar`}/>
    <div className="intelligence-profile-main">
      <div className="intelligence-profile-name"><h2>{user.name || user.login}</h2><span>@{user.login}</span></div>
      <p>{user.bio || "No public bio provided."}</p>
      <div className="intelligence-profile-meta"><span>Joined {user.created_at ? new Date(user.created_at).toLocaleDateString("en", { month: "short", year: "numeric" }) : "date unavailable"}</span><span>{user.followers.toLocaleString()} followers</span><span>{user.following.toLocaleString()} following</span></div>
    </div>
    <a className="button secondary" href={user.html_url} target="_blank" rel="noreferrer">GitHub profile <ArrowUpRight size={14}/></a>
  </section>;
}

export function IntelligenceLoading({ label = "Loading public GitHub data..." }) {
  return <div className="state-panel"><LoaderCircle className="spin" size={19}/><span>{label}</span></div>;
}

export function IntelligenceError({ message }) {
  return <div className="state-panel error-state"><CircleAlert size={18}/><span>{message}</span></div>;
}

export function IntelligenceSectionTitle({ eyebrow, title, detail }) {
  return <div className="intelligence-section-title">{eyebrow && <div className="section-label">{eyebrow}</div>}<h2>{title}</h2>{detail && <p>{detail}</p>}</div>;
}

