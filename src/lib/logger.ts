/**
 * Structured application logger (server-side only).
 *
 * Emits leveled JSON to stdout — parseable by any log aggregator (CloudWatch,
 * Loki, Datadog, etc.). There is no external service or vendor SDK; self-hosters
 * get structured logs out of the box and can ship them wherever they like.
 *
 * Do NOT import this from client components — pino is a Node module. Browser-side
 * logging should keep using `console.*`.
 *
 * Level is controlled by `LOG_LEVEL` (trace|debug|info|warn|error|fatal),
 * defaulting to `info` in production and `debug` otherwise.
 *
 * Usage:
 *   logger.info({ route: '/api/flags', actor }, 'flag created');
 *   logger.error({ err, route }, 'failed to create flag');
 *
 * Pass an `err` field (an Error) so the serializer expands message + stack.
 */
import pino from 'pino';

const level =
	process.env.LOG_LEVEL ??
	(process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = pino({
	level,
	// Redact anything that could carry secrets if it ever lands in a log binding.
	redact: {
		paths: [
			'password',
			'secret',
			'token',
			'privateKey',
			'authorization',
			'*.password',
			'*.secret',
			'*.token',
			'*.privateKey',
		],
		censor: '[redacted]',
	},
});

/** Convenience child logger scoped to an API route. */
export function routeLogger(route: string) {
	return logger.child({ route });
}
