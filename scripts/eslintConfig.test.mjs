import { ESLint } from 'eslint';
import { getFileInfo } from 'prettier';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();
async function rulesFor(code, filePath) {
	const [result] = await eslint.lintText(code, { filePath });
	expect(result.messages.filter((message) => message.fatal)).toEqual([]);
	return result.messages.map((message) => message.ruleId);
}

describe('repository quality-check scope', () => {
	it('retains recommended JavaScript and TypeScript rules', async () => {
		expect(
			await rulesFor('missingFunction();', 'scripts/lint-example.mjs')
		).toContain('no-undef');
		expect(
			await rulesFor('export const value: any = 1;', 'src/lint-example.ts')
		).toContain('@typescript-eslint/no-explicit-any');
	});
	it('parses typed rune modules and checks Svelte keyed loops', async () => {
		expect(
			await rulesFor(
				'let value = $state<number>(0); export function increment() { value += 1; return value; }',
				'src/lint-example.svelte.ts'
			)
		).toEqual([]);
		expect(
			await rulesFor(
				'<script lang="ts">const { items }: { items: string[] } = $props();</script>{#each items as item}<p>{item}</p>{/each}',
				'src/LintExample.svelte'
			)
		).toContain('svelte/require-each-key');
	});
	it('retains Svelte navigation validation', async () => {
		expect(
			await rulesFor('<a href="/app/plan">Plan</a>', 'src/LintExample.svelte')
		).toContain('svelte/no-navigation-without-resolve');
	});
	it('permits Playwright fixture parameters but still rejects empty assignment patterns', async () => {
		const code =
			'export async function afterEach({}, info) { await info.attach("example"); }';
		expect(await rulesFor(code, 'tests/lint-example.test.ts')).toEqual([]);
		expect(await rulesFor(code, 'src/lint-example.ts')).toContain(
			'no-empty-pattern'
		);
		expect(
			await rulesFor('const {} = {};', 'tests/lint-example.test.ts')
		).toContain('no-empty-pattern');
	});
	it.each([
		'static/_catalogs/2024_200/00002120/program/requirementsData.json',
		'static/catalogs.json',
		'static/courseData.json',
		'static/courseDataStripped.json',
		'static/_courses/00104031',
		'src/lib/journeyRecordings.json',
		'static/tutorials/journeys/provenance.json',
		'tutorials/journeys-provenance.json',
		'integration/fixtures/legacy-service-worker.js',
		'scripts/fixtures/legacyCatalogPipeline.mjs'
	])('does not reformat generated or frozen artifact %s', async (path) => {
		expect(
			(await getFileInfo(path, { ignorePath: '.prettierignore' })).ignored
		).toBe(true);
	});
	it.each([
		'src/lib/analytics.ts',
		'scripts/SAPClient.mjs',
		'scripts/catalogData.test.mjs',
		'tests/pwa.test.ts',
		'firestore.indexes.json',
		'tsconfig.json'
	])('retains authored formatting checks for %s', async (path) => {
		expect(
			(await getFileInfo(path, { ignorePath: '.prettierignore' })).ignored
		).toBe(false);
	});
	it('keeps authored code linted while excluding build output and frozen implementations', async () => {
		for (const path of [
			'build/bundled.js',
			'.svelte-kit/generated/client.js',
			'integration/fixtures/legacy-service-worker.js',
			'scripts/fixtures/legacyCatalogPipeline.mjs'
		])
			expect(await eslint.isPathIgnored(path)).toBe(true);
		for (const path of [
			'src/lib/analytics.ts',
			'scripts/SAPClient.mjs',
			'scripts/catalogData.test.mjs',
			'tests/pwa.test.ts'
		])
			expect(await eslint.isPathIgnored(path)).toBe(false);
	});
});
