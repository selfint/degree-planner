import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import PlanActionButton from './PlanActionButton.svelte';

beforeEach(() => vi.stubGlobal('window', new EventTarget()));
afterEach(() => vi.unstubAllGlobals());
const children = createRawSnippet(() => ({
	render: () => '<span>Save plan</span>'
}));

describe('plan action control', () => {
	it('renders a disabled write control while offline', () => {
		vi.stubGlobal('navigator', { onLine: false });
		const { body } = render(PlanActionButton, {
			props: { variant: 'primary', children }
		});
		expect(body).toContain('disabled');
		expect(body).toContain('Save plan');
	});

	it('keeps write controls enabled online unless otherwise disabled', () => {
		vi.stubGlobal('navigator', { onLine: true });
		const { body } = render(PlanActionButton, {
			props: { variant: 'primary', children }
		});
		expect(body).not.toContain('disabled');
		expect(
			render(PlanActionButton, {
				props: { variant: 'primary', children, disabled: true }
			}).body
		).toContain('disabled');
	});
});
