# Contributing

Requirements:

- Node.js 22.19 or newer
- DeepSeek Harness 0.1.0-rc.6 for integration checks

Install and verify:

```bash
npm ci
npm run verify
```

Keep the generated `lib/` artifacts in sync with `src/`. Before opening a pull
request, run `npm run verify` and commit any resulting `lib/` changes.

For UI changes, verify these transitions in an isolated DSH Web profile:

1. The Workspace menu contains “无工作区会话”.
2. The blank Session remains writable before its first prompt.
3. After the first accepted prompt, the Session moves to “未分组”.
4. After a DSH restart, the Session can be reopened and continued.
5. Clicking “无工作区会话” without sending, then switching away, removes the
   temporary Workspace from the picker and deletes its empty directory.

Do not weaken the loopback authority on the filesystem RPC without adding a
real authentication and authorization boundary.
