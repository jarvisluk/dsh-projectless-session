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

// src/shared/paths.ts
var DATE_DIRECTORY = /^\d{4}-\d{2}-\d{2}$/;
var SESSION_DIRECTORY = /^session-\d{2}-\d{2}-\d{2}-[0-9a-f]{8}$/;
function normalizeFsPath(path) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}
function relativeParts(target, root) {
  const path = normalizeFsPath(target);
  const base = normalizeFsPath(root);
  if (base === "" || path === base || !path.startsWith(`${base}/`)) return void 0;
  return path.slice(base.length + 1).split("/");
}
function isManagedSessionPath(target, root) {
  const parts = relativeParts(target, root);
  return parts !== void 0 && parts.length === 2 && DATE_DIRECTORY.test(parts[0] ?? "") && SESSION_DIRECTORY.test(parts[1] ?? "");
}
function isProjectlessPath(path) {
  const segments = normalizeFsPath(path).split("/").filter((segment) => segment.length > 0);
  const dateName = segments.at(-2);
  const sessionName = segments.at(-1);
  return dateName !== void 0 && sessionName !== void 0 && DATE_DIRECTORY.test(dateName) && SESSION_DIRECTORY.test(sessionName);
}

// src/client/session.ts
function createAbandonClaim() {
  const claimed = /* @__PURE__ */ new Set();
  return {
    tryClaim(workspaceId) {
      if (claimed.has(workspaceId)) return false;
      claimed.add(workspaceId);
      return true;
    }
  };
}
var PROJECTLESS_ENTRY_ID = "::projectless-session";
function createProjectlessRegistry() {
  const ids = /* @__PURE__ */ new Set();
  return {
    remember(workspaceId) {
      ids.add(workspaceId);
    },
    has(workspaceId) {
      return ids.has(workspaceId);
    }
  };
}
function resolvePickerSelection(items, selectedId, isProjectless) {
  const projects = [];
  let projectlessActive = false;
  for (const row of items) {
    if (isProjectless(row)) {
      if (selectedId !== void 0 && row.workspaceId === selectedId) projectlessActive = true;
      continue;
    }
    projects.push(row);
  }
  return {
    projects,
    selectedId: projectlessActive ? PROJECTLESS_ENTRY_ID : selectedId,
    projectlessActive
  };
}
function rpcValue(result, label) {
  if (!result.ok) throw new Error(result.error?.message ?? `${label} failed`);
  return result.value;
}
function expectPathObject(value, key, label) {
  if (typeof value !== "object" || value === null || typeof value[key] !== "string") {
    throw new Error(`${label} returned an invalid directory response`);
  }
  return value[key];
}
async function requestProjectlessDirectory(rpc) {
  return expectPathObject(
    rpcValue(await rpc.call("/projectless-session", "create-directory", {}), "projectless session Host"),
    "path",
    "projectless session Host"
  );
}
async function requestProjectlessRoot(rpc) {
  return expectPathObject(
    rpcValue(await rpc.call("/projectless-session", "get-root", {}), "projectless session Host"),
    "root",
    "projectless session Host"
  );
}
async function requestRemoveProjectlessDirectory(rpc, path) {
  rpcValue(await rpc.call("/projectless-session", "remove-directory", { path }), "projectless session Host");
}
async function createAndOpenProjectlessSession(workspaces, sessions, provisionDirectory, registry, removeDirectory = async () => {
}, pending) {
  const path = await provisionDirectory();
  const workspace = await workspaces.create({ path });
  registry?.remember(workspace.workspaceId);
  pending?.add(workspace.workspaceId);
  try {
    const sessionId = await workspaces.connectWorkspace(workspace.workspaceId);
    sessions.open(sessionId);
    return { sessionId, workspaceId: workspace.workspaceId, path };
  } catch (reason) {
    pending?.delete(workspace.workspaceId);
    await workspaces.delete(workspace.workspaceId).catch(() => {
    });
    await removeDirectory(path).catch(() => {
    });
    throw reason;
  }
}
async function abandonUnusedProjectlessWorkspace(workspaces, target, removeDirectory, onError = console.error) {
  for (const sessionId of target.sessionIds) {
    await workspaces.archiveSession(sessionId).catch(onError);
  }
  await workspaces.delete(target.workspaceId).catch(onError);
  await removeDirectory(target.path).catch(onError);
}
function isAbandonedProjectlessWorkspace(workspace, sessions, root, skip = /* @__PURE__ */ new Set()) {
  if (skip.has(workspace.workspaceId) || !isManagedSessionPath(workspace.path, root)) return false;
  if (workspace.sessionIds.length === 0) return false;
  for (const sessionId of workspace.sessionIds) {
    if (sessions.current === sessionId) return false;
    const row = sessions.byId[sessionId];
    if (row === void 0 || row.blank !== true) return false;
  }
  return true;
}
function findAbandonedProjectlessWorkspaces(workspaces, sessions, root, skip = /* @__PURE__ */ new Set()) {
  return workspaces.filter((workspace) => isAbandonedProjectlessWorkspace(workspace, sessions, root, skip)).map((workspace) => ({
    workspaceId: workspace.workspaceId,
    path: workspace.path,
    sessionIds: workspace.sessionIds
  }));
}
function unusedReceipt(receipt) {
  return {
    workspaceId: receipt.workspaceId,
    path: receipt.path,
    sessionIds: [receipt.sessionId]
  };
}
function watchTemporaryWorkspace(workspaces, sessions, receipt, removeDirectory, claim = createAbandonClaim(), onError = console.error) {
  let active = true;
  let unsubscribe = () => {
  };
  const finish = (work) => {
    if (!active) return;
    active = false;
    unsubscribe();
    void work().catch(onError);
  };
  const abandon = () => {
    if (!claim.tryClaim(receipt.workspaceId)) {
      active = false;
      unsubscribe();
      return;
    }
    finish(() => abandonUnusedProjectlessWorkspace(workspaces, unusedReceipt(receipt), removeDirectory, onError));
  };
  const reconcile = () => {
    if (!active) return;
    const snapshot = sessions.list.getSnapshot();
    if (snapshot.byId[receipt.sessionId]?.blank === false) {
      finish(async () => {
        await workspaces.delete(receipt.workspaceId);
      });
      return;
    }
    if (snapshot.current === receipt.sessionId) return;
    abandon();
  };
  unsubscribe = sessions.list.subscribe(reconcile);
  reconcile();
  return () => {
    if (!active) return;
    const snapshot = sessions.list.getSnapshot();
    if (snapshot.byId[receipt.sessionId]?.blank === false) {
      finish(async () => {
        await workspaces.delete(receipt.workspaceId);
      });
      return;
    }
    abandon();
  };
}
function sweepAbandonedProjectlessWorkspaces(workspaces, sessions, root, removeDirectory, skip, claim, onError = console.error) {
  let active = true;
  const reconcile = () => {
    if (!active) return;
    const workspaceState = workspaces.list.getSnapshot();
    if (workspaceState.baselinesReady === false) return;
    for (const leftover of findAbandonedProjectlessWorkspaces(
      workspaceState.items,
      sessions.list.getSnapshot(),
      root,
      skip
    )) {
      if (!claim.tryClaim(leftover.workspaceId)) continue;
      void abandonUnusedProjectlessWorkspace(workspaces, leftover, removeDirectory, onError);
    }
  };
  const unsubscribeWorkspaces = workspaces.list.subscribe(reconcile);
  const unsubscribeSessions = sessions.list.subscribe(reconcile);
  reconcile();
  return () => {
    active = false;
    unsubscribeWorkspaces();
    unsubscribeSessions();
  };
}

// src/client/locales.ts
var PROJECTLESS_LOCALE_NS = "projectless-session";
var zh = {
  "picker.projectless": "\u65E0\u5DE5\u4F5C\u533A\u4F1A\u8BDD",
  "picker.addWorkspace": "\u6DFB\u52A0\u5DE5\u4F5C\u533A\u2026",
  "modal.createFailed": "\u65E0\u6CD5\u521B\u5EFA\u65E0\u5DE5\u4F5C\u533A\u4F1A\u8BDD",
  "modal.close": "\u77E5\u9053\u4E86"
};
var en = {
  "picker.projectless": "Session without workspace",
  "picker.addWorkspace": "Add workspace\u2026",
  "modal.createFailed": "Could not create session without workspace",
  "modal.close": "Got it"
};
var projectlessLocales = {
  zh,
  en
};

// src/client/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var PACKAGE_ID = "dsh-projectless-session";
var PROJECTLESS = PROJECTLESS_ENTRY_ID;
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
  pickDirectory,
  isProjectlessWorkspace,
  t
}) {
  const workspaceState = useWorkspaces((state) => state);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [modalError, setModalError] = (0, import_react.useState)(null);
  const getAnchorRect = (0, import_react.useCallback)(
    () => anchorRef?.current?.getBoundingClientRect() ?? null,
    [anchorRef]
  );
  const selection = resolvePickerSelection(
    workspaceState.items,
    selectedId,
    isProjectlessWorkspace
  );
  const workspaceItems = selection.projects.map((workspace) => ({
    id: workspace.workspaceId,
    label: workspace.title,
    icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconFolderClose16, { size: 16 }),
    disabled: busy
  }));
  const footer = [
    {
      id: PROJECTLESS,
      label: t("picker.projectless"),
      icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconNewChatOutline16, { size: 16 }),
      disabled: busy
    },
    { type: "separator", id: "projectless-separator" },
    {
      id: ADD_WORKSPACE,
      label: t("picker.addWorkspace"),
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
        selectedId: selection.selectedId,
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
        closeLabel: t("modal.close"),
        title: t("modal.createFailed"),
        footer: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "primary", onClick: () => {
          setModalError(null);
        }, children: t("modal.close") }),
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
var inject = ["connection", "locale", "slots", "sessions", "workspaces"];
function apply(ctx) {
  ctx.effect(installStyles, `${PACKAGE_ID}: styles`);
  ctx.effect(
    () => ctx.locale.register(PROJECTLESS_LOCALE_NS, projectlessLocales),
    `${PACKAGE_ID}: dictionaries`
  );
  const registry = createProjectlessRegistry();
  const pendingWorkspaceIds = /* @__PURE__ */ new Set();
  const claim = createAbandonClaim();
  const rpc = ctx.connection.rpc;
  const removeDirectory = (path) => requestRemoveProjectlessDirectory(rpc, path);
  const isProjectlessWorkspace = (workspace) => registry.has(workspace.workspaceId) || isProjectlessPath(workspace.path);
  ctx.effect(() => {
    let disposed = false;
    let stopSweep = () => {
    };
    void requestProjectlessRoot(rpc).then((root) => {
      if (disposed) return;
      stopSweep = sweepAbandonedProjectlessWorkspaces(
        ctx.workspaces,
        ctx.sessions,
        root,
        removeDirectory,
        pendingWorkspaceIds,
        claim
      );
    }).catch(console.error);
    return () => {
      disposed = true;
      stopSweep();
    };
  }, `${PACKAGE_ID}: sweep leftover unused workspaces`);
  const actions = () => ({
    createWorkspace: (input) => ctx.workspaces.create(input),
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
        pendingWorkspaceIds
      );
      const translate = ctx.locale.bind(PROJECTLESS_LOCALE_NS);
      await ctx.workspaces.rename(receipt.workspaceId, translate("picker.projectless")).catch(() => {
      });
      ctx.effect(
        () => {
          const stop = watchTemporaryWorkspace(
            ctx.workspaces,
            ctx.sessions,
            receipt,
            removeDirectory,
            claim
          );
          pendingWorkspaceIds.delete(receipt.workspaceId);
          return stop;
        },
        `${PACKAGE_ID}: watch ${receipt.sessionId} temporary workspace`
      );
      return receipt.sessionId;
    }
  });
  ctx.slots.inject("conversation.hero.workspace", () => ctx.slots.register(
    {
      name: "conversation.hero.workspace",
      priority: -1,
      inject: actions,
      locale: PROJECTLESS_LOCALE_NS
    },
    ProjectlessWorkspacePicker
  ));
}
return module.exports; } });
//# sourceMappingURL=client.js.map
