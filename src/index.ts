import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import {
  createProjectlessDirectory,
  removeUnusedProjectlessDirectory,
  resolveProjectlessRoot,
} from './host/directories.ts'
import {
  PROJECTLESS_ENDPOINTS,
  PROJECTLESS_RPC_CHANNEL,
  projectlessEndpoint,
  type ProjectlessEndpoint,
} from './shared/rpc.ts'

/** Host half: provides authenticated DSH endpoints for filesystem provisioning. */
export const name = 'dsh-projectless-session'
export const inject = ['connection']

export interface Config {
  /** Absolute parent for date folders; defaults to ~/Documents/DSH. */
  root?: string
}

type RpcResult =
  | { ok: true, value: unknown }
  | { ok: false, error: { code: string, message: string, details: Record<string, unknown> } }

function pathPayload(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const path = (payload as { path?: unknown }).path
  return typeof path === 'string' ? path : undefined
}

function badRequest(message: string): RpcResult {
  return {
    ok: false,
    error: {
      code: 'bad-request',
      message,
      details: { issues: [] },
    },
  }
}

function internalError(message: string): RpcResult {
  return {
    ok: false,
    error: {
      code: 'internal',
      message,
      details: {},
    },
  }
}

/** Run one decoded endpoint against the configured root. */
export async function dispatchProjectlessEndpoint(
  root: string,
  endpoint: ProjectlessEndpoint,
  payload: unknown,
): Promise<RpcResult> {
  try {
    if (endpoint === 'create-directory') {
      return { ok: true, value: { path: await createProjectlessDirectory(root) } }
    }
    if (endpoint === 'get-root') {
      return { ok: true, value: { root: await resolveProjectlessRoot(root) } }
    }
    const path = pathPayload(payload)
    if (path === undefined) return badRequest('remove-directory requires { path }')
    return { ok: true, value: { result: await removeUnusedProjectlessDirectory(root, path) } }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason)
    if (message.includes('absolute path') || message.includes('not a projectless')) {
      return badRequest(message)
    }
    return internalError(message)
  }
}

function envelope(rpcId: string, result: RpcResult): Response {
  return Response.json({ type: 'server-response', rpcId, result })
}

/**
 * Decode Connection's `client-request` envelope for one exact endpoint and
 * answer with its `server-response` envelope, so the browser half keeps using
 * `ctx.connection.rpc.call`.
 */
export function createProjectlessFetch(root: string, endpoint: ProjectlessEndpoint) {
  const method = projectlessEndpoint(endpoint)
  return async (request: Request): Promise<Response> => {
    if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
      return new Response('content type must be application/json', { status: 415 })
    }
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return new Response('body is not JSON', { status: 400 })
    }
    const message = body as { type?: unknown, rpcId?: unknown, method?: unknown, payload?: unknown } | null
    if (typeof message !== 'object' || message === null || message.type !== 'client-request' || typeof message.rpcId !== 'string') {
      return new Response('invalid client-request envelope', { status: 400 })
    }
    if (message.method !== method) {
      return envelope(message.rpcId, badRequest(`method ${JSON.stringify(message.method)} does not match endpoint ${JSON.stringify(method)}`))
    }
    return envelope(message.rpcId, await dispatchProjectlessEndpoint(root, endpoint, message.payload))
  }
}

/** Register the least-privilege endpoints used by the browser half. */
export function apply(ctx: Context, config: Config = {}): void {
  const root = config.root ?? join(homedir(), 'Documents', 'DSH')
  for (const endpoint of PROJECTLESS_ENDPOINTS) {
    const path = `${PROJECTLESS_RPC_CHANNEL}/${projectlessEndpoint(endpoint)}`
    ctx.effect(() => ctx.connection.fetch.register({
      path,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: createProjectlessFetch(root, endpoint),
    }), `dsh-projectless-session: ${path}`)
  }
}
