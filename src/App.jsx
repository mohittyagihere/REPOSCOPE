import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Activity, BookOpen, Compass, Dna, GitCompare, Github, LayoutDashboard,
  Moon, Network, Settings, Sun, Users
} from "lucide-react";
import {
  Architecture, Dashboard, Explore, RepositoryWorkspace, SavedProfiles, SettingsPage
} from "./pages";

const DeveloperDNA = lazy(() => import("./intelligence/pages").then(module => ({ default: module.DeveloperDNA })));
const BehaviourAnalysis = lazy(() => import("./intelligence/pages").then(module => ({ default: module.BehaviourAnalysis })));
const ProfileComparison = lazy(() => import("./intelligence/pages").then(module => ({ default: module.ProfileComparison })));

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/explore", label: "Explore", icon: Compass },
  { path: "/saved", label: "Saved Profiles", icon: Users },
  { path: "/architecture", label: "System Architecture", icon: Network },
  { path: "/settings", label: "Settings", icon: Settings }
];
const INTELLIGENCE_ITEMS = [
  { path: "/intelligence/dna", page: "dna", label: "Developer DNA", icon: Dna },
  { path: "/intelligence/behaviour", page: "behaviour", label: "Behaviour Analysis", icon: Activity },
  { path: "/intelligence/compare", page: "comparison", label: "Profile Comparison", icon: GitCompare }
];

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readRoute() {
  const url = new URL(window.location.href);
  const segments = url.pathname.split("/").filter(Boolean).map(segment => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
  if (segments[0] === "repo" && segments.length >= 3) {
    return { page: "repository", owner: segments[1], repo: segments[2], query: url.searchParams };
  }
  if (segments[0] === "intelligence" && segments[1] === "dna") return { page: "dna", username: segments[2] || "" };
  if (segments[0] === "intelligence" && segments[1] === "behaviour") return { page: "behaviour", username: segments[2] || "" };
  if (segments[0] === "intelligence" && segments[1] === "compare") {
    return { page: "comparison", firstUsername: segments[2] || "", secondUsername: segments[3] || "" };
  }
  if (segments[0] === "profile" && segments[1]) return { page: "profile", username: segments[1] };
  const page = segments[0] || "dashboard";
  if (["explore", "saved", "architecture", "settings"].includes(page)) return { page };
  return { page: "dashboard" };
}

function App() {
  const [location, setLocation] = useState(() => window.location.pathname + window.location.search);
  const [theme, setTheme] = useState(() => readStorage("reposcope-theme", "dark") === "light" ? "light" : "dark");
  const [savedProfiles, setSavedProfiles] = useState(() => {
    const value = readStorage("reposcope-saved", []);
    return Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
  });
  const route = useMemo(() => readRoute(), [location]);

  useEffect(() => {
    const handlePopState = () => setLocation(window.location.pathname + window.location.search);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("reposcope-theme", JSON.stringify(theme));
    } catch {
      // The selected theme remains usable for this session when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem("reposcope-saved", JSON.stringify(savedProfiles));
    } catch {
      // Saved profiles remain available until the page is closed.
    }
  }, [savedProfiles]);

  function navigate(path) {
    if (path === window.location.pathname + window.location.search) return;
    window.history.pushState({}, "", path);
    setLocation(path);
    window.scrollTo(0, 0);
  }

  function toggleSaved(username) {
    setSavedProfiles(current => current.includes(username)
      ? current.filter(item => item !== username)
      : [...current, username]);
  }

  let page;
  if (route.page === "repository") {
    page = <RepositoryWorkspace route={route} navigate={navigate}/>;
  } else if (route.page === "dna") {
    page = <DeveloperDNA key={route.username} username={route.username} navigate={navigate}/>;
  } else if (route.page === "behaviour") {
    page = <BehaviourAnalysis key={route.username} username={route.username} navigate={navigate}/>;
  } else if (route.page === "comparison") {
    page = <ProfileComparison key={`${route.firstUsername}/${route.secondUsername}`} firstUsername={route.firstUsername} secondUsername={route.secondUsername} navigate={navigate}/>;
  } else if (route.page === "explore") {
    page = <Explore navigate={navigate}/>;
  } else if (route.page === "saved") {
    page = <SavedProfiles profiles={savedProfiles} onToggle={toggleSaved} navigate={navigate}/>;
  } else if (route.page === "architecture") {
    page = <Architecture/>;
  } else if (route.page === "settings") {
    page = <SettingsPage theme={theme} setTheme={setTheme} savedProfiles={savedProfiles} onClearSaved={() => setSavedProfiles([])}/>;
  } else {
    page = <Dashboard
      key={route.username || "dashboard"}
      initialUsername={route.username}
      savedProfiles={savedProfiles}
      onToggleSaved={toggleSaved}
      navigate={navigate}
    />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" onClick={event => { event.preventDefault(); navigate("/"); }}>
          <span className="brand-mark"><Github size={18}/></span>
          <span>RepoScope<small>GITHUB EXPLORER</small></span>
        </a>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = route.page === (path === "/" ? "dashboard" : path.slice(1)) || (path === "/" && route.page === "profile");
            return (
              <a
                key={path}
                href={path}
                className={active ? "nav-link active" : "nav-link"}
                aria-current={active ? "page" : undefined}
                onClick={event => { event.preventDefault(); navigate(path); }}
              >
                <Icon size={16}/><span>{label}</span>
              </a>
            );
          })}
        </nav>
        <div className="nav-caption intelligence-nav-caption">DEVELOPER INTELLIGENCE</div>
        <nav className="primary-nav intelligence-nav" aria-label="Developer intelligence">
          {INTELLIGENCE_ITEMS.map(({ path, page: pageName, label, icon: Icon }) => {
            const active = route.page === pageName;
            return <a key={path} href={path} className={active ? "nav-link active" : "nav-link"} aria-current={active ? "page" : undefined} onClick={event => { event.preventDefault(); navigate(path); }}>
              <Icon size={16}/><span>{label}</span>
            </a>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="api-indicator"><i/> GitHub public API</div>
          <a className="help-link" href="/architecture" onClick={event => { event.preventDefault(); navigate("/architecture"); }}>
            <BookOpen size={15}/> How RepoScope works
          </a>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumbs"><span>RepoScope</span><span className="breadcrumb-divider">/</span><b>{route.page === "repository" ? `${route.owner}/${route.repo}` : route.page === "dna" ? "Developer DNA" : route.page === "behaviour" ? "Behaviour Analysis" : route.page === "comparison" ? "Profile Comparison" : NAV_ITEMS.find(item => item.path === (route.page === "dashboard" || route.page === "profile" ? "/" : `/${route.page}`))?.label || "Dashboard"}</b></div>
          <div className="topbar-actions">
            {route.page === "repository" && <a className="topbar-link" href={`/profile/${encodeURIComponent(route.owner)}`} onClick={event => { event.preventDefault(); navigate(`/profile/${encodeURIComponent(route.owner)}`); }}><Users size={15}/> Owner profile</a>}
            <button className="theme-toggle" onClick={() => setTheme(current => current === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
              {theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}<span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
          </div>
        </header>
        <main className="page-content"><Suspense fallback={<div className="state-panel">Loading Developer Intelligence...</div>}>{page}</Suspense></main>
        <footer className="site-footer">
          <span>BUILT FOR THE CURIOUS DEVELOPER.</span>
          <span>REPOSCOPE © 2026</span>
          <span>DESIGNED BY <a href="https://github.com/mohittyagihere" target="_blank" rel="noreferrer">MOHIT TYAGI</a></span>
        </footer>
      </div>
    </div>
  );
}

export default App;
