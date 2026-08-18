import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

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
