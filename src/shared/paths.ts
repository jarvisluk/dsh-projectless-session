export const DATE_DIRECTORY = /^\d{4}-\d{2}-\d{2}$/
export const SESSION_DIRECTORY = /^session-\d{2}-\d{2}-\d{2}-[0-9a-f]{8}$/

const IGNORABLE_DIRECTORY_ENTRIES = new Set([
  '.DS_Store',
  '.localized',
  'Thumbs.db',
  'desktop.ini',
])

/** Finder/Explorer metadata that must not keep an otherwise empty scratch directory. */
export function isIgnorableDirectoryEntry(name: string): boolean {
  return IGNORABLE_DIRECTORY_ENTRIES.has(name) || name.startsWith('._')
}

/** Normalize separators so Host and browser path checks agree. */
export function normalizeFsPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function relativeParts(target: string, root: string): string[] | undefined {
  const path = normalizeFsPath(target)
  const base = normalizeFsPath(root)
  if (base === '' || path === base || !path.startsWith(`${base}/`)) return undefined
  return path.slice(base.length + 1).split('/')
}

/** True for ROOT/YYYY-MM-DD. */
export function isManagedDateDirectoryPath(target: string, root: string): boolean {
  const parts = relativeParts(target, root)
  return parts !== undefined && parts.length === 1 && DATE_DIRECTORY.test(parts[0] ?? '')
}

/** True for ROOT/YYYY-MM-DD/session-HH-mm-ss-hex. */
export function isManagedSessionPath(target: string, root: string): boolean {
  const parts = relativeParts(target, root)
  return parts !== undefined
    && parts.length === 2
    && DATE_DIRECTORY.test(parts[0] ?? '')
    && SESSION_DIRECTORY.test(parts[1] ?? '')
}

/**
 * Recognize a plugin-provisioned scratch directory by the two-level
 * `YYYY-MM-DD/session-HH-mm-ss-random` shape. Used as a cross-reload
 * fallback when the in-memory registry was never populated.
 */
export function isProjectlessPath(path: string): boolean {
  const segments = normalizeFsPath(path).split('/').filter(segment => segment.length > 0)
  const dateName = segments.at(-2)
  const sessionName = segments.at(-1)
  return dateName !== undefined
    && sessionName !== undefined
    && DATE_DIRECTORY.test(dateName)
    && SESSION_DIRECTORY.test(sessionName)
}
