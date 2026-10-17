/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { FinishDialog } from '@/components/features/test-rollouts/FinishDialog';

const noop = () => undefined;

describe('FinishDialog', () => {
	it('completing a test requires picking a winner, then passes it on', () => {
		const onConfirm = jest.fn();
		render(
			<FinishDialog
				open
				action="complete"
				kind="test"
				name="Checkout"
				hasConditions={false}
				groups={['control', 'treatment']}
				busy={false}
				error={null}
				onConfirm={onConfirm}
				onClose={noop}
			/>,
		);

		const confirm = screen.getByRole('button', { name: 'Complete test' });
		expect(confirm).toBeDisabled();
		expect(screen.getByText(/after your next publish/)).toBeInTheDocument();

		fireEvent.click(screen.getByLabelText('treatment'));
		expect(confirm).toBeEnabled();
		fireEvent.click(confirm);
		expect(onConfirm).toHaveBeenCalledWith('treatment');
	});

	it('abandoning explains that users revert and shows server refusals', () => {
		const onConfirm = jest.fn();
		render(
			<FinishDialog
				open
				action="abandon"
				kind="rollout"
				name="Dark mode"
				hasConditions={false}
				busy={false}
				error="This rollout is already completed."
				onConfirm={onConfirm}
				onClose={noop}
			/>,
		);

		expect(
			screen.getByText(/go back to what each attached flag/),
		).toBeInTheDocument();
		expect(
			screen.getByText('This rollout is already completed.'),
		).toBeInTheDocument();
		expect(screen.queryByRole('radio')).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Abandon rollout' }));
		expect(onConfirm).toHaveBeenCalledWith(undefined);
	});
});
