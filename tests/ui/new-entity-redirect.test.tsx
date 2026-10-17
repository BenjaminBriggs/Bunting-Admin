/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, waitFor } from '@testing-library/react';
import NewFlagPage from '@/app/dashboard/flags/new/page';
import NewRolloutPage from '@/app/dashboard/rollouts/new/page';
import NewTestPage from '@/app/dashboard/tests/new/page';

// The "new" pages send users to /dashboard when no app is selected. The app
// context has no selection until it finishes loading, so redirecting before
// then bounced a fresh page load (or a quick click after sign-in) away from the
// form. The production smoke caught this; these pin it.

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
	useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

let mockAppState: { selectedApp: unknown; loading: boolean };
jest.mock('@/lib/app-context', () => ({
	useApp: () => ({ ...mockAppState, apps: [], currentUser: null }),
}));

jest.mock('@/lib/changes-context', () => ({
	useChanges: () => ({ markChangesDetected: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
	fetchFlags: jest.fn(() => Promise.resolve([])),
	fetchTestRollouts: jest.fn(() => Promise.resolve([])),
	createFlag: jest.fn(),
	createTestRollout: jest.fn(),
}));

const pages = [
	['flags', NewFlagPage],
	['tests', NewTestPage],
	['rollouts', NewRolloutPage],
] as const;

describe.each(pages)('/dashboard/%s/new', (_name, Page) => {
	beforeEach(() => {
		mockPush.mockClear();
	});

	it('does not redirect while the app context is still loading', async () => {
		mockAppState = { selectedApp: null, loading: true };
		render(<Page />);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(mockPush).not.toHaveBeenCalledWith('/dashboard');
	});

	it('redirects once loading finishes with no app selected', async () => {
		mockAppState = { selectedApp: null, loading: false };
		render(<Page />);
		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith('/dashboard');
		});
	});
});
