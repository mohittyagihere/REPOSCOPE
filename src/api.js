const API = "https://api.github.com";
const BASE_HEADERS = { Accept: "application/vnd.github+json" };
const responseCache = new Map();
const PROFILE_CACHE_TTL = 60_000;
const ACTIVITY_CACHE_TTL = 120_000;
const MAX_CACHE_ENTRIES = 100;

export class GitHubApiError extends Error {
  constructor(message, status, retryAfter) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function request(path, signal, cacheTtl = 0, forceRefresh = false) {
  if (signal?.aborted) {
    const error = new Error("The request was cancelled.");
    error.name = "AbortError";
    throw error;
  }
  if (forceRefresh) responseCache.delete(path);
  const cached = responseCache.get(path);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(`${API}${path}`, {
    headers: BASE_HEADERS,
    signal
  });

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const remaining = response.headers.get("x-ratelimit-remaining");
    let message;
    if (response.status === 404) {
      message = "That GitHub resource could not be found.";
    } else if (response.status === 403 && remaining === "0") {
      message = "GitHub's public API rate limit has been reached. Please try again later.";
    } else if (response.status === 403 || response.status === 429) {
      const delay = Number(retryAfter);
      message = Number.isFinite(delay) && delay > 0
        ? `GitHub denied this request. Please retry in about ${delay} seconds.`
        : "GitHub denied this request. Please try again later.";
    } else if (response.status === 422) {
      message = "GitHub could not process this request. Check the username, repository, or search parameters.";
    } else {
      message = `GitHub returned an error (${response.status}). Please try again.`;
    }
    throw new GitHubApiError(message, response.status, retryAfter);
  }

  const result = await response.json();
  if (cacheTtl) {
    if (responseCache.size >= MAX_CACHE_ENTRIES) {
      responseCache.delete(responseCache.keys().next().value);
    }
    responseCache.set(path, { value: result, expiresAt: Date.now() + cacheTtl });
  }
  return result;
}

function validUsername(value, label = "username") {
  const clean = value.trim();
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(clean) || clean.startsWith("-") || clean.endsWith("-")) {
    throw new Error(`Enter a valid GitHub ${label}.`);
  }
  return encodeURIComponent(clean);
}

function validRepositoryName(value) {
  const clean = value.trim();
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(clean) || clean === "." || clean === "..") {
    throw new Error("Enter a valid GitHub repository name.");
  }
  return encodeURIComponent(clean);
}

export async function getProfile(username, signal, forceRefresh = false) {
  const clean = validUsername(username);
  const [user, repos] = await Promise.all([
    request(`/users/${clean}`, signal, PROFILE_CACHE_TTL, forceRefresh),
    request(`/users/${clean}/repos?per_page=100&sort=updated&type=owner`, signal, PROFILE_CACHE_TTL, forceRefresh)
  ]);
  return { user, repos };
}

export function getUserEvents(username, signal, forceRefresh = false) {
  const clean = validUsername(username);
  return request(`/users/${clean}/events/public?per_page=100`, signal, ACTIVITY_CACHE_TTL, forceRefresh);
}

export async function searchRepositories({ query, language, sort = "stars", page = 1 }, signal) {
  const terms = [query.trim(), language && `language:${language}`].filter(Boolean).join(" ");
  if (!terms) throw new Error("Enter a keyword or select a language to search repositories.");
  const params = new URLSearchParams({
    q: terms,
    sort,
    order: "desc",
    per_page: "20",
    page: String(page)
  });
  return request(`/search/repositories?${params}`, signal);
}

export async function getRepository(owner, repo, signal) {
  return request(`/repos/${validUsername(owner, "owner")}/${validRepositoryName(repo)}`, signal);
}

export async function getRepositoryContents(owner, repo, path = "", signal) {
  const base = `/repos/${validUsername(owner, "owner")}/${validRepositoryName(repo)}/contents`;
  const suffix = path ? `/${path.split("/").map(encodeURIComponent).join("/")}` : "";
  try {
    return await request(`${base}${suffix}`, signal);
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404 && !path) return [];
    throw error;
  }
}

export async function getFileContent(owner, repo, path, signal) {
  const contents = await getRepositoryContents(owner, repo, path, signal);
  if (Array.isArray(contents) || contents.type !== "file") {
    throw new Error("This path is not a file.");
  }
  if (contents.size > 1_000_000) {
    return { ...contents, text: null, tooLarge: true };
  }
  if (contents.encoding !== "base64" || typeof contents.content !== "string") {
    return { ...contents, text: null, binary: true };
  }
  const binary = atob(contents.content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (text.includes("\0")) return { ...contents, text: null, binary: true };
  return { ...contents, text, binary: false };
}

export async function getReadme(owner, repo, signal) {
  try {
    const readme = await request(
      `/repos/${validUsername(owner, "owner")}/${validRepositoryName(repo)}/readme`,
      signal
    );
    if (readme.encoding !== "base64" || typeof readme.content !== "string") {
      throw new Error("README preview is unavailable because GitHub returned an unsupported encoding.");
    }
    const binary = atob(readme.content.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) return null;
    throw error;
  }
}

export function getRepositoryLanguages(owner, repo, signal) {
  return request(
    `/repos/${validUsername(owner, "owner")}/${validRepositoryName(repo)}/languages`,
    signal
  );
}

export function getRepositoryCommits(owner, repo, signal) {
  return request(
    `/repos/${validUsername(owner, "owner")}/${validRepositoryName(repo)}/commits?per_page=10`,
    signal
  );
}

export function getRepositoryIssues(owner, repo, signal) {
  return request(
    `/repos/${validUsername(owner, "owner")}/${validRepositoryName(repo)}/issues?state=open&per_page=10`,
    signal
  );
}
