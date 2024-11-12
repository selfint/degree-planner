/**
 * @param {string} name
 * @returns {string}
 */
function formatName(name) {
	name = name.replace(/_/g, ' ');
	return (
		name[0].toUpperCase() +
		name
			.slice(1)
			.split('_')
			.map((word) => (word.length > 2 ? word : word.toUpperCase()))
			.join(' ')
	);
}

/**
 * @param {Course[][]} semesters
 * @param {Progress} progress
 * @returns {Progress}
 */
function main(semesters, progress) {
	/** @type {[Progress, Progress][]} */
	const pairs = [];

	// get all valid pair permutations of bestOptions
	const done = progress.nested.done;
	if (done.length === 0) {
		progress.hook = {
			en: 'No specializations are completed.',
			he: 'לא הושלמו אף התמחויות.'
		};

		return progress;
	} else if (done.length === 1) {
		const specialization = done[0];

		progress.hook = {
			en: `Only took courses from '${formatName(specialization.name)}'.`,
			he: `נלקחו רק קורסים מ'${formatName(specialization.he ?? specialization.name)}'.`
		};

		return progress;
	}

	for (let i = 0; i < done.length; i++) {
		for (let j = i + 1; j < done.length; j++) {
			const a = done[i];
			const b = done[j];

			// check if the pair has at least 6 unique courses
			const uniqueCourses = new Set([
				...a.courses.done.map((c) => c.code),
				...b.courses.done.map((c) => c.code)
			]);

			if (uniqueCourses.size >= 6) {
				pairs.push([a, b]);
			}
		}
	}

	// get the best pair
	const bestPair = pairs.toSorted((pair) => {
		const [a, b] = pair;
		return a.courses.done.length + b.courses.done.length;
	})[0];

	/** @type {Course[]} */
	const newCourses = [];
	for (const course of bestPair.flatMap(({ courses }) => courses.done)) {
		if (!newCourses.some((c) => c.code === course.code)) {
			newCourses.push(course);
		}
	}

	const newCount = newCourses.length;
	const newPoints = newCourses.reduce(
		(sum, course) => sum + (course.points ?? 0),
		0
	);

	if (progress.count.done === newCount && progress.points.done === newPoints) {
		return progress;
	}

	progress.count.done = newCount;
	progress.points.done = newPoints;

	progress.hook = {
		en:
			'Only took courses from ' +
			bestPair.map((p) => `'${formatName(p.name)}'`).join(' and ') +
			'.',
		he:
			'נלקחו רק קורסים מ' +
			bestPair.map((p) => `'${formatName(p.he ?? p.name)}'`).join(' ו') +
			'.'
	};

	return progress;
}

// @ts-expect-error
return main(semesters, progress);
