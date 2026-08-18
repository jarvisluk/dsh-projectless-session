import type { SessionId, WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'

/** Public DSH faces required to turn a directory into an ungrouped Session. */
export interface ProjectlessSessionHost {
  create(input: { path: string }): Promise<WorkspaceView>
  connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId>
  delete(workspaceId: WorkspaceId): Promise<void>
}

export interface SessionNavigator {
  open(sessionId: SessionId): void
  list: {
    getSnapshot(): { byId: Partial<Record<SessionId, { blank: boolean }>> }
    subscribe(listener: () => void): () => void
  }
}

export interface ProjectlessSessionReceipt {
  sessionId: SessionId
  workspaceId: WorkspaceId
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

/**
 * Create and open a Session while retaining its temporary Workspace long
 * enough for DSH's native blank-session composer to accept the first prompt.
 */
export async function createAndOpenProjectlessSession(
  workspaces: ProjectlessSessionHost,
  sessions: SessionNavigator,
  provisionDirectory: () => Promise<string>,
): Promise<ProjectlessSessionReceipt> {
  const path = await provisionDirectory()
  const workspace = await workspaces.create({ path })
  try {
    const sessionId = await workspaces.connectWorkspace(workspace.workspaceId)
    sessions.open(sessionId)
    return { sessionId, workspaceId: workspace.workspaceId }
  } catch (reason) {
    // A failed Session creation must not leave a temporary Workspace behind.
    await workspaces.delete(workspace.workspaceId).catch(() => {})
    throw reason
  }
}

/**
 * Remove only the Workspace registration once DSH reports the first prompt
 * accepted (`blank === false`). The live/cold Session, cwd, log, and directory
 * remain authoritative under DSH's Workspace deletion contract.
 */
export function detachWorkspaceAfterFirstPrompt(
  workspaces: Pick<ProjectlessSessionHost, 'delete'>,
  sessions: SessionNavigator,
  receipt: ProjectlessSessionReceipt,
  onError: (reason: unknown) => void = console.error,
): () => void {
  let active = true
  let unsubscribe = (): void => {}
  const reconcile = (): void => {
    if (!active || sessions.list.getSnapshot().byId[receipt.sessionId]?.blank !== false) return
    active = false
    unsubscribe()
    void workspaces.delete(receipt.workspaceId).catch(onError)
  }
  unsubscribe = sessions.list.subscribe(reconcile)
  reconcile()
  return () => {
    active = false
    unsubscribe()
  }
}
