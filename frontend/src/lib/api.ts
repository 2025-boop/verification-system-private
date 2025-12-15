/**
 * Constructs the full backend URL for a given API path.
 * Uses DJANGO_API_BASE from environment variables with fallback to localhost.
 *
 * @param path - API path (e.g., "/api/sessions/")
 * @returns Full URL to the Django backend
 */
export function getBackendUrl(path: string): string {
  const base = process.env.DJANGO_API_BASE?.replace(/\/$/, "") || "http://localhost:8000";
  return `${base}${path}`;
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  // 1) First attempt: call proxy route
  let res = await fetch(url, options);

  // 2) If unauthorized → try to refresh token
  if (res.status === 401) {
    const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });

    // 2A) Refresh failed → user must login again
    if (!refreshRes.ok) {
      return null; // or throw error
    }

    // 3) Retry the original request with new access token
    res = await fetch(url, options);
  }

  return res;
}
