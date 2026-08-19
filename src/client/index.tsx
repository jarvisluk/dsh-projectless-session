import { useCallback, useState } from 'react'
import type { RefObject } from 'react'
import type { ClientContext, SessionId, WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  Button,
  IconFolderClose16,
  IconNewChatOutline16,
  IconPlusOutline16,
  Menu,
  Modal,
  type MenuEntry,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  PROJECTLESS_ENTRY_ID,
  createAbandonClaim,
  createAndOpenProjectlessSession,
  createProjectlessRegistry,
  isProjectlessPath,
  requestProjectlessDirectory,
  requestProjectlessRoot,
  requestRemoveProjectlessDirectory,
  resolvePickerSelection,
  sweepAbandonedProjectlessWorkspaces,
  watchTemporaryWorkspace,
} from './session.ts'
import { PROJECTLESS_LOCALE_NS, projectlessLocales } from './locales.ts'

const PACKAGE_ID = 'dsh-projectless-session'
const PROJECTLESS = PROJECTLESS_ENTRY_ID
const ADD_WORKSPACE = '::add-workspace'

interface PickerActions {
  createWorkspace(input: { path: string }): Promise<WorkspaceView>
  createProjectlessSession(): Promise<SessionId>
  pickDirectory(): Promise<string | null>
  isProjectlessWorkspace(workspace: WorkspaceView): boolean
}

type PickerProps = PropsRuntime<'conversation.hero.workspace'> & PickerActions & PropsLocale<typeof PROJECTLESS_LOCALE_NS>

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/** Shadow-compatible replacement for the built-in WorkspacePicker. */
function ProjectlessWorkspacePicker({
  open,
  anchorRef,
  selectedId,
  onPick,
  onClose,
  useWorkspaces,
  createWorkspace,
  createProjectlessSession,
  pickDirectory,
  isProjectlessWorkspace,
  t,
}: PickerProps) {
  const workspaceState = useWorkspaces(state => state)
  const [busy, setBusy] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const getAnchorRect = useCallback(
    () => (anchorRef as RefObject<HTMLElement | null> | undefined)?.current?.getBoundingClientRect() ?? null,
    [anchorRef],
  )

  const selection = resolvePickerSelection(
    workspaceState.items,
    selectedId,
    isProjectlessWorkspace,
  )
  const workspaceItems: MenuEntry[] = selection.projects.map(workspace => ({
    id: workspace.workspaceId,
    label: workspace.title,
    icon: <IconFolderClose16 size={16} />,
    disabled: busy,
  }))
  const footer: MenuEntry[] = [
    {
      id: PROJECTLESS,
      label: t('picker.projectless'),
      icon: <IconNewChatOutline16 size={16} />,
      disabled: busy,
    },
    { type: 'separator', id: 'projectless-separator' },
    {
      id: ADD_WORKSPACE,
      label: t('picker.addWorkspace'),
      icon: <IconPlusOutline16 size={16} />,
      disabled: busy,
    },
  ]

  const run = (operation: () => Promise<void>): void => {
    if (busy) return
    setBusy(true)
    void operation().catch((reason: unknown) => {
      setModalError(errorMessage(reason))
    }).finally(() => {
      setBusy(false)
    })
  }

  const handleSelect = (id: string): void => {
    if (id === PROJECTLESS) {
      onClose()
      run(async () => { await createProjectlessSession() })
      return
    }
    if (id === ADD_WORKSPACE) {
      onClose()
      run(async () => {
        const path = await pickDirectory()
        if (path === null) return
        const workspace = await createWorkspace({ path })
        onPick(workspace.workspaceId)
      })
      return
    }
    onPick(id as WorkspaceId)
  }

  return (
    <>
      <Menu
        open={open}
        anchor={null}
        items={workspaceItems}
        footer={footer}
        selectedId={selection.selectedId}
        onSelect={handleSelect}
        onClose={onClose}
        side="bottom"
        portal
        getAnchorRect={getAnchorRect}
      />
      <Modal
        open={modalError !== null}
        onClose={() => { setModalError(null) }}
        closeLabel={t('modal.close')}
        title={t('modal.createFailed')}
        footer={(
          <Button variant="primary" onClick={() => { setModalError(null) }}>
            {t('modal.close')}
          </Button>
        )}
      >
        <div className="dsh-projectless-session-error" role="alert">{modalError}</div>
      </Modal>
    </>
  )
}

function installStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.plugin = PACKAGE_ID
  style.textContent = `
    .dsh-projectless-session-error {
      margin-top: 8px;
      color: var(--dsw-alias-state-error-primary);
      font-size: 12px;
      line-height: 18px;
      overflow-wrap: anywhere;
    }
  `
  document.head.appendChild(style)
  return () => { style.remove() }
}

export const name = PACKAGE_ID
export const inject = ['connection', 'locale', 'slots', 'sessions', 'workspaces']

/** Install a priority -1 picker; DSH's built-in priority 0 picker remains the automatic fallback. */
export function apply(ctx: ClientContext): void {
  ctx.effect(installStyles, `${PACKAGE_ID}: styles`)
  ctx.effect(
    () => ctx.locale.register(PROJECTLESS_LOCALE_NS, projectlessLocales),
    `${PACKAGE_ID}: dictionaries`,
  )
  const registry = createProjectlessRegistry()
  const pendingWorkspaceIds = new Set<WorkspaceId>()
  const claim = createAbandonClaim()
  const rpc = ctx.connection.rpc as unknown as ClientConnectionRpc
  const removeDirectory = (path: string) => requestRemoveProjectlessDirectory(rpc, path)
  const isProjectlessWorkspace = (workspace: WorkspaceView): boolean => (
    registry.has(workspace.workspaceId) || isProjectlessPath(workspace.path)
  )
  ctx.effect(() => {
    let disposed = false
    let stopSweep = (): void => {}
    void requestProjectlessRoot(rpc).then(root => {
      if (disposed) return
      stopSweep = sweepAbandonedProjectlessWorkspaces(
        ctx.workspaces,
        ctx.sessions,
        root,
        removeDirectory,
        pendingWorkspaceIds,
        claim,
      )
    }).catch(console.error)
    return () => {
      disposed = true
      stopSweep()
    }
  }, `${PACKAGE_ID}: sweep leftover unused workspaces`)
  const actions = (): PickerActions => ({
    createWorkspace: input => ctx.workspaces.create(input),
    pickDirectory: () => ctx.workspaces.pickDirectory(),
    isProjectlessWorkspace,
    createProjectlessSession: async () => {
      const receipt = await createAndOpenProjectlessSession(
        ctx.workspaces,
        ctx.sessions,
        // The published Connection package augments the same Cordis key with
        // Host and Client faces; this file is bundled only for the Client face.
        () => requestProjectlessDirectory(rpc),
        registry,
        removeDirectory,
        pendingWorkspaceIds,
      )
      const translate = ctx.locale.bind(PROJECTLESS_LOCALE_NS)
      await ctx.workspaces.rename(receipt.workspaceId, translate('picker.projectless')).catch(() => {})
      ctx.effect(
        () => {
          const stop = watchTemporaryWorkspace(
            ctx.workspaces,
            ctx.sessions,
            receipt,
            removeDirectory,
            claim,
          )
          pendingWorkspaceIds.delete(receipt.workspaceId)
          return stop
        },
        `${PACKAGE_ID}: watch ${receipt.sessionId} temporary workspace`,
      )
      return receipt.sessionId
    },
  })

  ctx.slots.inject('conversation.hero.workspace', () => ctx.slots.register(
    {
      name: 'conversation.hero.workspace',
      priority: -1,
      inject: actions,
      locale: PROJECTLESS_LOCALE_NS,
    },
    ProjectlessWorkspacePicker,
  ))
}
