// Keep unit tests snappy
jest.setTimeout(5000);

const originalDateNow = Date.now;
Date.now = () => 1_700_000_000_000;

afterAll(() => {
  Date.now = originalDateNow;
});
