import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'postcss';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import Button from './Button.svelte';
import AsyncButton from './AsyncButton.svelte';

const css = parse(readFileSync('src/app.css', 'utf8'));
const children = createRawSnippet(() => ({
	render: () => '<span>Save</span>'
}));
function declarations(selector: string) {
	const result: Record<string, string> = {};
	css.walkRules(selector, (rule) => {
		rule.walkDecls((decl) => {
			result[decl.prop] = decl.value;
		});
	});
	return result;
}
function svelteFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? svelteFiles(join(dir, entry.name))
			: entry.name.endsWith('.svelte')
				? [join(dir, entry.name)]
				: []
	);
}

describe('shared action styling', () => {
	it('owns approved Save/Share colors and compact spacing globally', () => {
		expect(declarations(':root')).toMatchObject({
			'--button-primary-background': '15 111 103',
			'--button-primary-content': '255 255 255'
		});
		expect(declarations('.ui-button--primary')).toEqual({
			'min-inline-size': 'var(--control-height)',
			'padding-inline': '0.5rem',
			background: 'rgb(var(--button-primary-background))',
			color: 'rgb(var(--button-primary-content))'
		});
		expect(declarations('.ui-button--secondary').background).toBe(
			'rgb(var(--color-card-primary))'
		);
	});
	it('uses one native button primitive for sync and async actions', () => {
		const source = readFileSync(
			'src/lib/components/AsyncButton.svelte',
			'utf8'
		);
		expect(source).toContain('<Button');
		expect(source).not.toContain('<button');
		for (const Component of [Button, AsyncButton]) {
			for (const variant of ['primary', 'secondary'] as const) {
				const { body } = render(Component, {
					props: { variant, children, disabled: true }
				});
				expect(body).toContain(`ui-button--${variant}`);
				expect(body).toContain('disabled');
				expect(body).toContain('type="button"');
			}
		}
	});
	it('forwards native accessibility and form attributes', () => {
		const { body } = render(Button, {
			props: {
				variant: 'primary',
				children,
				type: 'submit',
				'aria-busy': true,
				'aria-describedby': 'reason',
				class: 'relative'
			}
		});
		expect(body).toContain('aria-busy="true"');
		expect(body).toContain('aria-describedby="reason"');
		expect(body).toContain('type="submit"');
		expect(body).toContain('relative');
	});
	it('applies disabled styling to upload labels without hover affordance', () => {
		expect(
			declarations('.ui-button:disabled,\n\t.ui-button:has(input:disabled)')
		).toMatchObject({ opacity: '0.45', cursor: 'not-allowed' });
		expect(
			declarations('.ui-button:not(:disabled):not(:has(input:disabled)):hover')
		).toHaveProperty('box-shadow');
	});
	it('forbids page/component overrides of shared action visual variants', () => {
		for (const file of [
			...svelteFiles('src/lib/components'),
			...svelteFiles('src/routes')
		]) {
			const source = readFileSync(file, 'utf8');
			const styles = source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? '';
			expect(styles, file).not.toMatch(
				/ui-button--(?:primary|secondary)|#0f6f67/i
			);
			// Native action elements may use shared classes; do not override their colors inline.
			for (const tag of source.match(/<(?:a|button|label)\s[\s\S]*?>/g) ?? []) {
				if (tag.includes('ui-button'))
					expect(tag, file).not.toMatch(/text-white|bg-(?:teal|accent)|style=/);
			}
		}
	});
	it('requires deliberate classification of every native button surface', () => {
		// Native controls that intentionally are not the Button component.
		// New surfaces must be reviewed and documented, not silently missed.
		const inventory: Record<string, number> = {
			'src/lib/components/Button.svelte': 1, // canonical action primitive
			'src/lib/components/CourseElement.svelte': 2, // card open + disclosure
			'src/lib/components/Search.svelte': 1, // submit icon
			'src/lib/components/ConsoleAccountStatus.svelte': 2, // shared secondary
			'src/lib/components/PwaStatusView.svelte': 2, // compact text actions
			'src/lib/components/PwaUpdateBanner.svelte': 2, // secondary + dismiss icon
			'src/lib/components/SearchFilters.svelte': 1, // shared secondary
			'src/lib/components/FooterVersion.svelte': 1, // intentionally text-only
			'src/routes/app/(withFullCourseData)/search/+page.svelte': 1, // card
			'src/routes/app/(withCourseData)/plan/+page.svelte': 1, // wishlist card
			'src/routes/app/(withCourseData)/semester/+page.svelte': 4 // course cards
		};
		const actual: Record<string, number> = {};
		for (const file of [
			...svelteFiles('src/lib/components'),
			...svelteFiles('src/routes')
		]) {
			const count = readFileSync(file, 'utf8').match(/<button\b/g)?.length ?? 0;
			if (count) actual[file] = count;
		}
		expect(actual).toEqual(inventory);
	});
	it('keeps semester card buttons keyboard-operable', () => {
		const source = readFileSync(
			'src/routes/app/(withCourseData)/semester/+page.svelte',
			'utf8'
		);
		expect(source).not.toContain('onmousedown=');
		expect(source.match(/<button\s+type="button"/g)).toHaveLength(4);
	});
});
