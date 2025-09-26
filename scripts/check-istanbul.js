const { execSync } = require('node:child_process');

try {
  const out = execSync('npm view babel-plugin-istanbul@latest dependencies.test-exclude', {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .toString()
    .trim();

  console.log('babel-plugin-istanbul -> test-exclude:', out || '(no dependency reported)');
} catch (error) {
  console.error('Failed to read babel-plugin-istanbul dependency metadata');
  console.error(error.message);
  process.exitCode = 1;
}
