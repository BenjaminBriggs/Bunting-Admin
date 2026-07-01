type Role = 'ADMIN' | 'DEVELOPER';

const mockExecuteRaw = jest.fn<Promise<unknown>, unknown[]>();
const mockAccessListCount = jest.fn<Promise<number>, unknown[]>();
const mockAccessListCreate = jest.fn<Promise<unknown>, unknown[]>();
const mockUserCount = jest.fn<Promise<number>, unknown[]>();

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
	},
}));

// Imported after the jest.mock call so the mocked dependency registers first.
// eslint-disable-next-line import/first -- jest.mock must register before import
import { bootstrapFirstProxyAdmin } from '@/lib/access-control';

beforeEach(() => {
	mockExecuteRaw.mockReset();
	mockAccessListCount.mockReset();
	mockAccessListCreate.mockReset();
	mockUserCount.mockReset();
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

	it('serializes the check-and-insert behind an advisory lock (race-safety)', async () => {
		mockAccessListCount.mockResolvedValue(0);
		mockUserCount.mockResolvedValue(0);
		mockAccessListCreate.mockResolvedValue({});

		await bootstrapFirstProxyAdmin('first@x.com');

		expect(mockTransaction).toHaveBeenCalledTimes(1);
		// The lock must be taken before the emptiness check, inside the same
		// transaction, so a second concurrent caller blocks until the first
		// caller's insert (or no-op) has committed.
		const executeOrder = mockExecuteRaw.mock.invocationCallOrder[0];
		const countOrder = mockAccessListCount.mock.invocationCallOrder[0];
		expect(executeOrder).toBeLessThan(countOrder);
	});
});
