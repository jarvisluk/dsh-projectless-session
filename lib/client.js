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
async function requestProjectlessDirectory(rpc) {
  const result = await rpc.call("/projectless-session", "create-directory", {});
  if (!result.ok) throw new Error(result.error.message);
  const value = result.value;
  if (typeof value !== "object" || value === null || typeof value.path !== "string") {
    throw new Error("projectless session Host returned an invalid directory response");
  }
  return value.path;
}
async function createAndOpenProjectlessSession(workspaces, sessions, provisionDirectory) {
  const path = await provisionDirectory();
  const workspace = await workspaces.create({ path });
  const sessionId = await workspaces.connectWorkspace(workspace.workspaceId);
  sessions.open(sessionId);
  return { sessionId, workspaceId: workspace.workspaceId };
}
function detachWorkspaceAfterFirstPrompt(workspaces, sessions, receipt, onError = console.error) {
  let active = true;
  let unsubscribe = () => {
  };
  const reconcile = () => {
    if (!active || sessions.list.getSnapshot().byId[receipt.sessionId]?.blank !== false) return;
    active = false;
    unsubscribe();
    void workspaces.delete(receipt.workspaceId).catch(onError);
  };
  unsubscribe = sessions.list.subscribe(reconcile);
  reconcile();
  return () => {
    active = false;
    unsubscribe();
  };
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
  const actions = () => ({
    createWorkspace: (input) => ctx.workspaces.create(input),
    pickDirectory: () => ctx.workspaces.pickDirectory(),
    createProjectlessSession: async () => {
      const receipt = await createAndOpenProjectlessSession(
        ctx.workspaces,
        ctx.sessions,
        // The published Connection package augments the same Cordis key with
        // Host and Client faces; this file is bundled only for the Client face.
        () => requestProjectlessDirectory(ctx.connection.rpc)
      );
      ctx.effect(
        () => detachWorkspaceAfterFirstPrompt(ctx.workspaces, ctx.sessions, receipt),
        `${PACKAGE_ID}: detach ${receipt.sessionId} after first prompt`
      );
      return receipt.sessionId;
    }
  });
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
