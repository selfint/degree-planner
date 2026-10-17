import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Select from './Select.svelte';

const label =
	'A complete native option label that is wider than a mobile field';
const children = createRawSnippet(() => ({
	render: () => `<option value="long">${label}</option>`
}));

describe('native select containment', () => {
	it('retains the native picker and complete option inside its own boundary', () => {
		const { body } = render(Select, { props: { value: 'long', children } });
		expect(body).toMatch(/<span class="select-frame[^"]*"><select/);
		expect(body.match(/<select\b/g)).toHaveLength(1);
		expect(body).toContain(`<option value="long">${label}</option>`);
		expect(body).not.toContain('tabindex');
		expect(body).not.toContain('role=');
		expect(body).not.toContain('disabled');
	});

	it('passes the disabled state to the native select', () => {
		const { body } = render(Select, {
			props: { value: 'long', children, disabled: true }
		});
		expect(body).toMatch(/<select\b[^>]*\bdisabled\b/);
		expect(body).toContain(label);
	});
});
