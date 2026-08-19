// src/index.ts
import { homedir } from "node:os";
import { join as join2 } from "node:path";

// src/host/directories.ts
import { randomBytes } from "node:crypto";
import { lstat, mkdir, readdir, realpath, rmdir, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

// src/shared/paths.ts
var DATE_DIRECTORY = /^\d{4}-\d{2}-\d{2}$/;
var SESSION_DIRECTORY = /^session-\d{2}-\d{2}-\d{2}-[0-9a-f]{8}$/;
var IGNORABLE_DIRECTORY_ENTRIES = /* @__PURE__ */ new Set([
  ".DS_Store",
  ".localized",
  "Thumbs.db",
  "desktop.ini"
]);
function isIgnorableDirectoryEntry(name2) {
  return IGNORABLE_DIRECTORY_ENTRIES.has(name2) || name2.startsWith("._");
}
function normalizeFsPath(path) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}
function relativeParts(target, root) {
  const path = normalizeFsPath(target);
  const base = normalizeFsPath(root);
  if (base === "" || path === base || !path.startsWith(`${base}/`)) return void 0;
  return path.slice(base.length + 1).split("/");
}
function isManagedDateDirectoryPath(target, root) {
  const parts = relativeParts(target, root);
  return parts !== void 0 && parts.length === 1 && DATE_DIRECTORY.test(parts[0] ?? "");
}
function isManagedSessionPath(target, root) {
  const parts = relativeParts(target, root);
  return parts !== void 0 && parts.length === 2 && DATE_DIRECTORY.test(parts[0] ?? "") && SESSION_DIRECTORY.test(parts[1] ?? "");
}

// src/host/directories.ts
function localDateName(now) {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function sessionDirectoryName(now, suffix) {
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `session-${hour}-${minute}-${second}-${suffix}`;
}
function randomSuffix() {
  return randomBytes(4).toString("hex");
}
async function createProjectlessDirectory(root, now = /* @__PURE__ */ new Date(), suffix = randomSuffix()) {
  if (!isAbsolute(root)) throw new Error("projectless session root must be an absolute path");
  const dateDirectory = join(root, localDateName(now));
  await mkdir(dateDirectory, { recursive: true, mode: 448 });
  const sessionDirectory = join(dateDirectory, sessionDirectoryName(now, suffix));
  await mkdir(sessionDirectory, { mode: 448 });
  return sessionDirectory;
}
function isErrno(reason, code) {
  return typeof reason === "object" && reason !== null && "code" in reason && reason.code === code;
}
async function resolveProjectlessRoot(root) {
  if (!isAbsolute(root)) throw new Error("projectless session root must be an absolute path");
  try {
    return await realpath(root);
  } catch (reason) {
    if (isErrno(reason, "ENOENT")) return root;
    throw reason;
  }
}
function isOwnedSessionPath(target, root, resolvedRoot) {
  return isManagedSessionPath(target, root) || isManagedSessionPath(target, resolvedRoot);
}
function isOwnedDatePath(target, root, resolvedRoot) {
  return isManagedDateDirectoryPath(target, root) || isManagedDateDirectoryPath(target, resolvedRoot);
}
async function unlinkIgnorableFiles(directory, names) {
  for (const name2 of names) {
    const target = join(directory, name2);
    try {
      const info = await lstat(target);
      if (!info.isFile()) return false;
      await unlink(target);
    } catch (reason) {
      if (isErrno(reason, "ENOENT")) continue;
      return false;
    }
  }
  return true;
}
async function removeEmptyDirectory(path) {
  let entries;
  try {
    entries = await readdir(path);
  } catch (reason) {
    if (isErrno(reason, "ENOENT")) return "absent";
    throw reason;
  }
  const junk = entries.filter(isIgnorableDirectoryEntry);
  if (junk.length !== entries.length) return "retained";
  if (junk.length > 0 && !await unlinkIgnorableFiles(path, junk)) return "retained";
  try {
    await rmdir(path);
    return "removed";
  } catch (reason) {
    if (isErrno(reason, "ENOENT")) return "absent";
    if (isErrno(reason, "ENOTEMPTY") || isErrno(reason, "EEXIST")) return "retained";
    throw reason;
  }
}
async function removeUnusedProjectlessDirectory(root, requestedPath) {
  if (!isAbsolute(root) || !isAbsolute(requestedPath)) {
    throw new Error("projectless session path must be an absolute path");
  }
  const resolvedRoot = await resolveProjectlessRoot(root);
  if (!isOwnedSessionPath(requestedPath, root, resolvedRoot)) {
    throw new Error("path is not a projectless session directory");
  }
  let canonical;
  try {
    canonical = await realpath(requestedPath);
  } catch (reason) {
    if (isErrno(reason, "ENOENT")) return "absent";
    throw reason;
  }
  if (!isOwnedSessionPath(canonical, root, resolvedRoot)) {
    throw new Error("path is not a projectless session directory");
  }
  const result = await removeEmptyDirectory(canonical);
  if (result !== "removed") return result;
  const parent = dirname(canonical);
  if (isOwnedDatePath(parent, root, resolvedRoot)) {
    await removeEmptyDirectory(parent);
  }
  return "removed";
}

// src/index.ts
var name = "dsh-projectless-session";
var inject = ["connection"];
function pathPayload(payload) {
  if (typeof payload !== "object" || payload === null) return void 0;
  const path = payload.path;
  return typeof path === "string" ? path : void 0;
}
function badRequest(message) {
  return {
    ok: false,
    error: {
      code: "bad-request",
      message,
      details: { issues: [] }
    }
  };
}
function internalError(message) {
  return {
    ok: false,
    error: {
      code: "internal",
      message,
      details: {}
    }
  };
}
function apply(ctx, config = {}) {
  const root = config.root ?? join2(homedir(), "Documents", "DSH");
  ctx.connection.rpc.handle("/projectless-session", async (endpoint, payload) => {
    try {
      if (endpoint === "create-directory") {
        return { ok: true, value: { path: await createProjectlessDirectory(root) } };
      }
      if (endpoint === "get-root") {
        return { ok: true, value: { root: await resolveProjectlessRoot(root) } };
      }
      if (endpoint === "remove-directory") {
        const path = pathPayload(payload);
        if (path === void 0) return badRequest("remove-directory requires { path }");
        return { ok: true, value: { result: await removeUnusedProjectlessDirectory(root, path) } };
      }
      return badRequest(`unknown projectless-session endpoint ${JSON.stringify(endpoint)}`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (message.includes("absolute path") || message.includes("not a projectless")) {
        return badRequest(message);
      }
      return internalError(message);
    }
  }, { authority: "loopback" });
}
export {
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
