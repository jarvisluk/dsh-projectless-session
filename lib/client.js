window.__ModuleLoader__.load({ id: "dsh-projectless-session", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/session.ts
var PROJECTLESS_SESSION_PREFIX = "session-projectless-";
async function requestProjectlessDirectory(rpc) {
  const result = await rpc.call("/projectless-session", "create-directory", {});
  if (!result.ok) throw new Error(result.error.message);
  const value = result.value;
  if (typeof value !== "object" || value === null || typeof value.path !== "string") {
    throw new Error("projectless session Host returned an invalid directory response");
  }
  return value.path;
}
function createProjectlessSessionId(uuid = crypto.randomUUID()) {
  return `${PROJECTLESS_SESSION_PREFIX}${uuid}`;
}
async function createAndOpenProjectlessSession(sessions, provisionDirectory, allocateId = createProjectlessSessionId) {
  const cwd = await provisionDirectory();
  const requestedId = allocateId();
  const sessionId = await sessions.create({ cwd, sessionId: requestedId });
  sessions.open(sessionId);
  return sessionId;
}
function selectProjectlessBlankSession(session) {
  if (session === void 0 || !session.blank || !session.sessionId.startsWith(PROJECTLESS_SESSION_PREFIX)) {
    return null;
  }
  return { sessionId: session.sessionId };
}

// src/client/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var PACKAGE_ID = "dsh-projectless-session";
var PROJECTLESS = "::projectless-session";
var ADD_WORKSPACE = "::add-workspace";
function errorMessage(reason) {
  return reason instanceof Error ? reason.message : String(reason);
}
function ProjectlessWorkspacePicker({
  open,
  anchorRef,
  selectedId,
  onPick,
  onClose,
  useWorkspaces,
  createWorkspace,
  createProjectlessSession,
  pickDirectory
}) {
  const workspaceState = useWorkspaces((state) => state);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [modalError, setModalError] = (0, import_react.useState)(null);
  const getAnchorRect = (0, import_react.useCallback)(
    () => anchorRef?.current?.getBoundingClientRect() ?? null,
    [anchorRef]
  );
  const workspaceItems = workspaceState.items.map((workspace) => ({
    id: workspace.workspaceId,
    label: workspace.title,
    icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconFolderClose16, { size: 16 }),
    disabled: busy
  }));
  const footer = [
    {
      id: PROJECTLESS,
      label: "\u65E0\u5DE5\u4F5C\u533A\u4F1A\u8BDD",
      icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconNewChatOutline16, { size: 16 }),
      disabled: busy
    },
    { type: "separator", id: "projectless-separator" },
    {
      id: ADD_WORKSPACE,
      label: "\u6DFB\u52A0\u5DE5\u4F5C\u533A\u2026",
      icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconPlusOutline16, { size: 16 }),
      disabled: busy
    }
  ];
  const run = (operation) => {
    if (busy) return;
    setBusy(true);
    void operation().catch((reason) => {
      setModalError(errorMessage(reason));
    }).finally(() => {
      setBusy(false);
    });
  };
  const handleSelect = (id) => {
    if (id === PROJECTLESS) {
      onClose();
      run(async () => {
        await createProjectlessSession();
      });
      return;
    }
    if (id === ADD_WORKSPACE) {
      onClose();
      run(async () => {
        const path = await pickDirectory();
        if (path === null) return;
        const workspace = await createWorkspace({ path });
        onPick(workspace.workspaceId);
      });
      return;
    }
    onPick(id);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_dsh_client_ui_primitives.Menu,
      {
        open,
        anchor: null,
        items: workspaceItems,
        footer,
        selectedId,
        onSelect: handleSelect,
        onClose,
        side: "bottom",
        portal: true,
        getAnchorRect
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_dsh_client_ui_primitives.Modal,
      {
        open: modalError !== null,
        onClose: () => {
          setModalError(null);
        },
        closeLabel: "\u5173\u95ED",
        title: "\u65E0\u6CD5\u521B\u5EFA\u65E0\u5DE5\u4F5C\u533A\u4F1A\u8BDD",
        footer: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "primary", onClick: () => {
          setModalError(null);
        }, children: "\u77E5\u9053\u4E86" }),
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-projectless-session-error", role: "alert", children: modalError })
      }
    )
  ] });
}
function ProjectlessFirstPromptComposer({
  matched,
  useInput,
  inputActions,
  useSession,
  useSessions
}) {
  const input = useInput((state) => state);
  const promptError = useSession((state) => state.promptError);
  const cwd = useSessions((state) => state.byId[matched.sessionId]?.cwd);
  const inputRef = (0, import_react.useRef)(null);
  const draft = input?.draft ?? "";
  const busy = input === void 0 || input.phase === "adjudicating" || input.phase === "submitting";
  const canSubmit = !busy && draft.trim() !== "";
  const directoryName = cwd?.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "DSH Session";
  (0, import_react.useEffect)(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [matched.sessionId]);
  const submit = () => {
    if (canSubmit) inputActions.submit();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-projectless-composer", "data-projectless-session": matched.sessionId, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-projectless-heading", children: [
      "\u63A2\u7D22\u672A\u81F3\u4E4B\u5883 ",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u9884\u89C8\u7248" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-projectless-context", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconFolderClose16, { size: 16 }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u65E0\u5DE5\u4F5C\u533A\u4F1A\u8BDD" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-projectless-directory", children: directoryName })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-projectless-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "textarea",
        {
          ref: inputRef,
          value: draft,
          disabled: busy,
          "aria-label": "\u63CF\u8FF0\u4F60\u60F3\u8981\u6784\u5EFA\u7684\u5185\u5BB9",
          placeholder: "\u63CF\u8FF0\u4F60\u60F3\u8981\u6784\u5EFA\u7684\u5185\u5BB9",
          rows: 3,
          onChange: (event) => {
            inputActions.setDraft(event.currentTarget.value);
          },
          onKeyDown: (event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            submit();
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: "dsh-projectless-send",
          disabled: !canSubmit,
          "aria-label": "\u53D1\u9001\u6D88\u606F",
          onClick: submit,
          children: "\u2191"
        }
      )
    ] }),
    promptError !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-projectless-inline-error", role: "alert", children: promptError.error.message }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-projectless-hint", children: "\u9996\u6761\u6D88\u606F\u53D1\u9001\u540E\u8FDB\u5165\u6807\u51C6\u4F1A\u8BDD\u754C\u9762" })
  ] });
}
function installStyles() {
  const style = document.createElement("style");
  style.dataset.plugin = PACKAGE_ID;
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
  `;
  document.head.appendChild(style);
  return () => {
    style.remove();
  };
}
var name = PACKAGE_ID;
var inject = ["connection", "slots", "sessions", "workspaces"];
function apply(ctx) {
  ctx.effect(installStyles, `${PACKAGE_ID}: styles`);
  const directSessions = ctx.sessions;
  const actions = () => ({
    createWorkspace: (input) => ctx.workspaces.create(input),
    pickDirectory: () => ctx.workspaces.pickDirectory(),
    createProjectlessSession: async () => {
      if (directSessions.create === void 0) {
        throw new Error("\u5F53\u524D DSH \u7248\u672C\u4E0D\u652F\u6301\u76F4\u63A5\u521B\u5EFA\u6307\u5B9A cwd \u7684 Session");
      }
      return createAndOpenProjectlessSession(
        {
          create: (input) => directSessions.create(input),
          open: (sessionId) => ctx.sessions.open(sessionId)
        },
        // The published Connection package augments the same Cordis key with
        // Host and Client faces; this file is bundled only for the Client face.
        () => requestProjectlessDirectory(ctx.connection.rpc)
      );
    }
  });
  ctx.slots.inject("conversation.composer", () => ctx.slots.register(
    {
      name: "conversation.composer",
      priority: 0,
      select: ({ session }) => selectProjectlessBlankSession(session)
    },
    ProjectlessFirstPromptComposer
  ));
  ctx.slots.inject("conversation.hero.workspace", () => ctx.slots.register(
    {
      name: "conversation.hero.workspace",
      priority: -1,
      inject: actions
    },
    ProjectlessWorkspacePicker
  ));
}
return module.exports; } });
//# sourceMappingURL=client.js.map
