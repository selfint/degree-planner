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

	progress.count.done = relevantCourses.length;
	progress.points.done = relevantCourses.reduce(
		(sum, course) => sum + (course.points ?? 0),
		0
	);
	progress.hook = {
		en: `Only took courses from ${bestOptions.map((o) => o.name).join(', ')}`,
		he: `נלקחו רק קורסים מ ${bestOptions.map((o) => o.he ?? o.name).join(', ')}`
	};

	return progress;
}

// @ts-ignore
return main(semesters, progress);
