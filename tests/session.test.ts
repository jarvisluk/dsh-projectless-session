import assert from 'node:assert/strict'
import test from 'node:test'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import {
  createAndOpenProjectlessSession,
  createProjectlessSessionId,
  selectProjectlessBlankSession,
  type ProjectlessSessionHost,
} from '../src/client/session.ts'

test('creates a cwd-backed Session directly without any Workspace operation', async () => {
  const operations: string[] = []
  const sessionId = createProjectlessSessionId('00000000-0000-4000-8000-000000000001')

  const sessions: ProjectlessSessionHost = {
    async create(input) {
      assert.deepEqual(input, {
        cwd: '/Users/test/Documents/DSH/2026-08-18/session-test',
        sessionId,
      })
      operations.push('session:create-with-cwd')
      return input.sessionId
    },
    open(id: SessionId) {
      assert.equal(id, sessionId)
      operations.push('session:open')
    },
  }

  const result = await createAndOpenProjectlessSession(
    sessions,
    async () => '/Users/test/Documents/DSH/2026-08-18/session-test',
    () => sessionId,
  )
  assert.equal(result, sessionId)
  assert.deepEqual(operations, ['session:create-with-cwd', 'session:open'])
})

test('takes over only a blank projectless Session composer', () => {
  const projectlessId = createProjectlessSessionId('00000000-0000-4000-8000-000000000002')
  assert.deepEqual(
    selectProjectlessBlankSession({ sessionId: projectlessId, blank: true }),
    { sessionId: projectlessId },
  )
  assert.equal(selectProjectlessBlankSession({ sessionId: projectlessId, blank: false }), null)
  assert.equal(selectProjectlessBlankSession({ sessionId: 'session-normal' as SessionId, blank: true }), null)
  assert.equal(selectProjectlessBlankSession(undefined), null)
})
