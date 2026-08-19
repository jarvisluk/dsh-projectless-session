import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import {
  createProjectlessDirectory,
  removeUnusedProjectlessDirectory,
  resolveProjectlessRoot,
} from './host/directories.ts'

/** Host half: provides loopback-only RPCs for filesystem provisioning. */
export const name = 'dsh-projectless-session'
export const inject = ['connection']

export interface Config {
  /** Absolute parent for date folders; defaults to ~/Documents/DSH. */
  root?: string
}

function pathPayload(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const path = (payload as { path?: unknown }).path
  return typeof path === 'string' ? path : undefined
}

function badRequest(message: string) {
  return {
    ok: false as const,
    error: {
      code: 'bad-request' as const,
      message,
      details: { issues: [] },
    },
  }
}

function internalError(message: string) {
  return {
    ok: false as const,
    error: {
      code: 'internal' as const,
      message,
      details: {},
    },
  }
}

/** Register the least-privilege channel used by the browser half. */
export function apply(ctx: Context, config: Config = {}): void {
  const root = config.root ?? join(homedir(), 'Documents', 'DSH')
  ctx.connection.rpc.handle('/projectless-session', async (endpoint, payload) => {
    try {
      if (endpoint === 'create-directory') {
        return { ok: true, value: { path: await createProjectlessDirectory(root) } }
      }
      if (endpoint === 'get-root') {
        return { ok: true, value: { root: await resolveProjectlessRoot(root) } }
      }
      if (endpoint === 'remove-directory') {
        const path = pathPayload(payload)
        if (path === undefined) return badRequest('remove-directory requires { path }')
        return { ok: true, value: { result: await removeUnusedProjectlessDirectory(root, path) } }
      }
      return badRequest(`unknown projectless-session endpoint ${JSON.stringify(endpoint)}`)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      if (message.includes('absolute path') || message.includes('not a projectless')) {
        return badRequest(message)
      }
      return internalError(message)
    }
  }, { authority: 'loopback' })
}
