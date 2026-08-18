import assert from 'node:assert/strict'
import test from 'node:test'
import { en, zh } from '../src/client/locales.ts'

test('ships complete non-empty Chinese and English dictionaries', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())
  for (const [locale, dictionary] of Object.entries({ zh, en })) {
    for (const [key, value] of Object.entries(dictionary)) {
      assert.notEqual(value.trim(), '', `${locale}:${key} must not be blank`)
    }
  }
})
