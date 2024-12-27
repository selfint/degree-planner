const histograms = `https://michael-maltsev.github.io/technion-histograms`;

/**
 * Fetches the median score for a course from a remote source.
 * @param {string} code - The course code.
 * @returns {Promise<Result<number | undefined, number>} A promise that resolves to the median score or undefined if not available.
 */
async function _getMedian(code) {
	// Parse course code in SMXXXXXXXX format
	// Remove first leading zero and remove character at index 6
	code = code.slice(3, 6) + code.slice(7);

	const url = `${histograms}/${code}/index.min.json`;
	const response = await fetch(url);

	if (!response.ok) {
		const responseCode = response.status;
		if (responseCode === 404) {
			console.error(`Course ${code} median: Status 404 from ${url}`);
			return { status: 'ok', value: undefined };
		}

		// check if github returned rate limit stuff
		const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
		try {
			if (
				rateLimitRemaining !== null &&
				parseInt(rateLimitRemaining, 10) === 0
			) {
				const rateLimitReset = response.headers.get('x-ratelimit-reset');
				const rateLimitLimit = response.headers.get('x-ratelimit-limit');
				const rateLimitUsed = response.headers.get('x-ratelimit-used');
				console.error(
					`Course ${code} median: Rate limit exceeded for ${url}. Rate limit details: Limit=${rateLimitLimit}, Used=${rateLimitUsed}, Remaining=${rateLimitRemaining}, Reset=${rateLimitReset}`
				);
			}
		} catch (e) {
			// ignore
		}

		console.error(
			`Course ${code} median: Failed to fetch data from ${url}. Status ${responseCode}`
		);

		// response is from github api, check if we hit rate limit
		return { status: 'err', value: responseCode };
	}

	const info = await response.json();
	let allMedians = [];
	let medians = 0;
	let count = 0;

	// Iterate over the last 5 semesters to calculate the average median score
	for (const semester of Object.values(info).slice(-5)) {
		const median = semester.Finals?.median;
		if (median !== undefined && median !== null && !isNaN(median)) {
			allMedians.push(median);
			medians += parseFloat(median);
			count++;
		}
	}

	// If no medians were found, return undefined; otherwise, return the average median
	if (count === 0) {
		console.error(`Course ${code} median: No median scores found`);
		return { status: 'ok', value: undefined };
	} else {
		// Round to one decimal place
		const value = parseFloat((medians / count).toFixed(1));
		console.error(
			`Course ${code} median: Median score is ${value}. All medians: ${allMedians.join(', ')}.`
		);
		return { status: 'ok', value };
	}
}

/**
 * Fetches the median score for a course from a remote source. Retries up to 7 times.
 * @param {string} code - The course code.
 * @returns {Promise<number|undefined>} A promise that resolves to the median score or undefined if not available.
 */
export async function getMedian(code) {
	let median = await _getMedian(code);

	if (median.status !== 'err') {
		return median.value;
	}

	const retries = 7;
	const sleepMS = 5 * 1000;
	let currentSleepMS = sleepMS;

	for (let i = 0; i < retries; i++) {
		console.error(
			`Failed to fetch median for course ${code}. Retrying (${i + 1}/${retries}) in ${(currentSleepMS / 1000).toFixed(0)} seconds...`
		);

		// sleep with backoff
		await new Promise((resolve) => setTimeout(resolve, currentSleepMS));
		currentSleepMS *= 2;

		median = await _getMedian(code);

		if (median.status !== 'err') {
			return median.value;
		}
	}

	return undefined;
}
