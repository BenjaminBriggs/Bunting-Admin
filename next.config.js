/** @type {import('next').NextConfig} */
const nextConfig = {
	// Emit a self-contained server for the production Docker image.
	output: 'standalone',
	eslint: {
		dirs: ['src'],
	},
	typescript: {
		ignoreBuildErrors: false,
	},
	// Fix Next.js workspace root detection warning
	outputFileTracingRoot: __dirname,
	// MUI works well with Next.js without special configuration
};

module.exports = nextConfig;
