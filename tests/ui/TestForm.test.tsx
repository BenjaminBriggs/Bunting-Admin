/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import TestForm, {
	type TestFormSubmit,
	type TestFormValues,
} from '@/components/features/tests/test-form';
import { buildTestUpdatePayload } from '@/lib/test-group-variants';

const noop = () => undefined;

const initial: TestFormValues = {
	name: 'Button test',
	key: 'button_test',
	groups: [
		{ name: 'control', weight: 50, storedName: 'control' },
		{ name: 'treatment', weight: 50, storedName: 'treatment' },
	],
	adjustSplit: false,
	conditions: [],
	description: '',
	group: '',
};

function renderEdit(
	onSubmit = jest.fn((_payload: TestFormSubmit) => undefined),
) {
	render(
		<TestForm
			mode="edit"
			initial={initial}
			saving={false}
			onSubmit={onSubmit}
			onComplete={noop}
			onAbandon={noop}
			onDelete={noop}
		/>,
	);
	return onSubmit;
}

const groupInputs = () =>
	screen.getAllByPlaceholderText<HTMLInputElement>('Group name');
const save = () => screen.getByRole('button', { name: /Save changes/ });

describe('TestForm (edit) group identity', () => {
	it('a renamed group keeps the stored group it came from, so its values follow it', () => {
		const onSubmit = renderEdit();

		const treatment = groupInputs().find((i) => i.value === 'treatment');
		fireEvent.change(treatment!, { target: { value: 'green' } });
		fireEvent.click(save());

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit.mock.calls[0][0].groups).toEqual([
			{ name: 'control', weight: 50, storedName: 'control' },
			{ name: 'green', weight: 50, storedName: 'treatment' },
		]);
	});

	it('an added group has no stored group, so the edit sends it without values', () => {
		const onSubmit = renderEdit();

		fireEvent.click(screen.getByText('Add group'));
		fireEvent.click(save());

		const submitted = onSubmit.mock.calls[0][0];
		expect(submitted.groups).toEqual([
			{ name: 'control', weight: 34, storedName: 'control' },
			{ name: 'treatment', weight: 33, storedName: 'treatment' },
			{ name: 'Group 3', weight: 33 },
		]);

		const values = {
			development: { f: 'x' },
			beta: { f: 'x' },
			production: { f: 'x' },
		};
		const body = buildTestUpdatePayload(
			{
				control: { percentage: 50, values },
				treatment: { percentage: 50, values },
			},
			submitted,
		);
		expect(body.variants).toEqual({
			control: { percentage: 34, values },
			treatment: { percentage: 33, values },
			'Group 3': { percentage: 33 },
		});
	});

	it('blocks saving when two groups share a name', () => {
		const onSubmit = renderEdit();

		const treatment = groupInputs().find((i) => i.value === 'treatment');
		fireEvent.change(treatment!, { target: { value: 'control' } });

		expect(
			screen.getByText('Group names must be different from each other.'),
		).toBeInTheDocument();
		expect(save()).toBeDisabled();
		fireEvent.click(save());
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('blocks saving when a group has no name', () => {
		renderEdit();

		const treatment = groupInputs().find((i) => i.value === 'treatment');
		fireEvent.change(treatment!, { target: { value: '  ' } });

		expect(screen.getByText('Every group needs a name.')).toBeInTheDocument();
		expect(save()).toBeDisabled();
	});
});
