import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileModule } from 'svelte/compiler';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Ordinary Vitest uses Svelte's server URL alias. Compile the actual navigation
// module and its helpers for a separate client-condition process so client URL
// serialization bugs cannot hide behind the native server implementation.
function declarations(filename: string): string {
	const source = readFileSync(new URL(filename, import.meta.url), 'utf8');
	const ast = ts.createSourceFile(
		filename,
		source,
		ts.ScriptTarget.Latest,
		true
	);
	return ast.statements
		.filter((statement) => !ts.isImportDeclaration(statement))
		.map((statement) => statement.getText(ast))
		.join('\n');
}

const source = [
	"import { tick } from 'svelte';",
	"import { SvelteMap, SvelteURL } from 'svelte/reactivity';",
	"const base = process.env.TEST_BASE_PATH ?? '';",
	declarations('./deploymentPaths.ts'),
	declarations('./search.ts'),
	declarations('./searchNavigation.svelte.ts')
].join('\n');
const javascript = ts.transpileModule(source, {
	compilerOptions: {
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext
	}
}).outputText;
const client = compileModule(javascript, {
	filename: 'searchNavigation.svelte.js',
	generate: 'client'
}).js.code;

describe('client search navigation', () => {
	it.each(['', '/degree-planner'])(
		'commits, clears and re-enables the presence flag with deployment prefix %j',
		(base) => {
			const result = spawnSync(
				process.execPath,
				['--conditions=browser', '--input-type=module'],
				{
					cwd: fileURLToPath(new URL('../..', import.meta.url)),
					env: { ...process.env, TEST_BASE_PATH: base },
					encoding: 'utf8',
					input: `${client}
import assert from 'node:assert/strict';
assert.notEqual(SvelteURL, URL, 'The regression must use the real client URL implementation');
const initial = 'https://example.test' + base + '/app/search?q=1040&keep=yes#help[0]';
let pageUrl = new URL(initial);
const requests = [];
const navigation = createSearchNavigation(() => pageUrl, async (url) => {
    requests.push(url.href);
    navigation.observeNavigation(url, 'goto');
    pageUrl = new URL(url);
    navigation.observeNavigation(pageUrl, 'goto', true);
});
for (const patch of [{ available: true }, { available: false }, { available: true }, undefined, { available: true }]) {
    const previousCount = requests.length;
    await navigation.updateFilters(patch, 20);
    assert.equal(requests.length, previousCount + 1, 'Every flag toggle must navigate');
    const expected = new URL(initial);
    if (patch?.available) expected.searchParams.append('available', '');
    assert.equal(requests.at(-1), expected.href);
    assert.equal(navigation.url.href, expected.href);
    assert.deepEqual([...navigation.url.searchParams], [...expected.searchParams]);
}
`
				}
			);
			expect(result.status, result.stderr || result.stdout).toBe(0);
		}
	);
});
