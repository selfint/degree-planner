// SAP's outer HTTP status can be 200 even when a subrequest failed.
const service =
	'https://portalex.technion.ac.il/sap/opu/odata/sap/Z_CM_EV_CDIR_DATA_SRV/';
const usage = { requests: 0, batches: 0, sent: 0, received: 0 };

export function formatBytes(bytes, decimals = 2) {
	if (bytes <= 0) return '0 Bytes';
	const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
	const index = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1
	);
	return `${Number((bytes / 1024 ** index).toFixed(Math.max(0, decimals)))} ${units[index]}`;
}

export function getUsage() {
	return {
		...usage,
		sent: formatBytes(usage.sent),
		received: formatBytes(usage.received)
	};
}

function safe(value) {
	return String(value)
		.replace(/[\r\n\t]/g, ' ')
		.slice(0, 350);
}

function context(endpoint, query, lang) {
	return `${endpoint} language=${lang} query=${safe(query.$filter ?? new URLSearchParams(query))}`;
}

export class SAPRequestError extends Error {
	constructor(message, options) {
		super(message, options);
		this.name = 'SAPRequestError';
	}
}

// Fail closed on a partial page rather than publishing a truncated dataset.
// Explicit limited lookups (getCourses(..., top)) may intentionally request a subset.
export function validateCollection(
	collection,
	query = {},
	allowLimitedResults = false
) {
	if (!collection || !Array.isArray(collection.results)) {
		throw new Error('Missing d.results array');
	}
	const rows = collection.results;
	const limit = Number(query.$top);
	const reachedLimit =
		allowLimitedResults && Number.isFinite(limit) && rows.length === limit;
	if (collection.__next && !reachedLimit) {
		throw new Error('Incomplete page: SAP returned a continuation link');
	}
	if (collection.__count !== undefined) {
		const count = Number(collection.__count);
		if (
			!/^\d+$/.test(String(collection.__count)) ||
			!Number.isSafeInteger(count)
		) {
			throw new Error('Invalid SAP inline count');
		}
		const available = Math.max(0, count - Number(query.$skip ?? 0));
		const expected =
			allowLimitedResults && Number.isFinite(limit)
				? Math.min(available, limit)
				: available;
		if (rows.length !== expected) {
			throw new Error(
				`Incomplete collection: inline count expects ${expected} rows, received ${rows.length}`
			);
		}
	}
	return rows;
}

function parsePart(part, query, allowLimitedResults) {
	const match = part.match(/HTTP\/1\.[01]\s+(\d{3})[^\r\n]*\r?\n/);
	if (!match) throw new Error('Missing subrequest HTTP status');
	const status = Number(match[1]);
	const http = part.slice(match.index);
	const separator = http.match(/\r?\n\r?\n/);
	if (!separator) throw new Error('Missing subrequest body');
	let payload;
	try {
		payload = JSON.parse(
			http.slice(separator.index + separator[0].length).trim()
		);
	} catch {
		throw new Error(`Invalid JSON in subrequest (HTTP ${status})`);
	}
	if (status < 200 || status >= 300 || payload.error) {
		// Do not log the response body, internal stack, cookies, or SAP trace details.
		const code =
			typeof payload.error?.code === 'string'
				? ` code=${safe(payload.error.code).replace(/[^a-zA-Z0-9_/.:-]/g, '')}`
				: '';
		throw new Error(`SAP subrequest HTTP ${status}${code}`);
	}
	return validateCollection(payload.d, query, allowLimitedResults);
}

async function requestSAP(
	endpoint,
	queries,
	lang,
	timeoutMs,
	allowLimitedResults
) {
	const boundary = 'batch_degree_planner';
	const body =
		queries
			.map(
				(query) =>
					`--${boundary}\r\nContent-Type: application/http\r\n\r\nGET ${endpoint}?${new URLSearchParams(query)} HTTP/1.1\r\nAccept: application/json\r\n\r\n\r\n\r\n`
			)
			.join('') + `--${boundary}--\r\n`;
	usage.batches++;
	usage.requests += queries.length;
	usage.sent += Buffer.byteLength(body);
	const controller = new AbortController();
	let timer;
	// Race as well as abort: timeout covers headers AND body, including stalled mocks/streams.
	const deadline = new Promise((_, reject) => {
		timer = setTimeout(() => {
			controller.abort();
			reject(new Error(`Request timed out after ${timeoutMs}ms`));
		}, timeoutMs);
	});
	try {
		return await Promise.race([
			(async () => {
				const response = await fetch(`${service}$batch`, {
					method: 'POST',
					headers: {
						'Accept-Language': lang,
						'User-Agent': '',
						'Content-Type': `multipart/mixed;boundary=${boundary}`
					},
					body,
					signal: controller.signal
				});
				if (!response.ok) throw new Error(`SAP batch HTTP ${response.status}`);
				const contentType = response.headers.get('Content-Type') ?? '';
				const boundaryMatch = contentType.match(
					/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i
				);
				if (!boundaryMatch)
					throw new Error('Missing multipart response boundary');
				const text = await response.text();
				usage.received += Buffer.byteLength(text);
				const responseBoundary = boundaryMatch[1] ?? boundaryMatch[2];
				const chunks = text.split(`--${responseBoundary}`);
				if (!chunks.at(-1)?.startsWith('--'))
					throw new Error('Unterminated multipart response');
				const parts = chunks.slice(1, -1);
				if (parts.length !== queries.length) {
					throw new Error(
						`Expected ${queries.length} subresponses, received ${parts.length}`
					);
				}
				return parts.map((part, index) => {
					try {
						return {
							rows: parsePart(part, queries[index], allowLimitedResults)
						};
					} catch (error) {
						return { error };
					}
				});
			})(),
			deadline
		]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Keep result slots tied to their query even when only failed subrequests are retried.
 * timeoutMs bounds a single fetch; deadlineMs bounds all attempts/backoff for each chunk.
 */
export async function requestBatch(
	endpoint,
	queries,
	lang = 'en',
	options = {}
) {
	const {
		maxRetry = 2,
		maxBatchSize = 100,
		timeoutMs = 10000,
		deadlineMs = 30000,
		retryDelayMs = 500,
		validate = () => {},
		allowLimitedResults = false
	} = options;
	for (const [name, value] of Object.entries({
		maxRetry,
		maxBatchSize,
		timeoutMs,
		deadlineMs,
		retryDelayMs
	})) {
		if (
			!Number.isSafeInteger(value) ||
			value < (['maxRetry', 'retryDelayMs'].includes(name) ? 0 : 1)
		) {
			throw new Error(`Invalid SAP option ${name}`);
		}
	}
	const results = new Array(queries.length);
	for (let offset = 0; offset < queries.length; offset += maxBatchSize) {
		let pending = queries
			.slice(offset, offset + maxBatchSize)
			.map((query, index) => ({ query, index: offset + index }));
		const deadline = Date.now() + deadlineMs;
		let lastError;
		for (let attempt = 0; attempt <= maxRetry && pending.length; attempt++) {
			const remaining = deadline - Date.now();
			if (remaining <= 0) break;
			let responses;
			try {
				responses = await requestSAP(
					endpoint,
					pending.map(({ query }) => query),
					lang,
					Math.min(timeoutMs, remaining),
					allowLimitedResults
				);
			} catch (error) {
				responses = pending.map(() => ({ error }));
			}
			const failed = [];
			for (let i = 0; i < pending.length; i++) {
				const { query, index } = pending[i];
				try {
					if (responses[i].error) throw responses[i].error;
					validate(responses[i].rows, index);
					results[index] = responses[i].rows;
				} catch (error) {
					lastError = new SAPRequestError(
						`${context(endpoint, query, lang)}: ${safe(error.message)}`,
						{ cause: error }
					);
					failed.push(pending[i]);
				}
			}
			pending = failed;
			if (!pending.length) break;
			if (attempt < maxRetry) {
				console.error(
					`SAP attempt ${attempt + 1}/${maxRetry + 1} failed (${pending.length} queries): ${lastError.message}`
				);
				const delay = Math.min(
					retryDelayMs * 2 ** attempt,
					Math.max(0, deadline - Date.now())
				);
				if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
		if (pending.length) {
			throw new SAPRequestError(
				`SAP request failed within ${deadlineMs}ms retry budget: ${lastError?.message ?? context(endpoint, pending[0].query, lang)}`,
				{ cause: lastError }
			);
		}
	}
	return results;
}
