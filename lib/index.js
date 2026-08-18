// src/index.ts
import { homedir } from "node:os";
import { join as join2 } from "node:path";

// src/host/directories.ts
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
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

// src/index.ts
var name = "dsh-projectless-session";
var inject = ["connection"];
function apply(ctx, config = {}) {
  const root = config.root ?? join2(homedir(), "Documents", "DSH");
  ctx.connection.rpc.handle("/projectless-session", async (endpoint) => {
    if (endpoint !== "create-directory") {
      return {
        ok: false,
        error: {
          code: "bad-request",
          message: `unknown projectless-session endpoint ${JSON.stringify(endpoint)}`,
          details: { issues: [] }
        }
      };
    }
    try {
      return { ok: true, value: { path: await createProjectlessDirectory(root) } };
    } catch (reason) {
      return {
        ok: false,
        error: {
          code: "internal",
          message: reason instanceof Error ? reason.message : String(reason),
          details: {}
        }
      };
    }
  }, { authority: "loopback" });
}
export {
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
