type Role = 'ADMIN' | 'DEVELOPER';

const mockExecuteRaw = jest.fn<Promise<unknown>, unknown[]>();
const mockAccessListCount = jest.fn<Promise<number>, unknown[]>();
const mockAccessListCreate = jest.fn<Promise<unknown>, unknown[]>();
const mockUserCount = jest.fn<Promise<number>, unknown[]>();
const mockAccessListFindFirst = jest.fn<
	Promise<{ role: Role } | null>,
	unknown[]
>();
const mockAccessListUpsert = jest.fn<Promise<unknown>, unknown[]>();
const mockUserUpsert = jest.fn<
	Promise<{ id: string; role: Role }>,
	unknown[]
>();

interface TxStub {
	$executeRaw: (...args: unknown[]) => Promise<unknown>;
	accessList: {
		count: (...args: unknown[]) => Promise<number>;
		create: (...args: unknown[]) => Promise<unknown>;
	};
	user: {
		count: (...args: unknown[]) => Promise<number>;
	};
}

const txStub: TxStub = {
	$executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
	accessList: {
		count: (...args: unknown[]) => mockAccessListCount(...args),
		create: (...args: unknown[]) => mockAccessListCreate(...args),
	},
	user: {
		count: (...args: unknown[]) => mockUserCount(...args),
	},
};

const mockTransaction = jest.fn(async (cb: (tx: TxStub) => Promise<unknown>) =>
	cb(txStub),
);

jest.mock('@/lib/db', () => ({
	db: {
		$transaction: (cb: (tx: TxStub) => Promise<unknown>) => mockTransaction(cb),
		accessList: {
			count: (...args: unknown[]) => mockAccessListCount(...args),
			findFirst: (...args: unknown[]) => mockAccessListFindFirst(...args),
			upsert: (...args: unknown[]) => mockAccessListUpsert(...args),
		},
		user: {
			count: (...args: unknown[]) => mockUserCount(...args),
			upsert: (...args: unknown[]) => mockUserUpsert(...args),
		},
	},
}));

// Imported after the jest.mock call so the mocked dependency registers first.
// eslint-disable-next-line import/first -- jest.mock must register before import
import {
	bootstrapFirstProxyAdmin,
	createOrUpdateUser,
	isFirstUser,
} from '@/lib/access-control';

beforeEach(() => {
	mockExecuteRaw.mockReset();
	mockAccessListCount.mockReset();
	mockAccessListCreate.mockReset();
	mockUserCount.mockReset();
	mockAccessListFindFirst.mockReset();
	mockAccessListUpsert.mockReset();
	mockUserUpsert.mockReset();
	mockTransaction.mockClear();
});

describe('bootstrapFirstProxyAdmin', () => {
	it('grants ADMIN via the access list when both the access list and admin users are empty', async () => {
		mockAccessListCount.mockResolvedValue(0);
		mockUserCount.mockResolvedValue(0);
		mockAccessListCreate.mockResolvedValue({});

		const role: Role | null = await bootstrapFirstProxyAdmin('First@X.com');

		expect(role).toBe('ADMIN');
		expect(mockExecuteRaw).toHaveBeenCalled();
		expect(mockAccessListCreate).toHaveBeenCalledWith({
			data: { type: 'EMAIL', value: 'first@x.com', role: 'ADMIN' },
		});
	});

	it('does not bootstrap when the access list already has entries', async () => {
		mockAccessListCount.mockResolvedValue(1);
		mockUserCount.mockResolvedValue(0);

		const role = await bootstrapFirstProxyAdmin('second@x.com');

		expect(role).toBeNull();
		expect(mockAccessListCreate).not.toHaveBeenCalled();
	});

	it('does not bootstrap when an ADMIN user already exists (mixed oidc/proxy deployment)', async () => {
		mockAccessListCount.mockResolvedValue(0);
		mockUserCount.mockResolvedValue(1);

		const role = await bootstrapFirstProxyAdmin('second@x.com');

		expect(role).toBeNull();
		expect(mockAccessListCreate).not.toHaveBeenCalled();
	});

	// Fast path: on a long-lived instance this runs on every proxy access-list
	// miss (every proxy-mode mutation, per actorFromHeaders). Once seeded, it
	// must decline WITHOUT taking the global advisory lock — otherwise every
	// such request serializes on one lock forever.
	it('declines via the unlocked pre-check, without opening the locked transaction, once the access list is seeded', async () => {
		mockAccessListCount.mockResolvedValue(1);
		mockUserCount.mockResolvedValue(0);

		const role = await bootstrapFirstProxyAdmin('second@x.com');

		expect(role).toBeNull();
		expect(mockTransaction).not.toHaveBeenCalled();
	});

	it('declines via the unlocked pre-check when an ADMIN user already exists, without opening the locked transaction', async () => {
		mockAccessListCount.mockResolvedValue(0);
		mockUserCount.mockResolvedValue(1);

		const role = await bootstrapFirstProxyAdmin('second@x.com');

		expect(role).toBeNull();
		expect(mockTransaction).not.toHaveBeenCalled();
	});

	it('still takes the locked transaction when the unlocked pre-check finds it possibly empty', async () => {
		mockAccessListCount.mockResolvedValue(0);
		mockUserCount.mockResolvedValue(0);
		mockAccessListCreate.mockResolvedValue({});

		const role = await bootstrapFirstProxyAdmin('first@x.com');

		expect(role).toBe('ADMIN');
		expect(mockTransaction).toHaveBeenCalledTimes(1);
	});

	it('serializes the check-and-insert behind an advisory lock (race-safety)', async () => {
		mockAccessListCount.mockResolvedValue(0);
		mockUserCount.mockResolvedValue(0);
		mockAccessListCreate.mockResolvedValue({});

		await bootstrapFirstProxyAdmin('first@x.com');

		expect(mockTransaction).toHaveBeenCalledTimes(1);
		// The unlocked pre-check runs first (call index 0); the lock must be
		// taken before the *re-check* inside the transaction (call index 1), so
		// a second concurrent caller blocks until the first caller's insert (or
		// no-op) has committed.
		expect(mockAccessListCount).toHaveBeenCalledTimes(2);
		const executeOrder = mockExecuteRaw.mock.invocationCallOrder[0];
		const recheckOrder = mockAccessListCount.mock.invocationCallOrder[1];
		expect(executeOrder).toBeLessThan(recheckOrder);
	});
});

describe('isFirstUser', () => {
	it('is true when both the user table and access list are empty', async () => {
		mockUserCount.mockResolvedValue(0);
		mockAccessListCount.mockResolvedValue(0);

		expect(await isFirstUser()).toBe(true);
	});

	// Regression: a proxy-bootstrapped install (AccessList populated via
	// bootstrapFirstProxyAdmin) switched to AUTH_MODE=oidc must not let an
	// arbitrary first OIDC identity bypass the access list and get minted
	// ADMIN just because the User table happens to be empty.
	it('is false when the user table is empty but the access list is already populated', async () => {
		mockUserCount.mockResolvedValue(0);
		mockAccessListCount.mockResolvedValue(1);

		expect(await isFirstUser()).toBe(false);
	});

	it('is false when the user table is non-empty, regardless of the access list', async () => {
		mockUserCount.mockResolvedValue(1);
		mockAccessListCount.mockResolvedValue(0);

		expect(await isFirstUser()).toBe(false);
	});
});

describe('createOrUpdateUser — proxy-then-oidc regression', () => {
	it('assigns the role from the access list, not blind ADMIN, when the access list is already populated (User table empty)', async () => {
		mockUserCount.mockResolvedValue(0);
		mockAccessListCount.mockResolvedValue(1);
		mockAccessListFindFirst.mockResolvedValue({ role: 'DEVELOPER' });
		mockUserUpsert.mockResolvedValue({ id: 'u1', role: 'DEVELOPER' });

		const result = await createOrUpdateUser({ email: 'late-oidc@x.com' });

		expect(result.role).toBe('DEVELOPER');
		const upsertArg = mockUserUpsert.mock.calls[0]?.[0] as {
			create: { role: Role };
		};
		expect(upsertArg.create.role).toBe('DEVELOPER');
		// Must not re-seed the access list as if this were the first admin.
		expect(mockAccessListUpsert).not.toHaveBeenCalled();
	});

	it('still bootstraps ADMIN on a genuinely fresh install (both tables empty)', async () => {
		mockUserCount.mockResolvedValue(0);
		mockAccessListCount.mockResolvedValue(0);
		mockUserUpsert.mockResolvedValue({ id: 'u1', role: 'ADMIN' });
		mockAccessListUpsert.mockResolvedValue({});

		const result = await createOrUpdateUser({ email: 'genuinely-first@x.com' });

		expect(result.role).toBe('ADMIN');
		expect(mockAccessListUpsert).toHaveBeenCalled();
	});
});
