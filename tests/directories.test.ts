import assert from 'node:assert/strict'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  createProjectlessDirectory,
  directoryHasNoUserEntries,
  localDateName,
  removeUnusedProjectlessDirectory,
  sessionDirectoryName,
} from '../src/host/directories.ts'
import { isIgnorableDirectoryEntry } from '../src/shared/paths.ts'

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

test('removes an unused empty projectless directory and its empty date parent', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'dsh-projectless-session-'))
  try {
    const created = await createProjectlessDirectory(
      temporaryRoot,
      new Date(2026, 7, 18, 3, 4, 5),
      'a1b2c3d4',
    )
    assert.equal(await directoryHasNoUserEntries(created), true)
    assert.equal(await removeUnusedProjectlessDirectory(temporaryRoot, created), 'removed')
    await assert.rejects(stat(created), { code: 'ENOENT' })
    await assert.rejects(stat(join(temporaryRoot, '2026-08-18')), { code: 'ENOENT' })
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

test('isIgnorableDirectoryEntry only matches OS metadata, not user hidden files', () => {
  assert.equal(isIgnorableDirectoryEntry('.DS_Store'), true)
  assert.equal(isIgnorableDirectoryEntry('._icon'), true)
  assert.equal(isIgnorableDirectoryEntry('Thumbs.db'), true)
  assert.equal(isIgnorableDirectoryEntry('.gitignore'), false)
  assert.equal(isIgnorableDirectoryEntry('notes.txt'), false)
})

test('removes a directory that only contains .DS_Store', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'dsh-projectless-session-'))
  try {
    const created = await createProjectlessDirectory(
      temporaryRoot,
      new Date(2026, 7, 18, 3, 4, 5),
      'a1b2c3d4',
    )
    await writeFile(join(created, '.DS_Store'), '')
    await writeFile(join(temporaryRoot, '2026-08-18', '.DS_Store'), '')
    assert.equal(await directoryHasNoUserEntries(created), true)
    assert.equal(await removeUnusedProjectlessDirectory(temporaryRoot, created), 'removed')
    await assert.rejects(stat(created), { code: 'ENOENT' })
    await assert.rejects(stat(join(temporaryRoot, '2026-08-18')), { code: 'ENOENT' })
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

test('retains a directory that contains user files', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'dsh-projectless-session-'))
  try {
    const withNotes = await createProjectlessDirectory(
      temporaryRoot,
      new Date(2026, 7, 18, 3, 4, 5),
      'a1b2c3d4',
    )
    await writeFile(join(withNotes, '.DS_Store'), '')
    await writeFile(join(withNotes, 'notes.txt'), 'keep me')
    assert.equal(await directoryHasNoUserEntries(withNotes), false)
    assert.equal(await removeUnusedProjectlessDirectory(temporaryRoot, withNotes), 'retained')
    assert.equal((await stat(withNotes)).isDirectory(), true)
    assert.equal((await stat(join(withNotes, 'notes.txt'))).isFile(), true)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

test('does not remove a date parent that still has another session directory', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'dsh-projectless-session-'))
  try {
    const first = await createProjectlessDirectory(
      temporaryRoot,
      new Date(2026, 7, 18, 3, 4, 5),
      'a1b2c3d4',
    )
    const sibling = await createProjectlessDirectory(
      temporaryRoot,
      new Date(2026, 7, 18, 3, 4, 6),
      'ffffffff',
    )
    assert.equal(await directoryHasNoUserEntries(first), true)
    assert.equal(await removeUnusedProjectlessDirectory(temporaryRoot, first), 'removed')
    await assert.rejects(stat(first), { code: 'ENOENT' })
    assert.equal((await stat(sibling)).isDirectory(), true)
    assert.equal((await stat(join(temporaryRoot, '2026-08-18'))).isDirectory(), true)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

test('rejects unmanaged paths and reports an already-missing session directory', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'dsh-projectless-session-'))
  try {
    await assert.rejects(
      removeUnusedProjectlessDirectory(temporaryRoot, join(temporaryRoot, 'not-a-session')),
      /not a projectless session directory/,
    )
    await assert.rejects(
      removeUnusedProjectlessDirectory(temporaryRoot, 'relative/session'),
      /absolute path/,
    )
    assert.equal(
      await removeUnusedProjectlessDirectory(
        temporaryRoot,
        join(temporaryRoot, '2026-08-18', 'session-03-04-05-deadbeef'),
      ),
      'absent',
    )
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})
