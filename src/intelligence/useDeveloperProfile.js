import { useEffect, useState } from "react";
import { getProfile, getUserEvents } from "../api";

export function useDeveloperProfile(username) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (!username) {
      setData(null);
      setError("");
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setData(null);
    setError("");
    setLoading(true);

    Promise.allSettled([
      getProfile(username, controller.signal, refreshVersion > 0),
      getUserEvents(username, controller.signal, refreshVersion > 0)
    ]).then(([profileResult, eventsResult]) => {
      if (controller.signal.aborted) return;
      if (profileResult.status === "rejected") {
        setError(profileResult.reason.message || "Unable to load this GitHub profile.");
        return;
      }

      const eventsAvailable = eventsResult.status === "fulfilled" && Array.isArray(eventsResult.value);
      setData({
        ...profileResult.value,
        events: eventsAvailable ? eventsResult.value : [],
        eventsAvailable,
        eventsError: eventsAvailable ? "" : eventsResult.reason?.message || "Public activity data is unavailable."
      });
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [username, refreshVersion]);

  return {
    data,
    loading,
    error,
    refresh: () => setRefreshVersion(version => version + 1)
  };
}
