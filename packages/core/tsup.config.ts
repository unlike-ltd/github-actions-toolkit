// @ts-check

import type {Options} from 'tsup'

import {defineConfig} from 'tsup'

export default defineConfig(() => {
  const common: Options = {
    entry: ['src/index.ts'],
    bundle: true,
    clean: true,
    keepNames: true,
    minify: false,
    minifyWhitespace: false,
    sourcemap: true,
    /**
     * legacyOutput outputs to different folders
     */
    // legacyOutput: true,
    splitting: false,
    treeshake: false,
    dts: true,
    platform: 'node',
    target: 'node16.20.0',
    shims: true
  }

  const esm: Options = {
    ...common,
    format: 'esm',
    outDir: './dist'
  }

  const cjs: Options = {
    ...common,
    format: 'cjs',
    outDir: './dist'
  }

  return [esm, cjs]
})
