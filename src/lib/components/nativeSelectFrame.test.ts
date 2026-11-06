import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import SearchFilters from './SearchFilters.svelte';
import Select from './Select.svelte';

const faculty = 'הפקולטה להנדסת ביוטכנולוגיה ומזון';
const children = createRawSnippet(() => ({
	render: () => `<option value="${faculty}">${faculty}</option>`
}));
const filters = {
	available: false,
	faculty,
	pointsMin: 0,
	pointsMax: 20,
	medianMin: 0
};

function sharedDeclarations(selector: string) {
	const matches: Record<string, string>[] = [];
	postcss
		.parse(readFileSync(new URL('../../app.css', import.meta.url), 'utf8'))
		.walkRules((rule) => {
			if (rule.selector !== selector) return;
			const declarations: Record<string, string> = {};
			rule.walkDecls((declaration) => {
				declarations[declaration.prop] = declaration.value;
			});
			matches.push(declarations);
		});
	expect(matches, `one shared definition for ${selector}`).toHaveLength(1);
	return matches[0];
}

describe('shared native select frame', () => {
	it('wraps both native controls with the same frame and keeps full options', () => {
		const shared = render(Select, { props: { value: faculty, children } }).body;
		const search = render(SearchFilters, {
			props: {
				filters,
				faculties: [faculty],
				maxPoints: 20,
				onchange: () => {},
				onclear: () => {}
			}
		}).body;
		for (const body of [shared, search]) {
			expect(body).toMatch(/<span class="select-frame[^"]*">\s*<select\b/);
			expect(body.match(/<select\b/g)).toHaveLength(1);
			expect(body).toContain('ui-field w-full max-w-full');
			expect(body).toContain(`value="${faculty}"`);
			expect(body).toContain(`>${faculty}</option>`);
		}
		expect(search).toMatch(/<label\b[^>]*for="search-faculty"/);
		expect(search).toMatch(/<select\b[^>]*id="search-faculty"/);
	});

	it('contains native overflow and draws keyboard focus outside the shared boundary', () => {
		expect(sharedDeclarations('.select-frame')).toMatchObject({
			display: 'block',
			'min-inline-size': '0',
			'max-inline-size': '100%',
			overflow: 'hidden'
		});
		expect(sharedDeclarations('.select-frame > select')).toEqual({
			display: 'block'
		});
		expect(
			sharedDeclarations('.select-frame:has(> select:focus-visible)')
		).toEqual({
			outline: '0.125rem solid rgb(var(--color-accent-primary))',
			'outline-offset': '0.1875rem'
		});
		expect(sharedDeclarations('.select-frame > select:focus-visible')).toEqual({
			outline: 'none'
		});
	});

	it('uses real canonical options for the native browser height baseline and long labels', () => {
		const courses = Object.values(
			JSON.parse(
				readFileSync(
					new URL('../../../static/courseData.json', import.meta.url),
					'utf8'
				)
			)
		) as { faculty?: string }[];
		const actual = new Set(courses.map((course) => course.faculty));
		for (const label of [
			'הנדסה ימית',
			faculty,
			'המחלקה ללימודים הומניסטיים ואמנות'
		])
			expect(actual.has(label), label).toBe(true);
	});
});
