import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { ClientContext, SessionId, WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
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
  createAndOpenProjectlessSession,
  requestProjectlessDirectory,
  selectProjectlessBlankSession,
  type ProjectlessComposerMatch,
  type ProjectlessSessionHost,
} from './session.ts'

const PACKAGE_ID = 'dsh-projectless-session'
const PROJECTLESS = '::projectless-session'
const ADD_WORKSPACE = '::add-workspace'

interface PickerActions {
  createWorkspace(input: { path: string }): Promise<WorkspaceView>
  createProjectlessSession(): Promise<SessionId>
  pickDirectory(): Promise<string | null>
}

type PickerProps = PropsRuntime<'conversation.hero.workspace'> & PickerActions
type ProjectlessComposerProps = PropsRuntime<'conversation.composer'> & { matched: ProjectlessComposerMatch }

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
}: PickerProps) {
  const workspaceState = useWorkspaces(state => state)
  const [busy, setBusy] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const getAnchorRect = useCallback(
    () => (anchorRef as RefObject<HTMLElement | null> | undefined)?.current?.getBoundingClientRect() ?? null,
    [anchorRef],
  )

  const workspaceItems: MenuEntry[] = workspaceState.items.map(workspace => ({
    id: workspace.workspaceId,
    label: workspace.title,
    icon: <IconFolderClose16 size={16} />,
    disabled: busy,
  }))
  const footer: MenuEntry[] = [
    {
      id: PROJECTLESS,
      label: '无工作区会话',
      icon: <IconNewChatOutline16 size={16} />,
      disabled: busy,
    },
    { type: 'separator', id: 'projectless-separator' },
    {
      id: ADD_WORKSPACE,
      label: '添加工作区…',
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
        selectedId={selectedId}
        onSelect={handleSelect}
        onClose={onClose}
        side="bottom"
        portal
        getAnchorRect={getAnchorRect}
      />
      <Modal
        open={modalError !== null}
        onClose={() => { setModalError(null) }}
        closeLabel="关闭"
        title="无法创建无工作区会话"
        footer={(
          <Button variant="primary" onClick={() => { setModalError(null) }}>
            知道了
          </Button>
        )}
      >
        <div className="dsh-projectless-session-error" role="alert">{modalError}</div>
      </Modal>
    </>
  )
}

/** First-prompt composer for a cwd-backed Session that has no Workspace. */
function ProjectlessFirstPromptComposer({
  matched,
  useInput,
  inputActions,
  useSession,
  useSessions,
}: ProjectlessComposerProps) {
  const input = useInput(state => state)
  const promptError = useSession(state => state.promptError)
  const cwd = useSessions(state => state.byId[matched.sessionId]?.cwd)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const draft = input?.draft ?? ''
  const busy = input === undefined || input.phase === 'adjudicating' || input.phase === 'submitting'
  const canSubmit = !busy && draft.trim() !== ''
  const directoryName = cwd?.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? 'DSH Session'

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [matched.sessionId])

  const submit = (): void => {
    if (canSubmit) inputActions.submit()
  }

  return (
    <div className="dsh-projectless-composer" data-projectless-session={matched.sessionId}>
      <div className="dsh-projectless-heading">探索未至之境 <span>预览版</span></div>
      <div className="dsh-projectless-context">
        <IconFolderClose16 size={16} />
        <span>无工作区会话</span>
        <span className="dsh-projectless-directory">{directoryName}</span>
      </div>
      <div className="dsh-projectless-card">
        <textarea
          ref={inputRef}
          value={draft}
          disabled={busy}
          aria-label="描述你想要构建的内容"
          placeholder="描述你想要构建的内容"
          rows={3}
          onChange={(event) => { inputActions.setDraft(event.currentTarget.value) }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
            event.preventDefault()
            submit()
          }}
        />
        <button
          type="button"
          className="dsh-projectless-send"
          disabled={!canSubmit}
          aria-label="发送消息"
          onClick={submit}
        >
          ↑
        </button>
      </div>
      {promptError !== null && (
        <div className="dsh-projectless-inline-error" role="alert">
          {promptError.error.message}
        </div>
      )}
      <div className="dsh-projectless-hint">首条消息发送后进入标准会话界面</div>
    </div>
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
    .dsh-projectless-composer {
      box-sizing: border-box;
      width: min(812px, calc(100% - 32px));
      margin: 0 auto;
      padding: 24px 0 32px;
      color: var(--dsw-alias-label-primary);
    }
    .dsh-projectless-heading {
      margin-bottom: 24px;
      text-align: center;
      font-size: 26px;
      font-weight: 500;
      line-height: 32px;
    }
    .dsh-projectless-heading span {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 7px;
      border-radius: 24px;
      background: var(--dsw-alias-state-business-tertiary);
      color: var(--dsw-alias-label-primary-bluish);
      font-size: 12px;
      line-height: 18px;
      vertical-align: 4px;
    }
    .dsh-projectless-context {
      display: flex;
      align-items: center;
      gap: 5px;
      min-height: 28px;
      margin: 0 0 5px 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .dsh-projectless-directory {
      min-width: 0;
      color: var(--dsw-alias-label-caption);
      font-weight: 400;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dsh-projectless-card {
      position: relative;
      box-sizing: border-box;
      min-height: 128px;
      border: 1px solid var(--dsw-alias-border-l2-darkmode-thin);
      border-radius: 22px;
      background: var(--dsw-specific-input-major);
      box-shadow: var(--dsw-shadow-lv2);
    }
    .dsh-projectless-card textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 126px;
      resize: none;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      padding: 15px 58px 42px 16px;
      font: inherit;
      font-size: 16px;
      line-height: 24px;
    }
    .dsh-projectless-card textarea::placeholder {
      color: var(--dsw-alias-label-caption);
    }
    .dsh-projectless-send {
      position: absolute;
      right: 10px;
      bottom: 9px;
      display: grid;
      width: 34px;
      height: 34px;
      place-items: center;
      border: 0;
      border-radius: 999px;
      background: var(--dsw-alias-button-info-fill);
      color: white;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
    }
    .dsh-projectless-send:disabled {
      opacity: .4;
      cursor: default;
    }
    .dsh-projectless-inline-error {
      margin: 7px 12px 0;
      color: var(--dsw-alias-state-error-primary);
      font-size: 12px;
      line-height: 18px;
    }
    .dsh-projectless-hint {
      margin-top: 8px;
      color: var(--dsw-alias-label-caption);
      text-align: center;
      font-size: 12px;
      line-height: 18px;
    }
  `
  document.head.appendChild(style)
  return () => { style.remove() }
}

export const name = PACKAGE_ID
export const inject = ['connection', 'slots', 'sessions', 'workspaces']

/** Install a priority -1 picker; DSH's built-in priority 0 picker remains the automatic fallback. */
export function apply(ctx: ClientContext): void {
  ctx.effect(installStyles, `${PACKAGE_ID}: styles`)
  const directSessions = ctx.sessions as typeof ctx.sessions & Partial<ProjectlessSessionHost>
  const actions = (): PickerActions => ({
    createWorkspace: input => ctx.workspaces.create(input),
    pickDirectory: () => ctx.workspaces.pickDirectory(),
    createProjectlessSession: async () => {
      if (directSessions.create === undefined) {
        throw new Error('当前 DSH 版本不支持直接创建指定 cwd 的 Session')
      }
      return createAndOpenProjectlessSession(
        {
          create: input => directSessions.create!(input),
          open: sessionId => ctx.sessions.open(sessionId),
        },
        // The published Connection package augments the same Cordis key with
        // Host and Client faces; this file is bundled only for the Client face.
        () => requestProjectlessDirectory(ctx.connection.rpc as unknown as ClientConnectionRpc),
      )
    },
  })

  ctx.slots.inject('conversation.composer', () => ctx.slots.register(
    {
      name: 'conversation.composer',
      priority: 0,
      select: ({ session }) => selectProjectlessBlankSession(session),
    },
    ProjectlessFirstPromptComposer,
  ))

  ctx.slots.inject('conversation.hero.workspace', () => ctx.slots.register(
    {
      name: 'conversation.hero.workspace',
      priority: -1,
      inject: actions,
    },
    ProjectlessWorkspacePicker,
  ))
}
