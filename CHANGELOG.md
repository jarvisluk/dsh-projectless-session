# Changelog

## 0.6.0 - 2026-09-29

- Update all DSH client packages for DeepSeek Harness `0.2.0-rc.2`.
- Replace the removed `dsh-client-runtime` faces with the split
  `ctx.workspaces` (Workspace Controller), `ctx.sessions` (Session
  Controller) and `ctx.uiWorkspace` (blank-Session connection, navigation and
  archival) services.
- Detect the open Session through its `mainView` reference now that the
  Session list no longer carries a `current` field, and wait for the Workspace
  list `phase` before sweeping leftovers.
- Use the renamed `*Regular` primitive icons.
- Serve the Host endpoints as exact Fetch routes on the authenticated `/api`
  channel: DSH `0.2.0-rc.2`'s `connection.rpc.handle` resolves `webServer` on
  the Connection plugin's own fiber and cannot mount third-party channels.
- Mirror DSH's hero directory-flow occupant into the picker's own hole, since
  a hole can now be declared by only one entry and the built-in picker owns
  `conversation.hero.workspace.directoryFlow`.

## 0.5.0 - 2026-09-14

- Update all DSH client packages for DeepSeek Harness `0.1.5-rc.2`.
- Compose with the new Workspace Picker directory-flow slot so native and
  browser directory pickers remain available.
- Adopt the authenticated Connection RPC registration API and dispose the
  projectless-session channel when the plugin unloads.

## 0.4.2 - 2026-08-26

- Keep the Workspace picker selected on **Session without workspace** while a
  projectless blank session is active.
- Hide temporary projectless directories from the Workspace list.
- Reclaim abandoned blank sessions without racing session creation.
- Refresh the English and Simplified Chinese screenshots.

## 0.4.0 - 2026-08-18

- Preserve completed projectless sessions under **Ungrouped** while removing
  only their temporary Workspace registrations.
- Archive unused blank sessions and remove their empty temporary directories.
- Keep the native DSH blank-session composer available before the first prompt.
