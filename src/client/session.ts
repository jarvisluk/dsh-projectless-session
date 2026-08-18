import type { ConversationSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'

export const PROJECTLESS_SESSION_PREFIX = 'session-projectless-'

/** Public DSH Session face used to create a cwd-backed Session directly. */
export interface ProjectlessSessionHost {
  create(input: { cwd: string; sessionId: SessionId }): Promise<SessionId>
  open(sessionId: SessionId): void
}

export interface ProjectlessComposerMatch {
  sessionId: SessionId
}

/** Call the plugin Host half and validate its intentionally tiny response. */
export async function requestProjectlessDirectory(rpc: ClientConnectionRpc): Promise<string> {
  const result = await rpc.call('/projectless-session', 'create-directory', {})
  if (!result.ok) throw new Error(result.error.message)
  const value = result.value
  if (typeof value !== 'object' || value === null || typeof (value as { path?: unknown }).path !== 'string') {
    throw new Error('projectless session Host returned an invalid directory response')
  }
  return (value as { path: string }).path
}

/** Allocate an identifiable id so the composer selector stays pure and restart-safe. */
export function createProjectlessSessionId(uuid: string = crypto.randomUUID()): SessionId {
  return `${PROJECTLESS_SESSION_PREFIX}${uuid}` as SessionId
}

/**
 * Create and open a real DSH Session with an explicit cwd. No Workspace is
 * registered, connected, mutated, or deleted anywhere in this path.
 */
export async function createAndOpenProjectlessSession(
  sessions: ProjectlessSessionHost,
  provisionDirectory: () => Promise<string>,
  allocateId: () => SessionId = createProjectlessSessionId,
): Promise<SessionId> {
  const cwd = await provisionDirectory()
  const requestedId = allocateId()
  const sessionId = await sessions.create({ cwd, sessionId: requestedId })
  sessions.open(sessionId)
  return sessionId
}

/** Pure conversation.composer selector: take over only the first blank prompt. */
export function selectProjectlessBlankSession(
  session: Pick<ConversationSnapshot, 'sessionId' | 'blank'> | undefined,
): ProjectlessComposerMatch | null {
  if (session === undefined || !session.blank || !session.sessionId.startsWith(PROJECTLESS_SESSION_PREFIX)) {
    return null
  }
  return { sessionId: session.sessionId }
}
