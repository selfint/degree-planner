export type PublicDataReadProgress = {
	bytesRead: number;
	activity: 'reading' | 'processing' | 'saving';
};

/** Counts decoded response bytes, never compressed wire bytes or guessed totals. */
export async function readJsonWithProgress(
	response: Response,
	onProgress: (progress: PublicDataReadProgress) => void
): Promise<unknown> {
	let bytesRead = 0;
	onProgress({ bytesRead, activity: 'reading' });
	if (!response.body) {
		onProgress({ bytesRead, activity: 'processing' });
		return response.json();
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	const parts: string[] = [];
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			bytesRead += value.byteLength;
			parts.push(decoder.decode(value, { stream: true }));
			onProgress({ bytesRead, activity: 'reading' });
		}
		parts.push(decoder.decode());
		onProgress({ bytesRead, activity: 'processing' });
		return JSON.parse(parts.join(''));
	} finally {
		reader.releaseLock();
	}
}
