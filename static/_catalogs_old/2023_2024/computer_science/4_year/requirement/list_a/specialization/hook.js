/**
 * @param {Course[][]} semesters
 * @param {Progress} progress
 */
function main(semesters, progress) {
	const bestOptions = progress.nested.done
		.toSorted((a, b) => b.points.done - a.points.done)
		.slice(0, progress.amount.required);

	const nested = bestOptions.flatMap((p) => p.courses.done.map((c) => c.code));

	const relevantCourses = progress.courses.done.filter((course) =>
		nested.includes(course.code)
	);

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

	const oldCount = progress.count.done;
	const oldPoints = progress.points.done;

	const newCount = relevantCourses.length;
	const newPoints = relevantCourses.reduce(
		(sum, course) => sum + (course.points ?? 0),
		0
	);

	if (oldCount === newCount && oldPoints === newPoints) {
		return progress;
	}

	progress.count.done = newCount;
	progress.points.done = newPoints;

	/**
	 *
	 * @param {string[]} values
	 * @returns {string}
	 */
	function formatValues(values) {
		return values
			.map(formatName)
			.map((v) => `'${v}'`)
			.join(', ');
	}

	if (bestOptions.length === 0) {
		progress.hook = {
			en: 'No specializations are completed.',
			he: 'לא הושלמו אף התמחויות.'
		};
	} else if (bestOptions.length === 1) {
		const enOptions = formatValues([bestOptions[0].name]);
		const heOptions = formatValues([bestOptions[0].he ?? bestOptions[0].name]);

		progress.hook = {
			en: `Only took courses from ${enOptions}.`,
			he: `נלקחו רק קורסים מ${heOptions}.`
		};
	} else {
		const firstOptions = bestOptions.slice(0, -1);
		const lastOption = bestOptions[bestOptions.length - 1];

		const enOptions = formatValues(firstOptions.map((o) => o.name));
		const heOptions = formatValues(firstOptions.map((o) => o.he ?? o.name));

		progress.hook = {
			en: `Only took courses from ${enOptions} and '${formatName(lastOption.name)}'.`,
			he: `נלקחו רק קורסים מ ${heOptions} ו-'${lastOption.he ?? formatName(lastOption.name)}'.`
		};
	}

	return progress;
}

// @ts-ignore
return main(semesters, progress);
