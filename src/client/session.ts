import type { SessionId, WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { isManagedSessionPath, isProjectlessPath } from '../shared/paths.ts'

export { isProjectlessPath }

/** Public DSH faces required to turn a directory into an ungrouped Session. */
export interface ProjectlessSessionHost {
  create(input: { path: string }): Promise<WorkspaceView>
  connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId>
  delete(workspaceId: WorkspaceId): Promise<void>
  archiveSession(sessionId: SessionId): Promise<void>
}

export interface SessionListSlice {
  current?: SessionId | undefined
  byId: Partial<Record<SessionId, { blank: boolean }>>
}

export interface SessionNavigator {
  open(sessionId: SessionId): void
  list: {
    getSnapshot(): SessionListSlice
    subscribe(listener: () => void): () => void
  }
}

export interface WorkspaceListSlice {
  items: readonly Pick<WorkspaceView, 'workspaceId' | 'path' | 'sessionIds'>[]
  baselinesReady?: boolean | undefined
}

export interface WorkspaceNavigator {
  list: {
    getSnapshot(): WorkspaceListSlice
    subscribe(listener: () => void): () => void
  }
}

export interface ProjectlessSessionReceipt {
  sessionId: SessionId
  workspaceId: WorkspaceId
  path: string
}

export interface AbandonedProjectlessWorkspace {
  workspaceId: WorkspaceId
  path: string
  sessionIds: readonly SessionId[]
}

/** Prevents watch + sweep from both tearing down the same unused Workspace. */
export interface AbandonClaim {
  tryClaim(workspaceId: WorkspaceId): boolean
}

export function createAbandonClaim(): AbandonClaim {
  const claimed = new Set<WorkspaceId>()
  return {
    tryClaim(workspaceId) {
      if (claimed.has(workspaceId)) return false
      claimed.add(workspaceId)
      return true
    },
  }
}

/** Menu entry id for the projectless action; also its selected-state key. */
export const PROJECTLESS_ENTRY_ID = '::projectless-session'

/** Workspaces this page provisioned, authoritative over the path heuristic. */
export interface ProjectlessRegistry {
  remember(workspaceId: WorkspaceId): void
  has(workspaceId: WorkspaceId): boolean
}

export function createProjectlessRegistry(): ProjectlessRegistry {
  const ids = new Set<WorkspaceId>()
  return {
    remember(workspaceId) { ids.add(workspaceId) },
    has(workspaceId) { return ids.has(workspaceId) },
  }
}

export interface PickerSelection<T> {
  /** Rows a user may meaningfully pick as a project. */
  projects: readonly T[]
  /** Value handed to the Menu: the projectless entry wins when it is active. */
  selectedId: string | undefined
  projectlessActive: boolean
}

/**
 * Hide temporary scratch workspaces from the picker and move the selected
 * state onto the projectless entry, so the active projectless session reads as
 * "Session without workspace" instead of exposing its generated directory.
 */
export function resolvePickerSelection<T extends { workspaceId: WorkspaceId }>(
  items: readonly T[],
  selectedId: WorkspaceId | undefined,
  isProjectless: (row: T) => boolean,
): PickerSelection<T> {
  const projects: T[] = []
  let projectlessActive = false
  for (const row of items) {
    if (isProjectless(row)) {
      if (selectedId !== undefined && row.workspaceId === selectedId) projectlessActive = true
      continue
    }
    projects.push(row)
  }
  return {
    projects,
    selectedId: projectlessActive ? PROJECTLESS_ENTRY_ID : selectedId,
    projectlessActive,
  }
}

function rpcValue(result: { ok: boolean, value?: unknown, error?: { message: string } }, label: string): unknown {
  if (!result.ok) throw new Error(result.error?.message ?? `${label} failed`)
  return result.value
}

function expectPathObject(value: unknown, key: 'path' | 'root', label: string): string {
  if (typeof value !== 'object' || value === null || typeof (value as Record<string, unknown>)[key] !== 'string') {
    throw new Error(`${label} returned an invalid directory response`)
  }
  return (value as Record<typeof key, string>)[key]
}

/** Call the plugin Host half and validate its intentionally tiny response. */
export async function requestProjectlessDirectory(rpc: ClientConnectionRpc): Promise<string> {
  return expectPathObject(
    rpcValue(await rpc.call('/projectless-session', 'create-directory', {}), 'projectless session Host'),
    'path',
    'projectless session Host',
  )
}

export async function requestProjectlessRoot(rpc: ClientConnectionRpc): Promise<string> {
  return expectPathObject(
    rpcValue(await rpc.call('/projectless-session', 'get-root', {}), 'projectless session Host'),
    'root',
    'projectless session Host',
  )
}

export async function requestRemoveProjectlessDirectory(rpc: ClientConnectionRpc, path: string): Promise<void> {
  rpcValue(await rpc.call('/projectless-session', 'remove-directory', { path }), 'projectless session Host')
}

/**
 * Create and open a Session while retaining its temporary Workspace long
 * enough for DSH's native blank-session composer to accept the first prompt.
 */
export async function createAndOpenProjectlessSession(
  workspaces: ProjectlessSessionHost,
  sessions: SessionNavigator,
  provisionDirectory: () => Promise<string>,
  registry?: Pick<ProjectlessRegistry, 'remember'>,
  removeDirectory: (path: string) => Promise<void> = async () => {},
  pending?: Set<WorkspaceId>,
): Promise<ProjectlessSessionReceipt> {
  const path = await provisionDirectory()
  const workspace = await workspaces.create({ path })
  registry?.remember(workspace.workspaceId)
  pending?.add(workspace.workspaceId)
  try {
    const sessionId = await workspaces.connectWorkspace(workspace.workspaceId)
    sessions.open(sessionId)
    return { sessionId, workspaceId: workspace.workspaceId, path }
  } catch (reason) {
    pending?.delete(workspace.workspaceId)
    // A failed Session creation must not leave a temporary Workspace behind.
    await workspaces.delete(workspace.workspaceId).catch(() => {})
    await removeDirectory(path).catch(() => {})
    throw reason
  }
}

export async function abandonUnusedProjectlessWorkspace(
  workspaces: Pick<ProjectlessSessionHost, 'delete' | 'archiveSession'>,
  target: AbandonedProjectlessWorkspace,
  removeDirectory: (path: string) => Promise<void>,
  onError: (reason: unknown) => void = console.error,
): Promise<void> {
  for (const sessionId of target.sessionIds) {
    await workspaces.archiveSession(sessionId).catch(onError)
  }
  await workspaces.delete(target.workspaceId).catch(onError)
  await removeDirectory(target.path).catch(onError)
}

/**
 * A leftover projectless Workspace is unused when every accounted Session is
 * still blank and none of them is the current Session.
 */
export function isAbandonedProjectlessWorkspace(
  workspace: Pick<WorkspaceView, 'workspaceId' | 'path' | 'sessionIds'>,
  sessions: SessionListSlice,
  root: string,
  skip: ReadonlySet<WorkspaceId> = new Set(),
): boolean {
  if (skip.has(workspace.workspaceId) || !isManagedSessionPath(workspace.path, root)) return false
  // A just-created Workspace has no sessions yet. Sweeping that empty row
  // races create→connectWorkspace and surfaces workspace-not-found.
  if (workspace.sessionIds.length === 0) return false
  for (const sessionId of workspace.sessionIds) {
    if (sessions.current === sessionId) return false
    const row = sessions.byId[sessionId]
    if (row === undefined || row.blank !== true) return false
  }
  return true
}

export function findAbandonedProjectlessWorkspaces(
  workspaces: readonly Pick<WorkspaceView, 'workspaceId' | 'path' | 'sessionIds'>[],
  sessions: SessionListSlice,
  root: string,
  skip: ReadonlySet<WorkspaceId> = new Set(),
): AbandonedProjectlessWorkspace[] {
  return workspaces
    .filter(workspace => isAbandonedProjectlessWorkspace(workspace, sessions, root, skip))
    .map(workspace => ({
      workspaceId: workspace.workspaceId,
      path: workspace.path,
      sessionIds: workspace.sessionIds,
    }))
}

function unusedReceipt(receipt: ProjectlessSessionReceipt): AbandonedProjectlessWorkspace {
  return {
    workspaceId: receipt.workspaceId,
    path: receipt.path,
    sessionIds: [receipt.sessionId],
  }
}

/**
 * Keep the temporary Workspace while the blank Session is current. Detach the
 * registration after the first accepted prompt; abandon it if the user leaves
 * without sending, or if this watcher is disposed while still blank.
 */
export function watchTemporaryWorkspace(
  workspaces: Pick<ProjectlessSessionHost, 'delete' | 'archiveSession'>,
  sessions: SessionNavigator,
  receipt: ProjectlessSessionReceipt,
  removeDirectory: (path: string) => Promise<void>,
  claim: AbandonClaim = createAbandonClaim(),
  onError: (reason: unknown) => void = console.error,
): () => void {
  let active = true
  let unsubscribe = (): void => {}

  const finish = (work: () => Promise<void>): void => {
    if (!active) return
    active = false
    unsubscribe()
    void work().catch(onError)
  }

  const abandon = (): void => {
    if (!claim.tryClaim(receipt.workspaceId)) {
      active = false
      unsubscribe()
      return
    }
    finish(() => abandonUnusedProjectlessWorkspace(workspaces, unusedReceipt(receipt), removeDirectory, onError))
  }

  const reconcile = (): void => {
    if (!active) return
    const snapshot = sessions.list.getSnapshot()
    if (snapshot.byId[receipt.sessionId]?.blank === false) {
      finish(async () => { await workspaces.delete(receipt.workspaceId) })
      return
    }
    if (snapshot.current === receipt.sessionId) return
    abandon()
  }

  unsubscribe = sessions.list.subscribe(reconcile)
  reconcile()
  return () => {
    if (!active) return
    const snapshot = sessions.list.getSnapshot()
    if (snapshot.byId[receipt.sessionId]?.blank === false) {
      finish(async () => { await workspaces.delete(receipt.workspaceId) })
      return
    }
    abandon()
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

/** Remove leftover unused projectless Workspaces after a previous DSH run. */
export function sweepAbandonedProjectlessWorkspaces(
  workspaces: Pick<ProjectlessSessionHost, 'delete' | 'archiveSession'> & WorkspaceNavigator,
  sessions: SessionNavigator,
  root: string,
  removeDirectory: (path: string) => Promise<void>,
  skip: ReadonlySet<WorkspaceId>,
  claim: AbandonClaim,
  onError: (reason: unknown) => void = console.error,
): () => void {
  let active = true
  const reconcile = (): void => {
    if (!active) return
    const workspaceState = workspaces.list.getSnapshot()
    if (workspaceState.baselinesReady === false) return
    for (const leftover of findAbandonedProjectlessWorkspaces(
      workspaceState.items,
      sessions.list.getSnapshot(),
      root,
      skip,
    )) {
      if (!claim.tryClaim(leftover.workspaceId)) continue
      void abandonUnusedProjectlessWorkspace(workspaces, leftover, removeDirectory, onError)
    }
  }
  const unsubscribeWorkspaces = workspaces.list.subscribe(reconcile)
  const unsubscribeSessions = sessions.list.subscribe(reconcile)
  reconcile()
  return () => {
    active = false
    unsubscribeWorkspaces()
    unsubscribeSessions()
  }
}
