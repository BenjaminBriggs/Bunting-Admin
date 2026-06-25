/* global jest, afterAll -- jest provides these globals at runtime; this setup filename is not matched by the jest test-file glob */
// Keep unit tests snappy
jest.setTimeout(5000);

const originalDateNow = Date.now;
Date.now = () => 1_700_000_000_000;

afterAll(() => {
	Date.now = originalDateNow;
});
