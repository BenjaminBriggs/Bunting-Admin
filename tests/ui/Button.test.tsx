/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';

function TestButton() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      Clicked {count} times
    </button>
  );
}

describe('Button smoke test', () => {
  it('increments counter on click', () => {
    render(<TestButton />);

    const button = screen.getByRole('button', { name: /clicked 0 times/i });
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: /clicked 1 times/i })).toBeInTheDocument();
  });
});
