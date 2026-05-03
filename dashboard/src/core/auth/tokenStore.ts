/**
 * Tiny localStorage wrapper for the dashboard JWT.
 *
 * We keep the token in localStorage rather than the httpOnly `session` cookie
 * the backend sets on /auth/login, because the dashboard and the API live on
 * separate Railway subdomains. Browsers treat *.up.railway.app entries as
 * different sites (PSL), so the cookie would be a third-party cookie — many
 * default browser configurations drop those even when SameSite=None+Secure.
 *
 * Trade-off: localStorage is XSS-vulnerable. Acceptable for a POC; production
 * deployments behind a single registrable domain should switch back to the
 * cookie path.
 */

const STORAGE_KEY = 'hr_session_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, token)
  } catch {
    // Storage disabled (private mode in some browsers) — silently no-op.
  }
}

export function clearToken(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
