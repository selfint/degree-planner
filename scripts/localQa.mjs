const targetVariables = [
	'PLAYWRIGHT_BASE_URL',
	'STORYBOOK_TEST_BASE_URL',
	'PREVIEW_URL'
];

/** @param {string} value @param {string} label */
export function localQaOrigin(value, label = 'QA URL') {
	const url = new URL(value);
	if (
		url.protocol !== 'http:' ||
		!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
		url.username ||
		url.password ||
		url.pathname !== '/' ||
		url.search ||
		url.hash
	)
		throw new Error(`${label} must be an HTTP loopback origin for local QA.`);
	return url.origin;
}

/** @param {Record<string, string | undefined>} env */
export function assertLocalQaTargets(env = process.env) {
	for (const name of targetVariables)
		if (env[name] !== undefined) localQaOrigin(env[name], name);
}

/** @param {string} origin @param {Record<string, string | undefined>} env */
export function localQaServer(origin, env = process.env) {
	const url = new URL(localQaOrigin(origin));
	const host = url.hostname.replace(/^\[|\]$/g, '');
	const build = env.PLANIT_QA_PREBUILT === '1' ? '' : 'npm run build && ';
	return {
		command: `${build}npm run preview -- --host ${host} --port ${url.port || '80'} --strictPort`,
		url: url.origin,
		timeout: 180_000,
		reuseExistingServer: !env.CI
	};
}

// Validate inherited overrides before any browser, proxy or recording starts.
assertLocalQaTargets();
