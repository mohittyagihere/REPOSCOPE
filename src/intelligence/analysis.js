const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = ["Last 30 days", "31–60 days ago", "61–90 days ago"];
const EXTERNAL_ACTIVITY_TYPES = new Set([
  "PushEvent", "PullRequestEvent", "PullRequestReviewEvent", "IssuesEvent",
  "IssueCommentEvent", "CommitCommentEvent", "ForkEvent"
]);

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = value => Math.round(value * 10) / 10;

function daysAgo(value, now) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.floor((now - timestamp) / DAY_MS) : Infinity;
}

function sum(repos, key) {
  return repos.reduce((total, repo) => total + (Number(repo[key]) || 0), 0);
}

function score(value, formula, evidence = [], unavailableReason = "") {
  return {
    value: value === null ? null : Math.round(clamp(value)),
    formula,
    evidence,
    unavailableReason
  };
}

function getExternalEvents(events, username) {
  const normalizedUsername = username.toLowerCase();
  return events.filter(event => {
    if (!EXTERNAL_ACTIVITY_TYPES.has(event.type)) return false;
    const owner = event.repo?.name?.split("/")[0];
    return owner && owner.toLowerCase() !== normalizedUsername;
  });
}

export function analyzeDeveloper({
  user,
  repos = [],
  events = [],
  eventsAvailable = true,
  now = Date.now()
}) {
  const languageCounts = {};
  for (const repo of repos) {
    if (repo.language) languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
  }
  const languageDistribution = Object.entries(languageCounts)
    .map(([language, count]) => ({ language, count, percent: count / Math.max(1, Object.values(languageCounts).reduce((a, b) => a + b, 0)) * 100 }))
    .sort((a, b) => b.count - a.count);
  const languageRepoCount = languageDistribution.reduce((total, item) => total + item.count, 0);
  const dominantLanguage = languageDistribution[0] || null;
  const originalRepos = repos.filter(repo => !repo.fork);
  const forkedRepos = repos.filter(repo => repo.fork);
  const totalStars = sum(repos, "stargazers_count");
  const totalForks = sum(repos, "forks_count");
  const mostPopularRepository = repos.reduce((popular, repo) =>
    !popular || repo.stargazers_count > popular.stargazers_count ? repo : popular, null);
  const averageStars = repos.length ? totalStars / repos.length : 0;
  const describedRepos = repos.filter(repo => repo.description?.trim() || repo.topics?.length);
  const recentRepos = repos.slice()
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5);
  const recentCreatedCount = repos.filter(repo => daysAgo(repo.created_at, now) <= 90).length;
  const recentlyUpdatedCount = repos.filter(repo => daysAgo(repo.updated_at, now) <= 30).length;

  const validEvents = events.filter(event => Number.isFinite(new Date(event.created_at).getTime()));
  const eventsInWindow = validEvents.filter(event => {
    const age = daysAgo(event.created_at, now);
    return age >= 0 && age < 90;
  });
  const activityByPeriod = PERIODS.map((label, index) => {
    const start = index * 30;
    const end = start + 30;
    const periodEvents = eventsInWindow.filter(event => {
      const age = daysAgo(event.created_at, now);
      return age >= start && age < end;
    });
    return { label, count: periodEvents.length, events: periodEvents };
  });
  const latestEvent = eventsInWindow.slice().sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at))[0] || null;
  const lastActivityDays = latestEvent ? daysAgo(latestEvent.created_at, now) : null;
  const externalEvents = getExternalEvents(eventsInWindow, user.login);
  const activePeriods = activityByPeriod.filter(period => period.count > 0).length;
  const topLanguageShare = dominantLanguage?.percent || 0;

  const consistencyScore = eventsAvailable
    ? score(
      Math.min(eventsInWindow.length / 30, 1) * 40
        + activePeriods / 3 * 40
        + (lastActivityDays === null ? 0 : lastActivityDays <= 14 ? 20 : lastActivityDays <= 30 ? 10 : 0),
      "40%: min(public events in the last 90 days ÷ 30, 1); 40%: active 30-day periods ÷ 3; 20%: recency (20 points ≤14 days, 10 points ≤30 days).",
      [
        `${eventsInWindow.length} public events in the available 90-day window`,
        `${activePeriods} of 3 rolling 30-day periods contain events`,
        lastActivityDays === null ? "No public events were returned" : `Most recent returned event was ${lastActivityDays} day(s) ago`
      ]
    )
    : score(null, "Requires the public events endpoint.", [], "Public activity data could not be loaded.");

  const explorationScore = repos.length && languageRepoCount
    ? score(
      Math.min(languageDistribution.length / 6, 1) * 70 + Math.min(repos.length / 20, 1) * 30,
      "70%: min(distinct detected repository languages ÷ 6, 1); 30%: min(public repositories ÷ 20, 1).",
      [`${languageDistribution.length} distinct primary languages`, `${repos.length} public repositories`]
    )
    : score(null, "Requires at least one public repository with a detected primary language.", [], "Insufficient public language data.");

  const specializationScore = repos.length && languageRepoCount
    ? score(
      topLanguageShare,
      "Percentage of repositories with a detected primary language that use the most common language.",
      [`${dominantLanguage.language} is the primary language of ${round(topLanguageShare)}% of language-tagged repositories`]
    )
    : score(null, "Requires repository primary-language data.", [], "Insufficient public language data.");

  const collaborationScore = repos.length && eventsAvailable
    ? score(
      Math.min(forkedRepos.length / repos.length, 1) * 40
        + Math.min(externalEvents.length / 10, 1) * 60,
      "40%: forked repositories ÷ all listed repositories; 60%: min(observed qualifying external-repository events ÷ 10, 1).",
      [
        `${forkedRepos.length} of ${repos.length} listed repositories are forks`,
        `${externalEvents.length} qualifying public events were observed in repositories owned by others`
      ]
    )
    : score(null, "Requires a repository list and the public events endpoint.", [], eventsAvailable ? "No public repositories are available." : "Public collaboration activity could not be loaded.");

  const buildingScore = repos.length
    ? score(
      Math.min(originalRepos.length / 10, 1) * 40
        + describedRepos.length / repos.length * 30
        + Math.min(totalStars / 500, 1) * 30,
      "40%: min(original repositories ÷ 10, 1); 30%: repositories with a description or topic ÷ all listed repositories; 30%: min(total stars ÷ 500, 1).",
      [
        `${originalRepos.length} original repositories`,
        `${describedRepos.length} repositories have a description or topic`,
        `${totalStars} stars across listed repositories`
      ]
    )
    : score(null, "Requires at least one public repository.", [], "No public repositories are available.");

  const scores = {
    consistency: consistencyScore,
    exploration: explorationScore,
    specialization: specializationScore,
    collaboration: collaborationScore,
    building: buildingScore
  };

  const classifications = [];
  if (languageDistribution.length >= 4) {
    classifications.push({ name: "The Explorer", evidence: `Uses ${languageDistribution.length} distinct primary languages across public repositories.` });
  }
  if (repos.length >= 3 && topLanguageShare >= 65) {
    classifications.push({ name: "The Specialist", evidence: `${dominantLanguage.language} leads ${round(topLanguageShare)}% of language-tagged repositories.` });
  }
  if (originalRepos.length >= 3) {
    classifications.push({ name: "The Builder", evidence: `Maintains ${originalRepos.length} original public repositories.` });
  }
  if (eventsAvailable && externalEvents.length >= 1) {
    classifications.push({ name: "The Collaborator", evidence: `${externalEvents.length} qualifying public events appear in repositories owned by others.` });
  }
  if (eventsAvailable && activePeriods >= 2 && lastActivityDays !== null && lastActivityDays <= 30) {
    classifications.push({ name: "The Consistent Developer", evidence: `Public events appear in ${activePeriods} periods, with activity within the last 30 days.` });
  }
  if (languageDistribution.length >= 3 && originalRepos.length >= 3) {
    classifications.push({ name: "The Experimental Developer", evidence: `Combines ${languageDistribution.length} primary languages with ${originalRepos.length} original repositories.` });
  }

  const insights = [];
  if (dominantLanguage) {
    insights.push(`Your public repositories most often use ${dominantLanguage.language} (${round(dominantLanguage.percent)}% of repositories with a detected primary language).`);
  }
  if (repos.length) {
    insights.push(`${originalRepos.length} original repositories and ${forkedRepos.length} forked repositories are present in the fetched portfolio.`);
  }
  if (mostPopularRepository && averageStars > 0 && mostPopularRepository.stargazers_count > averageStars) {
    insights.push(`${mostPopularRepository.name} has ${round(mostPopularRepository.stargazers_count / averageStars)}× the average stars per listed repository.`);
  }
  if (languageDistribution.length > 1) {
    insights.push(`The fetched repository portfolio spans ${languageDistribution.length} primary programming languages.`);
  }
  if (eventsAvailable) {
    insights.push(`${eventsInWindow.length} public events were returned for the available activity window; GitHub does not expose a complete private activity history here.`);
  }

  return {
    user,
    repos,
    events: eventsInWindow,
    eventsAvailable,
    externalEvents,
    languageDistribution,
    languageRepoCount,
    dominantLanguage,
    originalRepos,
    forkedRepos,
    totalStars,
    totalForks,
    averageStars,
    mostPopularRepository,
    describedRepos,
    recentRepos,
    recentCreatedCount,
    recentlyUpdatedCount,
    activityByPeriod,
    activityTypes: Object.entries(eventsInWindow.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] || 0) + 1;
      return counts;
    }, {})).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    lastActivityDays,
    scores,
    classifications,
    insights,
    limitations: [
      "GitHub public events are a recent, capped sample, not a complete history; private activity is not included.",
      "Language distribution counts each repository's GitHub primary-language label, not code bytes or lines.",
      "The dashboard includes at most 100 repositories returned by the public profile endpoint.",
      "Scores are transparent portfolio indicators, not official GitHub scores, productivity measures, or assessments of skill or personality."
    ]
  };
}

export function compareDevelopers(first, second, sameProfile = false) {
  const firstLabel = `@${first.user.login}`;
  const secondLabel = `@${second.user.login}`;
  const metrics = [
    { label: "Public repositories", first: first.user.public_repos, second: second.user.public_repos },
    { label: "Repositories analyzed", first: first.repos.length, second: second.repos.length },
    { label: "Followers", first: first.user.followers, second: second.user.followers },
    { label: "Following", first: first.user.following, second: second.user.following },
    { label: "Stars across listed repositories", first: first.totalStars, second: second.totalStars },
    { label: "Forks received across listed repositories", first: first.totalForks, second: second.totalForks },
    { label: "Original repositories", first: first.originalRepos.length, second: second.originalRepos.length },
    { label: "Forked repositories", first: first.forkedRepos.length, second: second.forkedRepos.length },
    { label: "Detected primary languages", first: first.languageDistribution.length, second: second.languageDistribution.length },
    { label: "Recently updated (30 days)", first: first.recentlyUpdatedCount, second: second.recentlyUpdatedCount },
    { label: "Recent public events returned", first: first.eventsAvailable ? first.events.length : null, second: second.eventsAvailable ? second.events.length : null }
  ];

  const differences = [];
  const similarities = [];
  if (sameProfile) {
    similarities.push("Both entries use the same GitHub account; their public snapshots are identical.");
    return { metrics, differences, similarities, sameProfile: true };
  }

  const quantitative = [
    ["public repositories", first.user.public_repos, second.user.public_repos],
    ["followers", first.user.followers, second.user.followers],
    ["following", first.user.following, second.user.following],
    ["stars across listed repositories", first.totalStars, second.totalStars],
    ["forks received across listed repositories", first.totalForks, second.totalForks],
    ["original repositories", first.originalRepos.length, second.originalRepos.length],
    ["forked repositories", first.forkedRepos.length, second.forkedRepos.length],
    ["detected primary languages", first.languageDistribution.length, second.languageDistribution.length],
    ["repositories updated within 30 days", first.recentlyUpdatedCount, second.recentlyUpdatedCount],
    ["recent public events returned", first.eventsAvailable ? first.events.length : null, second.eventsAvailable ? second.events.length : null]
  ];
  for (const [label, firstValue, secondValue] of quantitative) {
    if (firstValue === null || secondValue === null) continue;
    if (firstValue === secondValue) {
      similarities.push(`Both profiles show ${firstValue} ${label}.`);
    } else {
      const higherLabel = firstValue > secondValue ? firstLabel : secondLabel;
      const lowerLabel = firstValue > secondValue ? secondLabel : firstLabel;
      const difference = Math.abs(firstValue - secondValue);
      differences.push(`${higherLabel} has ${difference} more ${label} than ${lowerLabel}.`);
    }
  }

  if (first.dominantLanguage && second.dominantLanguage) {
    if (first.dominantLanguage.language === second.dominantLanguage.language) {
      similarities.push(`Both profiles have ${first.dominantLanguage.language} as their most common detected primary language.`);
    } else {
      differences.push(`${firstLabel}'s most common detected language is ${first.dominantLanguage.language}; ${secondLabel}'s is ${second.dominantLanguage.language}.`);
    }
  }

  for (const key of ["consistency", "exploration", "specialization", "collaboration", "building"]) {
    const firstScore = first.scores[key].value;
    const secondScore = second.scores[key].value;
    if (firstScore === null || secondScore === null || firstScore === secondScore) continue;
    const higherLabel = firstScore > secondScore ? firstLabel : secondLabel;
    const lowerLabel = firstScore > secondScore ? secondLabel : firstLabel;
    differences.push(`${higherLabel} has a ${Math.abs(firstScore - secondScore)}-point higher ${key} indicator using the documented public-data formula; this is not an overall ranking.`);
  }

  if (!differences.length) similarities.push("No differences were found in the compared public metrics.");
  return { metrics, differences, similarities, sameProfile: false };
}
