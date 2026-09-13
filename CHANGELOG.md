# Changelog

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
