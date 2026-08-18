import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  SessionId,
  WorkspaceId,
  WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  createAndOpenProjectlessSession,
  detachWorkspaceAfterFirstPrompt,
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
      getSnapshot: () => ({ byId: { [sessionId]: { blank } } }),
      subscribe(listener: () => void) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
  }

  const receipt = await createAndOpenProjectlessSession(
    workspaces,
    sessions,
    async () => '/Users/test/Documents/DSH/2026-08-18/session-test',
  )
  assert.deepEqual(receipt, { sessionId, workspaceId })
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
  }
  const sessions = {
    open() {},
    list: {
      getSnapshot: () => ({ byId: {} }),
      subscribe: () => () => {},
    },
  }

  await assert.rejects(
    createAndOpenProjectlessSession(workspaces, sessions, async () => '/tmp/session'),
    failure,
  )
  assert.deepEqual(deleted, [workspaceId])
})
