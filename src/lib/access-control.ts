/**
 * Lazily import the Prisma client so this module stays edge-safe.
 *
 * access-control is reachable from the edge middleware
 * (middleware → auth-session → auth → access-control). A static `import { db }`
 * pulls in the Prisma 7 `pg` driver adapter, which evaluates Node-only APIs
 * (`node:util/types`) at module load and crashes the edge runtime. These
 * functions only ever run in the Node runtime, so the dynamic import never
 * executes under edge.
 */
async function getDb() {
	return (await import('./db')).db;
}

export async function checkUserAccess(email: string): Promise<boolean> {
	if (!email) {
		return false;
	}

	const db = await getDb();

	// Check direct email match
	const emailAccess = await db.accessList.findFirst({
		where: {
			type: 'EMAIL',
			value: email.toLowerCase(),
		},
	});

	if (emailAccess) {
		return true;
	}

	// Check domain match
	const domain = email.split('@')[1];
	if (!domain) {
		return false;
	}

	const domainAccess = await db.accessList.findFirst({
		where: {
			type: 'DOMAIN',
			value: `@${domain}`,
		},
	});

	return !!domainAccess;
}

export async function getUserRoleFromAccessList(
	email: string,
): Promise<'ADMIN' | 'DEVELOPER'> {
	if (!email) {
		return 'DEVELOPER';
	}

	const db = await getDb();

	// Check email first (more specific)
	const emailAccess = await db.accessList.findFirst({
		where: {
			type: 'EMAIL',
			value: email.toLowerCase(),
		},
	});

	if (emailAccess) {
		return emailAccess.role;
	}

	// Check domain
	const domain = email.split('@')[1];
	if (domain) {
		const domainAccess = await db.accessList.findFirst({
			where: {
				type: 'DOMAIN',
				value: `@${domain}`,
			},
		});

		if (domainAccess) {
			return domainAccess.role;
		}
	}

	return 'DEVELOPER';
}

/**
 * True only on a genuinely fresh install: no `User` row AND no `AccessList`
 * entry exists yet.
 *
 * Checking `User.count()` alone is not enough — `bootstrapFirstProxyAdmin`
 * (proxy mode) populates the `AccessList` without ever writing a `User` row,
 * which is a normal, supported state. If this only checked the `User` table,
 * a proxy-bootstrapped install later switched to `AUTH_MODE=oidc` would let
 * the first arbitrary OIDC identity bypass the access list (`signIn` in
 * auth.ts) and get minted ADMIN, even though an admin was already
 * provisioned. Requiring both tables empty keeps the two bootstrap paths
 * mutually exclusive: whichever mode bootstraps first "claims" the instance.
 */
export async function isFirstUser(): Promise<boolean> {
	const db = await getDb();
	const [userCount, accessListCount] = await Promise.all([
		db.user.count(),
		db.accessList.count(),
	]);
	return userCount === 0 && accessListCount === 0;
}

export async function createOrUpdateUser(userData: {
	id?: string;
	email: string;
	name?: string | null;
	image?: string | null;
}): Promise<{ id: string; role: 'ADMIN' | 'DEVELOPER' }> {
	const { email, name, image } = userData;

	const db = await getDb();

	// Check if this is the first user
	const firstUser = await isFirstUser();

	// Determine role
	let role: 'ADMIN' | 'DEVELOPER';
	if (firstUser) {
		// First user is always admin
		role = 'ADMIN';
	} else {
		// Get role from access list
		role = await getUserRoleFromAccessList(email);
	}

	// Create or update user
	const user = await db.user.upsert({
		where: { email: email.toLowerCase() },
		update: {
			name,
			image,
			role,
			lastActiveAt: new Date(),
		},
		create: {
			email: email.toLowerCase(),
			name,
			image,
			role,
			lastActiveAt: new Date(),
		},
	});

	// Persist the bootstrapped first admin into the access list. Subsequent
	// sign-ins are authorized against the access list (not the first-user rule),
	// so without this the very first admin would be locked out on their next
	// login once a user row exists.
	if (firstUser) {
		await db.accessList.upsert({
			where: { type_value: { type: 'EMAIL', value: email.toLowerCase() } },
			update: {},
			create: { type: 'EMAIL', value: email.toLowerCase(), role: 'ADMIN' },
		});
	}

	return {
		id: user.id,
		role: user.role,
	};
}

/**
 * First-admin bootstrap for `AUTH_MODE=proxy`.
 *
 * Proxy mode has no NextAuth sign-in event to hook the OIDC bootstrap
 * (`createOrUpdateUser`) into, and deliberately never writes `User` rows for
 * proxy-authenticated requests — a header-authenticated request isn't a
 * "sign-in", it's just a request. So this mirrors the OIDC bootstrap's
 * *outcome* (first authenticated identity becomes ADMIN) using the
 * `AccessList` alone, which proxy mode already treats as its source of
 * truth for roles.
 *
 * Only fires when the access list is completely empty AND no ADMIN `User`
 * row exists (covers a mixed oidc/proxy deployment where an OIDC admin
 * already bootstrapped but, e.g., their access-list row was later removed —
 * we still must not mint a second, different admin here).
 *
 * Race-safe: the emptiness check and insert happen inside one transaction
 * serialized by a Postgres advisory lock (same technique as the publish
 * route's version reservation), so two concurrent first requests can't both
 * observe "empty" and both insert.
 *
 * Called via `actorFromHeaders` on every proxy request that doesn't already
 * resolve ADMIN from the access list — i.e. every proxy-mode mutation on a
 * long-lived instance, forever, not just the very first one. Taking the
 * advisory lock is only free while it's actually contested; on a seeded
 * instance it would otherwise serialize all of those requests on one lock
 * for no reason. So an unlocked pre-check runs first: once either table is
 * non-empty, this returns without ever opening a transaction. The locked
 * re-check inside the transaction remains the source of truth for the
 * actual bootstrap decision — the pre-check can only produce false
 * negatives-into-the-lock (a benign extra lock acquisition on a concurrent
 * first request), never a false "empty" that skips the lock.
 */
export async function bootstrapFirstProxyAdmin(
	email: string,
): Promise<'ADMIN' | null> {
	const db = await getDb();
	const normalizedEmail = email.toLowerCase();

	const [precheckAccessListCount, precheckAdminUserCount] = await Promise.all([
		db.accessList.count(),
		db.user.count({ where: { role: 'ADMIN' } }),
	]);
	if (precheckAccessListCount > 0 || precheckAdminUserCount > 0) {
		return null;
	}

	return db.$transaction(async (tx) => {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('bunting_proxy_first_admin_bootstrap'))`;

		const [accessListCount, adminUserCount] = await Promise.all([
			tx.accessList.count(),
			tx.user.count({ where: { role: 'ADMIN' } }),
		]);
		if (accessListCount > 0 || adminUserCount > 0) {
			return null;
		}

		await tx.accessList.create({
			data: { type: 'EMAIL', value: normalizedEmail, role: 'ADMIN' },
		});
		return 'ADMIN';
	});
}

export async function updateUserActivity(userId: string): Promise<void> {
	try {
		const db = await getDb();
		await db.user.update({
			where: { id: userId },
			data: { lastActiveAt: new Date() },
		});
	} catch (error) {
		// This module is reachable from edge middleware (via auth → auth-session),
		// so it must not statically import the pino logger or the Prisma client
		// (both are Node-only). Use console; `db` is imported lazily via getDb().
		console.error('Failed to update user activity:', error);
		// Don't throw - this is not critical
	}
}
