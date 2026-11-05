/**
 * The original v1 → v2 migration paired the three-year CS path with the
 * CS-and-physics degree. The 2024 winter catalog places CG00006246 under
 * SC00001314_CG00006245 (Computer Sciences, 3 Years), not SC00001320_CG00006382.
 * Repair only that exact historical pair. Other invalid selections need an
 * explicit user choice, not a guessed replacement.
 *
 * This is an in-memory read compatibility rule, not a storage migration:
 * callers retain their storage/account boundaries and normal save policy.
 */
export function compatiblePlan<
	T extends { degree?: readonly string[]; path?: string }
>(data: T): T {
	const degree = data.degree;
	if (
		degree?.length !== 3 ||
		degree[0] !== '2024_200' ||
		degree[1] !== '00002120' ||
		degree[2] !== 'SC00001320_CG00006382' ||
		data.path !== 'CG00006246'
	) {
		return data;
	}

	return {
		...data,
		degree: ['2024_200', '00002120', 'SC00001314_CG00006245']
	};
}
