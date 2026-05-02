/**
 * Binary download helper. Used for Excel exports — fetches with credentials so
 * the httpOnly session cookie is attached, materialises the response into a
 * blob URL, triggers a synthetic <a download> click, then revokes the URL.
 *
 * Prefer this over a bare <a href> when:
 *   - the request needs the auth cookie (cross-origin attribute can be flaky)
 *   - we want to surface backend errors as a thrown exception
 *   - the filename should come from the server's Content-Disposition.
 */

import { API_BASE_URL } from './api'

export async function downloadBlob(path: string, filename?: string): Promise<void> {
  const base = API_BASE_URL.replace(/\/$/, '')
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`)
  }
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  const headerFilename = res.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1]
  a.download = filename ?? headerFilename ?? 'export.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Slight delay so Safari/Chrome can finish the navigation before we revoke.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 100)
}
