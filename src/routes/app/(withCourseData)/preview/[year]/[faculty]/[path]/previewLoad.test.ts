import { describe, expect, it } from 'vitest';
import { load } from './+page';

// This loader only uses params/url, not a network connection or user storage.
async function loadShare(degree: string[], path?: string) {
	const url = new URL(
		`https://example.test/share/${degree.join('/')}?semesters=02340124-02340124~~02340141${path ? `&path=${path}` : ''}#original`
	);
	const originalURL = url.href;
	const params = { year: degree[0], faculty: degree[1], path: degree[2] };
	const result = await load({ params, url } as Parameters<typeof load>[0]);
	expect(url.href).toBe(originalURL);
	expect(params).toEqual({
		year: degree[0],
		faculty: degree[1],
		path: degree[2]
	});
	expect(result?.semesters).toEqual([
		['02340124', '02340124'],
		[],
		['02340141']
	]);
	return result;
}

describe('shared plan read compatibility', () => {
	it('normalizes the historical pair before title rendering and copying', async () => {
		const result = await loadShare(
			['2024_200', '00002120', 'SC00001320_CG00006382'],
			'CG00006246'
		);
		expect(result?.degree).toEqual([
			'2024_200',
			'00002120',
			'SC00001314_CG00006245'
		]);
		expect(result?.userPath).toBe('CG00006246');
	});

	it.each([
		[['2024_200', '00002120', 'SC00001320_CG00006382'], 'CG00006385'],
		[['2024_200', '00002120', 'SC00001320_CG00006382'], undefined],
		[['2024_200', '00002120', 'SC00001314_CG00006245'], 'CG00006246'],
		[['2024_200', '00002120', 'SC00001314_CG00006245'], 'CG00006253'],
		[['2024_200', '00002120', 'SC00001320_CG00006382'], 'unknown'],
		[['2024_201', '00002120', 'SC00001320_CG00006382'], 'CG00006246']
	] as [string[], string | undefined][])(
		'preserves valid physics and unrelated selections %j %s',
		async (degree, path) => {
			const result = await loadShare(degree, path);
			expect(result?.degree).toEqual(degree);
			expect(result?.userPath).toBe(path);
		}
	);
});
