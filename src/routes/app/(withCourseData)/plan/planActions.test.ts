import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Save, Share and Copy inherit the same primary primitive as Settings.
// Route-scoped patches caused the previous Settings regression.
describe('plan action styling ownership', () => {
	for (const path of [
		'src/routes/app/(withCourseData)/plan/+page.svelte',
		'src/routes/app/(withCourseData)/preview/[year]/[faculty]/[path]/+page.svelte'
	]) {
		it(`${path} does not override the shared primary button`, () => {
			const source = readFileSync(path, 'utf8');
			const css = source.split('<style>')[1] ?? '';
			expect(css).not.toContain('ui-button--primary');
			expect(css).not.toContain('#0f6f67');
		});
	}
});
