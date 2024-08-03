function getHistogramUrl(course: string): string {
	// remove first leading zero
	course = course.replace(/^0/, '');

	// remove number at index 3
	course = course.slice(0, 3) + course.slice(4);

	return `https://michael-maltsev.github.io/technion-histograms/${course}/index.min.json`;
}

type SemesterInfo = {
	median: string;
};

export async function getMedian(course: string): Promise<number | undefined> {
	const response = await fetch(getHistogramUrl(course));

	if (!response.ok) {
		console.error(response);
		console.error(getHistogramUrl(course));
		return undefined;
	}

	const info: Record<string, { Finals?: SemesterInfo }> = await response.json();
	let medians = 0;
	let count = 0;
	for (const semester of Object.values(info).slice(-5)) {
		const median = semester.Finals?.median;
		if (median !== undefined) {
			medians += parseFloat(median);
			count++;
		}
	}

	if (count === 0) {
		return undefined;
	} else {
		return medians / count;
	}
}
