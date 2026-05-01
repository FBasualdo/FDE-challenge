import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `standalone` produces a self-contained server bundle in `.next/standalone/`
  // for the multi-stage Docker build (Railway-friendly).
  output: 'standalone',
}

export default nextConfig
