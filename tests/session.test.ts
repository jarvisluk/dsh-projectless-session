import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  SessionId,
  WorkspaceId,
  WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  PROJECTLESS_ENTRY_ID,
  createAbandonClaim,
  createAndOpenProjectlessSession,
  createProjectlessRegistry,
  detachWorkspaceAfterFirstPrompt,
  findAbandonedProjectlessWorkspaces,
  isProjectlessPath,
  resolvePickerSelection,
  sweepAbandonedProjectlessWorkspaces,
  watchTemporaryWorkspace,
  type ProjectlessSessionHost,
} from '../src/client/session.ts'

test('keeps the blank Session usable, then detaches after the first accepted prompt', async () => {
  const operations: string[] = []
  const workspaceId = 'workspace-1' as WorkspaceId
  const sessionId = 'session-1' as SessionId
  let sessionRetained = false

  const workspaces: ProjectlessSessionHost = {
    async create({ path }): Promise<WorkspaceView> {
      operations.push(`workspace:create:${path}`)
      return {
        workspaceId,
        path,
        title: 'temporary',
        sessionIds: [],
        createdAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:00.000Z',
      }
    },
    async connectWorkspace(id) {
      assert.equal(id, workspaceId)
      sessionRetained = true
      operations.push('session:create')
      return sessionId
    },
    async delete(id) {
      assert.equal(id, workspaceId)
      operations.push('workspace:delete-registration')
      // Mirrors DSH's contract: Workspace deletion does not delete the Session.
      assert.equal(sessionRetained, true)
    },
    async archiveSession() {
      operations.push('session:archive')
    },
  }
  let blank = true
  const listeners = new Set<() => void>()
  const sessions = {
    open(id: SessionId) {
      assert.equal(id, sessionId)
      assert.equal(sessionRetained, true)
      operations.push('session:open')
    },
    list: {
      getSnapshot: () => ({ current: sessionId, byId: { [sessionId]: { blank } } }),
      subscribe(listener: () => void) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
  }

  const registry = createProjectlessRegistry()
  const receipt = await createAndOpenProjectlessSession(
    workspaces,
    sessions,
    async () => '/Users/test/Documents/DSH/2026-08-18/session-test',
    registry,
  )
  assert.equal(registry.has(workspaceId), true)
  assert.deepEqual(receipt, {
    sessionId,
    workspaceId,
    path: '/Users/test/Documents/DSH/2026-08-18/session-test',
  })
  assert.deepEqual(operations.slice(-3).map(item => item.split(':').slice(0, 2).join(':')), [
    'workspace:create',
    'session:create',
    'session:open',
  ])
  const dispose = detachWorkspaceAfterFirstPrompt(workspaces, sessions, receipt)
  assert.equal(operations.includes('workspace:delete-registration'), false)

  blank = false
  for (const listener of [...listeners]) listener()
  await Promise.resolve()
  assert.equal(operations.at(-1), 'workspace:delete-registration')
  assert.equal(listeners.size, 0)
  dispose()
})

test('rolls back a temporary Workspace when Session creation fails', async () => {
  const workspaceId = 'workspace-rollback' as WorkspaceId
  const deleted: WorkspaceId[] = []
  const failure = new Error('session creation failed')
  const workspaces: ProjectlessSessionHost = {
    async create({ path }): Promise<WorkspaceView> {
      return {
        workspaceId,
        path,
        title: 'temporary',
        sessionIds: [],
        createdAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:00.000Z',
      }
    },
    async connectWorkspace() {
      throw failure
    },
    async delete(id) {
      deleted.push(id)
    },
    async archiveSession() {},
  }
  const sessions = {
    open() {},
    list: {
      getSnapshot: () => ({ byId: {} }),
      subscribe: () => () => {},
    },
  }

  const removed: string[] = []
  await assert.rejects(
    createAndOpenProjectlessSession(
      workspaces,
      sessions,
      async () => '/tmp/session',
      undefined,
      async path => { removed.push(path) },
    ),
    failure,
  )
  assert.deepEqual(deleted, [workspaceId])
  assert.deepEqual(removed, ['/tmp/session'])
})

test('isProjectlessPath accepts only the Host two-level directory shape', () => {
  assert.equal(
    isProjectlessPath('/Users/me/Documents/DSH/2026-08-18/session-03-04-05-a1b2c3d4'),
    true,
  )
  assert.equal(
    isProjectlessPath('C:\\Users\\me\\Documents\\DSH\\2026-08-18\\session-03-04-05-a1b2c3d4\\'),
    true,
  )
  assert.equal(isProjectlessPath('/Users/me/codespace/Default Project'), false)
  assert.equal(isProjectlessPath('/Users/me/Documents/DSH/2026-08-18/notes'), false)
  assert.equal(isProjectlessPath('/Users/me/2026-08-18/session-03-04-05-notahex'), false)
  assert.equal(isProjectlessPath('/session-03-04-05-a1b2c3d4'), false)
})

test('resolvePickerSelection moves the check onto Session without workspace', () => {
  const project = { workspaceId: 'ws-default' as WorkspaceId }
  const scratch = { workspaceId: 'ws-scratch' as WorkspaceId }
  const result = resolvePickerSelection(
    [project, scratch],
    scratch.workspaceId,
    row => row.workspaceId === scratch.workspaceId,
  )
  assert.deepEqual(result.projects, [project])
  assert.equal(result.selectedId, PROJECTLESS_ENTRY_ID)
  assert.equal(result.projectlessActive, true)
})

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

function workspaceView(
  workspaceId: WorkspaceId,
  path: string,
  sessionIds: SessionId[] = [],
): WorkspaceView {
  return {
    workspaceId,
    path,
    title: 'temporary',
    sessionIds,
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
  }
}

test('watchTemporaryWorkspace detaches after the first accepted prompt without removing the directory', async () => {
  const workspaceId = 'workspace-used' as WorkspaceId
  const sessionId = 'session-used' as SessionId
  const operations: string[] = []
  const workspaces: Pick<ProjectlessSessionHost, 'delete' | 'archiveSession'> = {
    async delete(id) { operations.push(`workspace:delete:${id}`) },
    async archiveSession(id) { operations.push(`session:archive:${id}`) },
  }
  let blank = true
  const listeners = new Set<() => void>()
  const sessions = {
    open() {},
    list: {
      getSnapshot: () => ({ current: sessionId, byId: { [sessionId]: { blank } } }),
      subscribe(listener: () => void) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
  }
  const removed: string[] = []
  const dispose = watchTemporaryWorkspace(
    workspaces,
    sessions,
    { sessionId, workspaceId, path: '/Users/test/Documents/DSH/2026-08-18/session-03-04-05-a1b2c3d4' },
    async path => { removed.push(path) },
  )
  blank = false
  for (const listener of [...listeners]) listener()
  await Promise.resolve()
  assert.deepEqual(operations, [`workspace:delete:${workspaceId}`])
  assert.deepEqual(removed, [])
  dispose()
})

test('watchTemporaryWorkspace abandons a still-blank Session after the user leaves', async () => {
  const workspaceId = 'workspace-leave' as WorkspaceId
  const sessionId = 'session-leave' as SessionId
  const operations: string[] = []
  const workspaces: Pick<ProjectlessSessionHost, 'delete' | 'archiveSession'> = {
    async delete(id) {
      operations.push(`workspace:delete:${id}`)
    },
    async archiveSession(id) {
      operations.push(`session:archive:${id}`)
    },
  }
  let current: SessionId | undefined = sessionId
  const listeners = new Set<() => void>()
  const sessions = {
    open() {},
    list: {
      getSnapshot: () => ({ current, byId: { [sessionId]: { blank: true } } }),
      subscribe(listener: () => void) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
  }
  const removed: string[] = []
  const dispose = watchTemporaryWorkspace(
    workspaces,
    sessions,
    {
      sessionId,
      workspaceId,
      path: '/Users/test/Documents/DSH/2026-08-18/session-03-04-05-a1b2c3d4',
    },
    async path => { removed.push(path) },
  )
  assert.deepEqual(operations, [])

  current = 'session-other' as SessionId
  for (const listener of [...listeners]) listener()
  await flush()
  assert.deepEqual(operations, [
    `session:archive:${sessionId}`,
    `workspace:delete:${workspaceId}`,
  ])
  assert.deepEqual(removed, ['/Users/test/Documents/DSH/2026-08-18/session-03-04-05-a1b2c3d4'])
  assert.equal(listeners.size, 0)
  dispose()
})

test('watchTemporaryWorkspace abandons a still-blank Session when the watcher is disposed', async () => {
  const workspaceId = 'workspace-dispose' as WorkspaceId
  const sessionId = 'session-dispose' as SessionId
  const archived: SessionId[] = []
  const deleted: WorkspaceId[] = []
  const workspaces: Pick<ProjectlessSessionHost, 'delete' | 'archiveSession'> = {
    async delete(id) { deleted.push(id) },
    async archiveSession(id) { archived.push(id) },
  }
  const sessions = {
    open() {},
    list: {
      getSnapshot: () => ({ current: sessionId, byId: { [sessionId]: { blank: true } } }),
      subscribe: () => () => {},
    },
  }
  const removed: string[] = []
  const dispose = watchTemporaryWorkspace(
    workspaces,
    sessions,
    { sessionId, workspaceId, path: '/tmp/session-dir' },
    async path => { removed.push(path) },
  )
  dispose()
  await flush()
  assert.deepEqual(archived, [sessionId])
  assert.deepEqual(deleted, [workspaceId])
  assert.deepEqual(removed, ['/tmp/session-dir'])
})

test('watchTemporaryWorkspace does not abandon while the blank Session is current', async () => {
  const workspaceId = 'workspace-current' as WorkspaceId
  const sessionId = 'session-current' as SessionId
  let deleted = false
  const workspaces: Pick<ProjectlessSessionHost, 'delete' | 'archiveSession'> = {
    async delete() { deleted = true },
    async archiveSession() { deleted = true },
  }
  const sessions = {
    open() {},
    list: {
      getSnapshot: () => ({ current: sessionId, byId: { [sessionId]: { blank: true } } }),
      subscribe: () => () => {},
    },
  }
  const dispose = watchTemporaryWorkspace(
    workspaces,
    sessions,
    { sessionId, workspaceId, path: '/tmp/session-dir' },
    async () => { deleted = true },
  )
  await Promise.resolve()
  assert.equal(deleted, false)
  dispose()
})

test('findAbandonedProjectlessWorkspaces ignores a just-created Workspace with no sessions', () => {
  const root = '/Users/test/Documents/DSH'
  const found = findAbandonedProjectlessWorkspaces(
    [workspaceView('ws-empty' as WorkspaceId, `${root}/2026-08-18/session-03-04-05-a1b2c3d4`, [])],
    { byId: {} },
    root,
  )
  assert.deepEqual(found, [])
})

test('findAbandonedProjectlessWorkspaces skips the current Session and unmanaged paths', () => {
  const root = '/Users/test/Documents/DSH'
  const leftoverId = 'ws-leftover' as WorkspaceId
  const currentId = 'ws-current' as WorkspaceId
  const realId = 'ws-real' as WorkspaceId
  const leftoverSession = 's-leftover' as SessionId
  const currentSession = 's-current' as SessionId
  const usedSession = 's-used' as SessionId
  const found = findAbandonedProjectlessWorkspaces(
    [
      workspaceView(leftoverId, `${root}/2026-08-18/session-03-04-05-a1b2c3d4`, [leftoverSession]),
      workspaceView(currentId, `${root}/2026-08-18/session-03-04-06-aaaaaaaa`, [currentSession]),
      workspaceView(realId, '/Users/test/codespace/app', [usedSession]),
    ],
    {
      current: currentSession,
      byId: {
        [leftoverSession]: { blank: true },
        [currentSession]: { blank: true },
        [usedSession]: { blank: false },
      },
    },
    root,
  )
  assert.deepEqual(found.map(item => item.workspaceId), [leftoverId])
})

test('sweepAbandonedProjectlessWorkspaces removes leftover unused registrations', async () => {
  const root = '/Users/test/Documents/DSH'
  const leftoverId = 'ws-sweep' as WorkspaceId
  const leftoverSession = 's-sweep' as SessionId
  const leftoverPath = `${root}/2026-08-18/session-03-04-05-a1b2c3d4`
  const operations: string[] = []
  const items = [workspaceView(leftoverId, leftoverPath, [leftoverSession])]
  const workspaces = {
    list: {
      getSnapshot: () => ({ items, baselinesReady: true }),
      subscribe: () => () => {},
    },
    async delete(id: WorkspaceId) { operations.push(`delete:${id}`) },
    async archiveSession(id: SessionId) { operations.push(`archive:${id}`) },
  }
  const sessions = {
    open() {},
    list: {
      getSnapshot: () => ({ byId: { [leftoverSession]: { blank: true } } }),
      subscribe: () => () => {},
    },
  }
  const removed: string[] = []
  const stop = sweepAbandonedProjectlessWorkspaces(
    workspaces,
    sessions,
    root,
    async path => { removed.push(path) },
    new Set(),
    createAbandonClaim(),
  )
  await flush()
  assert.deepEqual(operations, [`archive:${leftoverSession}`, `delete:${leftoverId}`])
  assert.deepEqual(removed, [leftoverPath])
  stop()
})

test('resolvePickerSelection keeps a real project selected and hides leftover scratch rows', () => {
  const project = { workspaceId: 'ws-default' as WorkspaceId }
  const leftover = { workspaceId: 'ws-scratch' as WorkspaceId }
  const result = resolvePickerSelection(
    [project, leftover],
    project.workspaceId,
    row => row.workspaceId === leftover.workspaceId,
  )
  assert.deepEqual(result.projects, [project])
  assert.equal(result.selectedId, project.workspaceId)
  assert.equal(result.projectlessActive, false)
})
