import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  {
    rules: {
      // Match repo style: we sometimes use `unknown` payloads.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow {} as a non-restrictive type in a few spots.
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
]
