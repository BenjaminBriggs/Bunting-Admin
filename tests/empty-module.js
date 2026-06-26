// No-op stand-in for `server-only` / `client-only` under jest. Those packages
// throw unless the bundler sets the `react-server` / browser export condition
// (Next does; jest does not), so map them here to keep server modules importable
// in tests. See jest.config.js moduleNameMapper.
module.exports = {};
