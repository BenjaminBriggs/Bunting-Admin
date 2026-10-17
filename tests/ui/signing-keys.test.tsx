/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react';
import { DeleteAppDialog } from '@/components/settings/DeleteAppDialog';
import { SigningKeysCard } from '@/components/settings/SigningKeys';
import type { App, SigningKeyInfo } from '@/lib/api';

const mockSetSigningKeyStatus = jest.fn<Promise<void>, unknown[]>();
const mockDeleteApp = jest.fn<Promise<void>, unknown[]>();
const mockExportSigningKey = jest.fn<Promise<void>, unknown[]>();

jest.mock('@/lib/api', () => ({
	setSigningKeyStatus: (...args: unknown[]) => mockSetSigningKeyStatus(...args),
	deleteApp: (...args: unknown[]) => mockDeleteApp(...args),
	exportSigningKey: (...args: unknown[]) => mockExportSigningKey(...args),
	createStandbySigningKey: jest.fn(),
	deleteSigningKey: jest.fn(),
	fetchSigningKeys: jest.fn(),
	importSigningKey: jest.fn(),
}));

const key = (
	kid: string,
	status: SigningKeyInfo['status'],
): SigningKeyInfo => ({
	id: `id-${kid}`,
	kid,
	publicKey: 'pem',
	algorithm: 'RS256',
	status,
	createdAt: '2026-10-01T00:00:00.000Z',
});

const KEYS = [
	key('a'.repeat(32), 'ACTIVE'),
	key('b'.repeat(32), 'STANDBY'),
	key('c'.repeat(32), 'RETIRED'),
];

// kid text -> its column -> the key row.
function row(kid: string): HTMLElement {
	return screen.getByText(kid).parentElement!.parentElement!;
}

beforeEach(() => {
	mockSetSigningKeyStatus.mockReset().mockResolvedValue(undefined);
	mockDeleteApp.mockReset().mockResolvedValue(undefined);
	mockExportSigningKey.mockReset().mockResolvedValue(undefined);
});

describe('SigningKeysCard', () => {
	test('offers only the transitions each status allows', () => {
		render(
			<SigningKeysCard
				appId="app-1"
				isAdmin
				keys={KEYS}
				loading={false}
				error={null}
				reload={() => Promise.resolve()}
			/>,
		);

		const names = (kid: string) =>
			within(row(kid))
				.queryAllByRole('button')
				.map((b) => b.textContent);
		expect(names('a'.repeat(32))).toEqual(['Export']);
		expect(names('b'.repeat(32))).toEqual(['Activate', 'Retire', 'Export']);
		expect(names('c'.repeat(32))).toEqual(['Delete', 'Export']);
		expect(screen.getByText(/2 trusted keys in new/)).toBeInTheDocument();
		expect(screen.queryByText(/no standby key/i)).not.toBeInTheDocument();
	});

	test('hides key actions from non-admins', () => {
		render(
			<SigningKeysCard
				appId="app-1"
				isAdmin={false}
				keys={KEYS}
				loading={false}
				error={null}
				reload={() => Promise.resolve()}
			/>,
		);
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
		expect(
			screen.getByText(/Only admins can manage signing keys/),
		).toBeInTheDocument();
	});

	test('warns when there is no standby key to rotate to', () => {
		render(
			<SigningKeysCard
				appId="app-1"
				isAdmin
				keys={[KEYS[0]]}
				loading={false}
				error={null}
				reload={() => Promise.resolve()}
			/>,
		);
		expect(screen.getByText(/no standby key/i)).toBeInTheDocument();
	});

	test('retiring asks for confirmation before calling the API', async () => {
		const reload = jest.fn(() => Promise.resolve());
		render(
			<SigningKeysCard
				appId="app-1"
				isAdmin
				keys={KEYS}
				loading={false}
				error={null}
				reload={reload}
			/>,
		);

		fireEvent.click(within(row('b'.repeat(32))).getByText('Retire'));
		const dialog = await screen.findByRole('dialog');
		expect(dialog).toHaveTextContent(/can never be activated again/);
		expect(mockSetSigningKeyStatus).not.toHaveBeenCalled();

		fireEvent.click(within(dialog).getByRole('button', { name: 'Retire key' }));
		await waitFor(() =>
			expect(mockSetSigningKeyStatus).toHaveBeenCalledWith(
				'app-1',
				'b'.repeat(32),
				'RETIRED',
			),
		);
		await waitFor(() => expect(reload).toHaveBeenCalled());
	});

	test('export requires a confirmed passphrase of at least 12 characters', async () => {
		render(
			<SigningKeysCard
				appId="app-1"
				isAdmin
				keys={KEYS}
				loading={false}
				error={null}
				reload={() => Promise.resolve()}
			/>,
		);
		fireEvent.click(within(row('a'.repeat(32))).getByText('Export'));
		const dialog = await screen.findByRole('dialog');
		const download = within(dialog).getByRole('button', {
			name: 'Download key file',
		});
		const [pass, confirm] = within(dialog).getAllByLabelText(/passphrase/i);

		fireEvent.change(pass, { target: { value: 'short' } });
		fireEvent.change(confirm, { target: { value: 'short' } });
		expect(download).toBeDisabled();

		fireEvent.change(pass, { target: { value: 'long enough passphrase' } });
		fireEvent.change(confirm, { target: { value: 'long enough passphrasX' } });
		expect(download).toBeDisabled();

		fireEvent.change(confirm, { target: { value: 'long enough passphrase' } });
		expect(download).toBeEnabled();
		fireEvent.click(download);
		await waitFor(() =>
			expect(mockExportSigningKey).toHaveBeenCalledWith(
				'a'.repeat(32),
				'long enough passphrase',
			),
		);
	});
});

describe('DeleteAppDialog', () => {
	const app = {
		id: 'app-1',
		name: 'Painting Desk',
		identifier: 'painting-desk',
	} as App;

	test('needs the typed identifier and, with keys, the acknowledgment', async () => {
		const onDeleted = jest.fn(() => Promise.resolve());
		render(
			<DeleteAppDialog
				app={app}
				keys={KEYS}
				onClose={() => undefined}
				onDeleted={onDeleted}
			/>,
		);
		const dialog = screen.getByRole('dialog');
		const del = within(dialog).getByRole('button', {
			name: 'Delete application',
		});
		expect(dialog).toHaveTextContent(/This app has 3 signing keys/);
		expect(
			within(dialog).getAllByRole('button', { name: 'Export' }),
		).toHaveLength(3);

		fireEvent.change(within(dialog).getByLabelText(/Type painting-desk/), {
			target: { value: 'painting-desk' },
		});
		expect(del).toBeDisabled();

		fireEvent.click(within(dialog).getByRole('checkbox'));
		expect(del).toBeEnabled();

		fireEvent.click(del);
		await waitFor(() =>
			expect(mockDeleteApp).toHaveBeenCalledWith(
				'app-1',
				'painting-desk',
				true,
			),
		);
		await waitFor(() => expect(onDeleted).toHaveBeenCalled());
	});

	test('an app without keys only needs the typed identifier', async () => {
		render(
			<DeleteAppDialog
				app={app}
				keys={[]}
				onClose={() => undefined}
				onDeleted={() => Promise.resolve()}
			/>,
		);
		const dialog = screen.getByRole('dialog');
		expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
		const del = within(dialog).getByRole('button', {
			name: 'Delete application',
		});
		fireEvent.change(within(dialog).getByLabelText(/Type painting-desk/), {
			target: { value: 'painting-des' },
		});
		expect(del).toBeDisabled();
		fireEvent.change(within(dialog).getByLabelText(/Type painting-desk/), {
			target: { value: 'painting-desk' },
		});
		fireEvent.click(del);
		await waitFor(() =>
			expect(mockDeleteApp).toHaveBeenCalledWith(
				'app-1',
				'painting-desk',
				false,
			),
		);
	});
});
