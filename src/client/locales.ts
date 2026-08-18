import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'

export const PROJECTLESS_LOCALE_NS = 'projectless-session'

export const zh = {
  'picker.projectless': '无工作区会话',
  'picker.addWorkspace': '添加工作区…',
  'modal.createFailed': '无法创建无工作区会话',
  'modal.close': '知道了',
} as const

export type ProjectlessLocaleKey = keyof typeof zh

export const en: Record<ProjectlessLocaleKey, string> = {
  'picker.projectless': 'Session without workspace',
  'picker.addWorkspace': 'Add workspace…',
  'modal.createFailed': 'Could not create session without workspace',
  'modal.close': 'Got it',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Projectless-session picker and error copy. */
    'projectless-session': ProjectlessLocaleKey
  }
}

/** Typed bilingual dictionaries consumed by the DSH locale runtime. */
export const projectlessLocales: Record<'zh' | 'en', LocaleDictOf<typeof PROJECTLESS_LOCALE_NS>> = {
  zh,
  en,
}
