function getHistogramUrl(course: string): string {
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
