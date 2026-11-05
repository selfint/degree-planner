import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { compatiblePlan } from './planCompatibility';
import { loadDegreeName, loadRequirement } from './requirements';

const affected = {
	degree: ['2024_200', '00002120', 'SC00001320_CG00006382'] as Degree,
	path: 'CG00006246',
	semesters: [['02340124', '02340124'], [], ['02340141']],
	exemptions: ['01040031'],
	wishlist: ['02340313'],
	currentSemester: 2,
	unknownFutureField: { retained: true }
};
const correctDegree: Degree = ['2024_200', '00002120', 'SC00001314_CG00006245'];
const localFetch = async (input: string | URL | Request) =>
	new Response(await fs.readFile(`static${input}`, 'utf8'));

describe('historical three-year CS compatibility', () => {
	it('repairs only the degree tuple without mutating or losing plan data', () => {
		const input = structuredClone(affected);
		Object.freeze(input.degree);
		Object.freeze(input);
		const result = compatiblePlan(input);
		expect(result).toEqual({ ...affected, degree: correctDegree });
		expect(input).toEqual(affected);
		for (const field of [
			'semesters',
			'exemptions',
			'wishlist',
			'unknownFutureField'
		] as const) {
			expect(result[field]).toBe(input[field]);
		}
		expect(compatiblePlan(result)).toBe(result);
	});

	it.each([
		{ degree: correctDegree, path: 'CG00006246' },
		{ degree: correctDegree, path: 'CG00006253' },
		{ degree: affected.degree, path: 'CG00006385' },
		{ degree: affected.degree, path: undefined },
		{ degree: affected.degree, path: 'unknown' },
		{
			degree: ['2024_201', '00002120', 'SC00001320_CG00006382'] as Degree,
			path: affected.path
		},
		{
			degree: [
				'2024_200',
				'00002080',
				'SC00001320_CG00006382'
			] as unknown as Degree,
			path: affected.path
		},
		{ degree: undefined, path: affected.path }
	])('leaves unrelated and valid selections unchanged: %j', (selection) => {
		const input = { ...affected, ...selection };
		expect(compatiblePlan(input)).toBe(input);
	});

	it('resolves the repaired degree and three-year path against the actual committed catalog', async () => {
		const result = compatiblePlan(affected);
		const name = await loadDegreeName(
			'en',
			'catalog',
			result.degree,
			result.path,
			localFetch
		);
		expect(name).toContain('B.SC. IN COMPUTER SCIENCES (3 YEARS)');
		expect(name).toContain('Path: Compter Science 3 Years');
		const requirement = await loadRequirement(
			result.degree,
			result.path,
			localFetch
		);
		expect(requirement.nested?.some((node) => node.name === 'CG00006246')).toBe(
			true
		);
		expect(
			requirement.nested?.find((node) => node.name === 'CG00006246')?.nested
				?.length
		).toBeGreaterThan(0);
		const physics = JSON.parse(
			await fs.readFile(
				'static/_catalogs/2024_200/00002120/SC00001320_CG00006382/requirementsData.json',
				'utf8'
			)
		);
		expect(physics.en).toBe('B.SC. IN COMPUTER SCIENCE AND IN PHYSICS');
		expect(
			physics.nested.some(
				(node: { name: string }) => node.name === affected.path
			)
		).toBe(false);
	});
});
