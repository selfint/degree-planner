import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readWorkflow = (name) =>
	readFileSync(
		new URL(`../.github/workflows/${name}.yml`, import.meta.url),
		'utf8'
	);

describe('on-demand video workflows', () => {
	for (const name of [
		'tutorials',
		'student-journey-videos',
		'in-app-tutorial-refresh'
	]) {
		it(`${name} has only a manual trigger`, () => {
			const workflow = readWorkflow(name);
			const events = workflow.match(/^on:\n([\s\S]*?)(?=^\S)/m)?.[1];
			expect(events?.trim()).toBe('workflow_dispatch:');
		});
	}

	it('manual tutorial runs record and assemble every shard', () => {
		const workflow = readWorkflow('tutorials');
		expect(workflow).not.toContain('github.event_name');
		expect(workflow).toContain('needs: [acceptance, record]');
		expect(workflow).toContain('test "$RECORD" = success');
		expect(workflow).toContain('test "$ACCEPTANCE" = success');
		expect(workflow).toContain('node scripts/mergeLandingTutorialShards.mjs');
		expect(workflow).toContain('max-parallel: 7');
	});
});
