/// <reference types="vitest" />

import {defaultExclude, defineProject} from 'vitest/config'

// Configure Vitest (https://vitest.dev/config/)

export default defineProject({
  test: {
    environment: 'node',
    exclude: [
      ...defaultExclude,
      '**/{dist}/**',
      '**/*.config.*',
      '**/{vitest}.setup.*'
    ],
    clearMocks: true,
    restoreMocks: true
  }
})
