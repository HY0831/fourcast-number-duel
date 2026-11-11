/**
 * Best-effort browser storage.
 *
 * Cookies/privacy settings, sandboxed frames and quota limits can deny access to
 * localStorage. Games must remain playable for the current visit even if progress
 * and multiplayer resume tokens cannot be persisted.
 *
 * Keep the same keys and values as native localStorage for backwards compatibility.
 */
export const safeLocalStorage = {
  getItem(key: string): string | null {
    try { return window.localStorage.getItem(key) } catch { return null }
  },
  setItem(key: string, value: string): void {
    try { window.localStorage.setItem(key, value) } catch { /* Storage is optional. */ }
  },
  removeItem(key: string): void {
    try { window.localStorage.removeItem(key) } catch { /* Storage is optional. */ }
  },
}
