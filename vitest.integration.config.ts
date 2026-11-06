import { defineConfig } from 'vitest/config';

// Explicit production-build gate, kept separate from build-independent unit tests.
export default defineConfig({
	test: { include: ['integration/**/*.test.ts'] }
});
