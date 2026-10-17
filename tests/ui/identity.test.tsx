/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HomePage from '@/app/page';
import SetupPage from '@/app/setup/app/page';
import { UserMenu } from '@/components/layout/UserMenu';
import type { CurrentUser } from '@/lib/api';

// Client identity comes from GET /api/me (via fetchCurrentUser), never from the
// NextAuth client session, so proxy auth mode works. Mock that one seam.
const mockFetchCurrentUser = jest.fn<Promise<CurrentUser | null>, []>();
jest.mock('@/lib/api', () => ({
	fetchCurrentUser: () => mockFetchCurrentUser(),
	createApp: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
	useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

// Fail loudly if anything still reads the NextAuth client session.
jest.mock('next-auth/react', () => ({
	useSession: () => {
		throw new Error('useSession must not be used for client identity');
	},
}));

const proxyAdmin: CurrentUser = {
	email: 'admin@example.com',
	role: 'ADMIN',
	name: null,
	image: null,
	authMode: 'proxy',
};

beforeEach(() => {
	mockFetchCurrentUser.mockReset();
	mockReplace.mockReset();
});

describe('HomePage', () => {
	test('sends an unauthenticated caller (401) to sign-in', async () => {
		mockFetchCurrentUser.mockResolvedValue(null);
		render(<HomePage />);
		await waitFor(() =>
			expect(mockReplace).toHaveBeenCalledWith('/auth/signin'),
		);
	});

	test('sends a proxy-mode caller to the dashboard, not sign-in', async () => {
		mockFetchCurrentUser.mockResolvedValue(proxyAdmin);
		render(<HomePage />);
		await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
		expect(mockReplace).not.toHaveBeenCalledWith('/auth/signin');
	});

	test('shows an error instead of redirecting when /api/me fails', async () => {
		mockFetchCurrentUser.mockRejectedValue(new Error('Database unavailable'));
		render(<HomePage />);
		expect(
			await screen.findByText(
				/Could not load your account: Database unavailable/,
			),
		).toBeInTheDocument();
		expect(mockReplace).not.toHaveBeenCalled();
	});
});

describe('SetupPage', () => {
	test('renders for a proxy-mode caller without redirecting', async () => {
		mockFetchCurrentUser.mockResolvedValue(proxyAdmin);
		render(<SetupPage />);
		expect(
			await screen.findByText('Create your first application'),
		).toBeInTheDocument();
		expect(mockReplace).not.toHaveBeenCalled();
	});

	test('sends an unauthenticated caller to sign-in', async () => {
		mockFetchCurrentUser.mockResolvedValue(null);
		render(<SetupPage />);
		await waitFor(() =>
			expect(mockReplace).toHaveBeenCalledWith('/auth/signin'),
		);
	});
});

describe('UserMenu', () => {
	test('shows email and role in proxy mode, without sign-out', () => {
		render(<UserMenu user={proxyAdmin} onSignOut={jest.fn()} />);
		fireEvent.click(screen.getByRole('button', { name: /admin@example.com/ }));
		expect(screen.getByText('Role: ADMIN')).toBeInTheDocument();
		expect(screen.queryByText('Sign Out')).not.toBeInTheDocument();
	});

	test('shows name, email and role in oidc mode, with sign-out', () => {
		const onSignOut = jest.fn();
		render(
			<UserMenu
				user={{
					...proxyAdmin,
					role: 'DEVELOPER',
					name: 'Dev Eloper',
					authMode: 'oidc',
				}}
				onSignOut={onSignOut}
			/>,
		);
		fireEvent.click(screen.getByRole('button', { name: /Dev Eloper/ }));
		expect(
			screen.getByText('admin@example.com · Role: DEVELOPER'),
		).toBeInTheDocument();
		fireEvent.click(screen.getByText('Sign Out'));
		expect(onSignOut).toHaveBeenCalledTimes(1);
	});

	test('renders nothing before the user is known', () => {
		const { container } = render(
			<UserMenu user={null} onSignOut={jest.fn()} />,
		);
		expect(container).toBeEmptyDOMElement();
	});
});
