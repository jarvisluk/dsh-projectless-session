import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { createProjectlessDirectory } from './host/directories.ts'

/** Host half: provides one loopback-only RPC for filesystem provisioning. */
export const name = 'dsh-projectless-session'
export const inject = ['connection']

export interface Config {
  /** Absolute parent for date folders; defaults to ~/Documents/DSH. */
  root?: string
}

/** Register the least-privilege one-operation channel used by the browser half. */
export function apply(ctx: Context, config: Config = {}): void {
  const root = config.root ?? join(homedir(), 'Documents', 'DSH')
  ctx.connection.rpc.handle('/projectless-session', async (endpoint) => {
    if (endpoint !== 'create-directory') {
      return {
        ok: false,
        error: {
          code: 'bad-request',
          message: `unknown projectless-session endpoint ${JSON.stringify(endpoint)}`,
          details: { issues: [] },
        },
      }
    }
    try {
      return { ok: true, value: { path: await createProjectlessDirectory(root) } }
    } catch (reason) {
      return {
        ok: false,
        error: {
          code: 'internal',
          message: reason instanceof Error ? reason.message : String(reason),
          details: {},
        },
      }
    }
  }, { authority: 'loopback' })
}
