import { courses, pending } from '../fixtures';
import { scenario } from './stores.svelte';
export type Transcript = { semesters: string[][]; exemptions: string[] };
export async function parseTranscript(): Promise<Transcript | undefined> {
	if (scenario.transcript === 'loading') return pending();
	if (scenario.transcript === 'invalid') return undefined;
	return {
		semesters: [[courses[0].code], [courses[1].code]],
		exemptions: [courses[2].code]
	};
}
