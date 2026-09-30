import assert from 'node:assert/strict'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { apply, createProjectlessFetch } from '../src/index.ts'

function clientRequest(method: string, payload: unknown, rpcId = 'rpc-1'): Request {
  return new Request('http://dsh.internal/api/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
  })
}

test('answers the Connection client-request envelope with a server-response', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-projectless-host-'))
  try {
    const response = await createProjectlessFetch(root, 'create-directory')(
      clientRequest('projectless-session/create-directory', {}, 'rpc-create'),
    )
    const body = await response.json() as { type: string, rpcId: string, result: { ok: boolean, value: { path: string } } }
    assert.equal(body.type, 'server-response')
    assert.equal(body.rpcId, 'rpc-create')
    assert.equal(body.result.ok, true)
    assert.equal(body.result.value.path.startsWith(root), true)
    assert.equal((await stat(body.result.value.path)).isDirectory(), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects a mismatched method and a missing remove-directory path', async () => {
  const root = '/tmp/dsh-projectless-host-unused'
  const mismatched = await (await createProjectlessFetch(root, 'get-root')(
    clientRequest('projectless-session/create-directory', {}),
  )).json() as { result: { ok: boolean, error: { code: string } } }
  assert.equal(mismatched.result.ok, false)
  assert.equal(mismatched.result.error.code, 'bad-request')

  const missing = await (await createProjectlessFetch(root, 'remove-directory')(
    clientRequest('projectless-session/remove-directory', {}),
  )).json() as { result: { ok: boolean, error: { message: string } } }
  assert.equal(missing.result.ok, false)
  assert.match(missing.result.error.message, /requires \{ path \}/)

  const wrongType = await createProjectlessFetch(root, 'get-root')(new Request('http://dsh.internal/api/x', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: '{}',
  }))
  assert.equal(wrongType.status, 415)
})

test('registers one exact /api Fetch route per endpoint', () => {
  const routes: { path: string, methods: readonly string[] }[] = []
  const ctx = {
    effect(execute: () => unknown) { execute() },
    connection: {
      fetch: {
        register(route: { path: string, methods: readonly string[] }) {
          routes.push(route)
          return async () => {}
        },
      },
    },
  }
  apply(ctx as never, { root: '/tmp/dsh-projectless-host-unused' })
  assert.deepEqual(routes.map(route => route.path), [
    '/api/projectless-session/create-directory',
    '/api/projectless-session/get-root',
    '/api/projectless-session/remove-directory',
  ])
  assert.deepEqual(routes.map(route => route.methods), [['POST'], ['POST'], ['POST']])
})
