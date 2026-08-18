import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'

export const PROJECTLESS_LOCALE_NS = 'projectless-session'

export const zh = {
  'picker.projectless': '无工作区会话',
  'picker.addWorkspace': '添加工作区…',
  'modal.createFailed': '无法创建无工作区会话',
  'modal.close': '知道了',
  'composer.headline': '探索未至之境',
  'composer.preview': '预览版',
  'composer.projectless': '无工作区会话',
  'composer.placeholder': '描述你想要构建的内容',
  'composer.send': '发送消息',
  'composer.firstPromptHint': '首条消息发送后进入标准会话界面',
  'error.unsupportedSessionRuntime': '当前 DSH 版本不支持直接创建指定 cwd 的 Session',
} as const

export type ProjectlessLocaleKey = keyof typeof zh

export const en: Record<ProjectlessLocaleKey, string> = {
  'picker.projectless': 'Session without workspace',
  'picker.addWorkspace': 'Add workspace…',
  'modal.createFailed': 'Could not create session without workspace',
  'modal.close': 'Got it',
  'composer.headline': 'Into the Unknown',
  'composer.preview': 'Preview',
  'composer.projectless': 'Session without workspace',
  'composer.placeholder': 'Describe what you want to build',
  'composer.send': 'Send message',
  'composer.firstPromptHint': 'The standard conversation view opens after your first message',
  'error.unsupportedSessionRuntime': 'This DSH version cannot create a Session with an explicit cwd',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Projectless-session picker, first-prompt composer, and error copy. */
    'projectless-session': ProjectlessLocaleKey
  }
}

/** Typed bilingual dictionaries consumed by the DSH locale runtime. */
export const projectlessLocales: Record<'zh' | 'en', LocaleDictOf<typeof PROJECTLESS_LOCALE_NS>> = {
  zh,
  en,
}
