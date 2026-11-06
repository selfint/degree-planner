import { readFileSync } from 'node:fs';
import { ScriptTarget, transpileModule } from 'typescript';
import { describe, expect, it } from 'vitest';
import { createUpdateSafety } from './update-safety';

const directory = '../../routes/app/(withCourseData)/settings/components/';
function runHandler(
	file: string,
	name: string,
	setup: string,
	safety: ReturnType<typeof createUpdateSafety>
) {
	const source = readFileSync(
		new URL(`${directory}${file}.svelte`, import.meta.url),
		'utf8'
	);
	const fn = source.match(
		new RegExp(`(?:async )?function ${name}\\(\\) \\{[\\s\\S]*?\\n\\t\\}`)
	)?.[0];
	if (!fn) throw new Error(`Missing ${file}.${name}`);
	return new Function(
		'updateSafety',
		transpileModule(`${setup}; ${fn}; return ${name}();`, {
			compilerOptions: { target: ScriptTarget.ES2022 }
		}).outputText
	)(safety);
}
describe('explicitly discarding failed settings changes', () => {
	it.each([
		[
			'DegreeSection',
			'reset',
			'let year,faculty,degree,path; const userDegree=["year","faculty","degree"], userPath="path"'
		],
		['UploadSection', 'onCancel', 'let transcript={},uploadError="failed"'],
		[
			'SemesterSection',
			'onCancelCurrentSemester',
			'let semesterChoice=3; const user={d:{currentSemester:0}}'
		],
		[
			'SemesterSection',
			'onCancelTotalSemesters',
			'let totalSemestersChoice=5; const user={d:{semesters:[[]]}}'
		]
	])(
		'%s.%s clears a failed-save blocker on explicit discard',
		async (file, name, setup) => {
			const safety = createUpdateSafety();
			await expect(
				safety.write(async () => {
					throw new Error('save failed');
				})
			).rejects.toThrow();
			expect(safety.blocked()).toBe(true);
			await runHandler(file, name, setup, safety);
			expect(safety.blocked()).toBe(false);
		}
	);
	it('discarding a failure does not permit reload over another draft or pending write', async () => {
		const safety = createUpdateSafety();
		safety.register(() => true);
		await expect(
			safety.write(async () => {
				throw new Error('save failed');
			})
		).rejects.toThrow();
		await runHandler(
			'UploadSection',
			'onCancel',
			'let transcript={},uploadError="failed"',
			safety
		);
		expect(safety.blocked()).toBe(true);
	});
});
