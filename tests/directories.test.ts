import assert from 'node:assert/strict'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  createProjectlessDirectory,
  localDateName,
  sessionDirectoryName,
} from '../src/host/directories.ts'

test('formats local date and sortable session directory names', () => {
  const now = new Date(2026, 7, 18, 3, 4, 5)
  assert.equal(localDateName(now), '2026-08-18')
  assert.equal(sessionDirectoryName(now, 'a1b2c3d4'), 'session-03-04-05-a1b2c3d4')
})

test('creates the requested date/session hierarchy on the Host', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'dsh-projectless-session-'))
  try {
    const result = await createProjectlessDirectory(
      temporaryRoot,
      new Date(2026, 7, 18, 3, 4, 5),
      'a1b2c3d4',
    )
    assert.equal(result, join(temporaryRoot, '2026-08-18', 'session-03-04-05-a1b2c3d4'))
    assert.equal((await stat(result)).isDirectory(), true)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

test('rejects a relative configured root', async () => {
  await assert.rejects(
    createProjectlessDirectory('Documents/DSH', new Date(2026, 7, 18), '01020304'),
    /absolute path/,
  )
})
