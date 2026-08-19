import { randomBytes } from 'node:crypto'
import { lstat, mkdir, readdir, realpath, rmdir, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import {
  isIgnorableDirectoryEntry,
  isManagedDateDirectoryPath,
  isManagedSessionPath,
} from '../shared/paths.ts'

/** Use the Host's local calendar fields because it owns the target filesystem. */
export function localDateName(now: Date): string {
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Human-sortable prefix plus entropy, avoiding predictable or colliding session directories. */
export function sessionDirectoryName(now: Date, suffix: string): string {
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')
  return `session-${hour}-${minute}-${second}-${suffix}`
}

function randomSuffix(): string {
  return randomBytes(4).toString('hex')
}

/** Create ROOT/YYYY-MM-DD/session-HH-mm-ss-random and return its absolute path. */
export async function createProjectlessDirectory(
  root: string,
  now: Date = new Date(),
  suffix: string = randomSuffix(),
): Promise<string> {
  if (!isAbsolute(root)) throw new Error('projectless session root must be an absolute path')
  const dateDirectory = join(root, localDateName(now))
  await mkdir(dateDirectory, { recursive: true, mode: 0o700 })
  const sessionDirectory = join(dateDirectory, sessionDirectoryName(now, suffix))
  await mkdir(sessionDirectory, { mode: 0o700 })
  return sessionDirectory
}

function isErrno(reason: unknown, code: string): boolean {
  return typeof reason === 'object' && reason !== null && 'code' in reason
    && (reason as { code: unknown }).code === code
}

/** Prefer the Host-resolved root so Workspace realpaths still match. */
export async function resolveProjectlessRoot(root: string): Promise<string> {
  if (!isAbsolute(root)) throw new Error('projectless session root must be an absolute path')
  try {
    return await realpath(root)
  } catch (reason) {
    if (isErrno(reason, 'ENOENT')) return root
    throw reason
  }
}

function isOwnedSessionPath(target: string, root: string, resolvedRoot: string): boolean {
  return isManagedSessionPath(target, root) || isManagedSessionPath(target, resolvedRoot)
}

function isOwnedDatePath(target: string, root: string, resolvedRoot: string): boolean {
  return isManagedDateDirectoryPath(target, root) || isManagedDateDirectoryPath(target, resolvedRoot)
}

export type UnusedDirectoryRemoval = 'removed' | 'absent' | 'retained'

/** True when the directory exists and has no user files. `.DS_Store` and similar OS junk are ignored. */
export async function directoryHasNoUserEntries(path: string): Promise<boolean> {
  try {
    const entries = await readdir(path)
    return entries.every(isIgnorableDirectoryEntry)
  } catch (reason) {
    if (isErrno(reason, 'ENOENT')) return false
    throw reason
  }
}

async function unlinkIgnorableFiles(directory: string, names: string[]): Promise<boolean> {
  for (const name of names) {
    const target = join(directory, name)
    try {
      const info = await lstat(target)
      if (!info.isFile()) return false
      await unlink(target)
    } catch (reason) {
      if (isErrno(reason, 'ENOENT')) continue
      return false
    }
  }
  return true
}

async function removeEmptyDirectory(path: string): Promise<UnusedDirectoryRemoval> {
  let entries: string[]
  try {
    entries = await readdir(path)
  } catch (reason) {
    if (isErrno(reason, 'ENOENT')) return 'absent'
    throw reason
  }
  const junk = entries.filter(isIgnorableDirectoryEntry)
  if (junk.length !== entries.length) return 'retained'
  if (junk.length > 0 && !await unlinkIgnorableFiles(path, junk)) return 'retained'
  try {
    await rmdir(path)
    return 'removed'
  } catch (reason) {
    if (isErrno(reason, 'ENOENT')) return 'absent'
    if (isErrno(reason, 'ENOTEMPTY') || isErrno(reason, 'EEXIST')) return 'retained'
    throw reason
  }
}

/**
 * Remove an unused projectless session directory only after confirming it has
 * no user files. OS metadata such as `.DS_Store` is stripped first; any other
 * content keeps the directory.
 */
export async function removeUnusedProjectlessDirectory(
  root: string,
  requestedPath: string,
): Promise<UnusedDirectoryRemoval> {
  if (!isAbsolute(root) || !isAbsolute(requestedPath)) {
    throw new Error('projectless session path must be an absolute path')
  }
  const resolvedRoot = await resolveProjectlessRoot(root)
  if (!isOwnedSessionPath(requestedPath, root, resolvedRoot)) {
    throw new Error('path is not a projectless session directory')
  }

  let canonical: string
  try {
    canonical = await realpath(requestedPath)
  } catch (reason) {
    if (isErrno(reason, 'ENOENT')) return 'absent'
    throw reason
  }
  if (!isOwnedSessionPath(canonical, root, resolvedRoot)) {
    throw new Error('path is not a projectless session directory')
  }

  const result = await removeEmptyDirectory(canonical)
  if (result !== 'removed') return result

  const parent = dirname(canonical)
  if (isOwnedDatePath(parent, root, resolvedRoot)) {
    await removeEmptyDirectory(parent)
  }
  return 'removed'
}
