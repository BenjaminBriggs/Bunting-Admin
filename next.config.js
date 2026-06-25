const isProd = process.env.NODE_ENV === 'production';

// MUI/emotion inject inline styles, so style-src needs 'unsafe-inline'.
// Next.js needs 'unsafe-eval' for its dev runtime; production does not.
const csp = [
	"default-src 'self'",
	`script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob:",
	"font-src 'self' data:",
	"connect-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
	{ key: 'Content-Security-Policy', value: csp },
	{ key: 'X-Frame-Options', value: 'DENY' },
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	{
		key: 'Permissions-Policy',
		value: 'camera=(), microphone=(), geolocation=()',
	},
	// HSTS only in production (avoid pinning HTTPS on localhost dev).
	...(isProd
		? [
				{
					key: 'Strict-Transport-Security',
					value: 'max-age=63072000; includeSubDomains; preload',
				},
			]
		: []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
	// Emit a self-contained server for the production Docker image.
	output: 'standalone',
	// Next 16 removed the `next lint` command and the `eslint` config key; ESLint
	// now runs standalone via `pnpm run lint`.
	typescript: {
		ignoreBuildErrors: false,
	},
	// Fix Next.js workspace root detection warning
	outputFileTracingRoot: __dirname,
	async headers() {
		return [{ source: '/:path*', headers: securityHeaders }];
	},
};

module.exports = nextConfig;
