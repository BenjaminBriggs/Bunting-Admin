/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    dirs: ['src'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Fix Next.js workspace root detection warning
  outputFileTracingRoot: __dirname,
  // MUI works well with Next.js without special configuration
}

module.exports = nextConfig