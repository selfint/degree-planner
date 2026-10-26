import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// This initial TDD checkpoint deliberately predates the landing implementation.
// A setup error, crash, or a different assertion is NOT accepted as red evidence.
assert.equal(process.argv[2], '1', 'the missing-feature check must fail');
const report = JSON.parse(
	readFileSync('test-results/tutorial-red.json', 'utf8')
);
assert.equal(report.errors.length, 0, 'no runner/setup errors');
const specs = report.suites.flatMap((suite) => suite.specs);
assert.equal(specs.length, 1, 'one focused missing-feature check');
assert.equal(specs[0].title, 'landing tutorials en light 320');
const result = specs[0].tests[0].results[0];
assert.equal(result.status, 'failed');
assert.match(result.error.message, /getByTestId\('landing-tutorials'\)/);
assert.match(result.error.message, /element\(s\) not found/);
console.log('RED verified: the current landing page has no tutorial section.');
