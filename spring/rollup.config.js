import esbuild from 'rollup-plugin-esbuild'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import dts from 'rollup-plugin-dts'
import pkg from './package.json' assert { type: 'json' }

const entry = ['src/index.ts']

const external = [
  ...Object.keys(pkg.dependencies || []),
  ...Object.keys(pkg.peerDependencies || []),
  'worker_threads',
  'esbuild',
  'solid-js',
  'solid-js/web',
  'fs/promises',
]

export default [
  {
    input: entry,
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [
      alias({
        entries: [{ find: /^node:(.+)$/, replacement: '$1' }],
      }),
      resolve({
        preferBuiltins: true,
      }),
      json(),
      commonjs(),
      esbuild({
        define: {
          'import.meta.vitest': 'false',
        },
        target: 'node14',
      }),
    ],
  },
  {
    input: ['src/index.ts'],
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    external,
    plugins: [dts()],
  },
]
