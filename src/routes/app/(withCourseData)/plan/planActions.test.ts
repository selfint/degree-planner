import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import { parse } from 'postcss';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
	'src/routes/app/(withCourseData)/plan/+page.svelte',
	'utf8'
);

describe('plan toolbar action styling', () => {
	it('uses the same compact colors and spacing for Save and Share', () => {
		const { css } = compile(source, { filename: '+page.svelte' });
		const rules = parse(css!.code);
		let matched = false;
		rules.walkRules((rule) => {
			if (!rule.selector.includes('.plan-share')) return;
			expect(rule.selector).toContain('.plan-toolbar');
			expect(rule.selector).toContain('.plan-action .ui-button--primary');
			const declarations: Record<string, string> = {};
			rule.walkDecls((declaration) => {
				declarations[declaration.prop] = declaration.value;
			});
			expect(declarations).toEqual({
				'min-inline-size': 'var(--control-height)',
				'padding-inline': '0.5rem',
				background: '#0f6f67',
				color: '#fff'
			});
			matched = true;
		});
		expect(matched).toBe(true);
	});
	it('gives Copy plan the same compact colors and spacing as Save and Share', () => {
		const preview = readFileSync(
			'src/routes/app/(withCourseData)/preview/[year]/[faculty]/[path]/+page.svelte',
			'utf8'
		);
		const { css } = compile(preview, { filename: '+page.svelte' });
		let matched = false;
		parse(css!.code).walkRules((rule) => {
			if (
				!rule.selector.includes('.preview-actions') ||
				!rule.selector.includes('.plan-action .ui-button--primary')
			)
				return;
			const declarations: Record<string, string> = {};
			rule.walkDecls((declaration) => {
				declarations[declaration.prop] = declaration.value;
			});
			expect(declarations).toEqual({
				'min-inline-size': 'var(--control-height)',
				'padding-inline': '0.5rem',
				background: '#0f6f67',
				color: '#fff'
			});
			matched = true;
		});
		expect(matched).toBe(true);
	});
});
