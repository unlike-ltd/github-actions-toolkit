// @ts-check

import type {Options} from 'tsup'

import {defineConfig} from 'tsup'

export default defineConfig(() => {
  const common: Options = {
    entry: ['src'],
    bundle: false,
    clean: true,
    keepNames: true,
    minify: false,
    minifyWhitespace: false,
    sourcemap: true,
    splitting: false,
    treeshake: false,
    dts: true,
    platform: 'node',
    target: 'node18.16.1',
    shims: true
  }

  const esm: Options = {
    ...common,
    format: 'esm',
    outDir: './dist'
  }

  return [esm]
})
