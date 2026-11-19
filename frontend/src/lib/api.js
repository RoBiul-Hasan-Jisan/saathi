// One place that talks to the backend. Paths start with /api; Next.js forwards them to the backend.

export class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
  // true when the server could not be reached at all (device offline, backend stopped)
  get unreachable() {
    return this.status === 0 || this.data?.unreachable === true;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check the internet connection.", { unreachable: true });
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }

  if (!res.ok) {
    // The Next.js proxy answers 500/502/503/504 with a non-JSON page when the backend is down.
    if (data === null && res.status >= 500) {
      throw new ApiError(res.status, "The server is not reachable right now. Is the backend running?", { unreachable: true });
    }
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
      window.dispatchEvent(new Event("saathi:unauthorized"));
    }
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data);
  }
  return data;
}

export const get = (p) => api(p);
export const post = (p, body = {}) => api(p, { method: "POST", body });
export const patch = (p, body = {}) => api(p, { method: "PATCH", body });
export const del = (p, body = {}) => api(p, { method: "DELETE", body });
