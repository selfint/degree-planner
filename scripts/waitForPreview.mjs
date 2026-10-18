import { mkdir, writeFile } from 'node:fs/promises';
import { previewBuildCommit } from './previewBuildCommit.mjs';

// Read-only GitHub API gate for the mutable preview alias. No Vercel credential
// or deployment mutation is needed. --verify-only rechecks after the browser run.
const {
	GITHUB_TOKEN: token,
	GITHUB_REPOSITORY: repository,
	PREVIEW_HEAD_SHA: expectedSha,
	PREVIEW_HEAD_REF: branch,
	PREVIEW_URL: previewUrl
} = process.env;
if (!token || !repository || !expectedSha || !branch || !previewUrl)
	throw new Error(
		'Missing GitHub read token, repository, expected PR head/ref or PREVIEW_URL.'
	);
if (!/^[a-f0-9]{40}$/i.test(expectedSha))
	throw new Error('Expected a full commit SHA.');
const preview = new URL(previewUrl);
if (preview.protocol !== 'https:' || preview.username || preview.password)
	throw new Error('Preview must be a public HTTPS URL without credentials.');
const verifyOnly = process.argv.includes('--verify-only');
const deadline = Date.now() + (verifyOnly ? 30_000 : 12 * 60_000);
const contextName = process.env.VERCEL_STATUS_CONTEXT ?? 'Vercel';

async function github(path) {
	const response = await fetch(
		`https://api.github.com/repos/${repository}/${path}`,
		{
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${token}`,
				'X-GitHub-Api-Version': '2022-11-28'
			},
			signal: AbortSignal.timeout(20_000)
		}
	);
	if (!response.ok)
		throw new Error(`GitHub read failed: ${response.status} for ${path}`);
	return response.json();
}

async function assertCurrentHead() {
	const ref = await github(
		`git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`
	);
	if (ref.object?.sha !== expectedSha)
		throw new Error(
			`Preview run superseded: branch head is ${ref.object?.sha}, expected ${expectedSha}.`
		);
}

while (true) {
	await assertCurrentHead();
	const result = await github(`commits/${expectedSha}/status?per_page=100`);
	const status = result.statuses?.find((item) => item.context === contextName);
	let servedCommit = null;
	if (status?.state === 'success') {
		const landing = await fetch(new URL('/', preview), {
			signal: AbortSignal.timeout(20_000),
			redirect: 'manual'
		});
		if (!landing.ok)
			throw new Error(`Preview landing returned HTTP ${landing.status}.`);
		servedCommit = previewBuildCommit(await landing.text());
	}
	if (servedCommit === expectedSha) {
		await assertCurrentHead();
		const response = await fetch(new URL('/app/', preview), {
			signal: AbortSignal.timeout(20_000),
			redirect: 'manual'
		});
		if (!response.ok)
			throw new Error(
				`Published preview did not return its public app shell: HTTP ${response.status}.`
			);
		await response.body?.cancel();
		const evidence = {
			expectedCommit: expectedSha,
			servedCommit,
			servedCommitMatches: true,
			branch,
			checkedAt: new Date().toISOString(),
			previewOrigin: preview.origin,
			vercelStatus: status.state,
			statusContext: status.context,
			statusUpdatedAt: status.updated_at,
			currentBranchMatches: true,
			verification: verifyOnly ? 'after-browser-run' : 'before-browser-run',
			verificationMethod:
				'Public landing HTML build-SHA marker, successful commit status and current branch ref.'
		};
		await mkdir('test-results/deployed-preview-gate', { recursive: true });
		await writeFile(
			`test-results/deployed-preview-gate/${verifyOnly ? 'after' : 'before'}.json`,
			`${JSON.stringify(evidence, null, 2)}\n`
		);
		console.log(
			`Vercel succeeded for current branch head ${expectedSha}; public preview responds (${evidence.verification}).`
		);
		break;
	}
	if (status && ['failure', 'error'].includes(status.state))
		throw new Error(
			`Vercel deployment status is ${status.state} for ${expectedSha}.`
		);
	if (verifyOnly || Date.now() >= deadline)
		throw new Error(
			`Preview did not serve expected commit ${expectedSha} within the allowed wait (status: ${status?.state ?? 'missing'}, served: ${servedCommit ?? 'no build marker'}).`
		);
	console.log(
		`Waiting for ${preview.hostname} to serve ${expectedSha.slice(0, 12)} (${status?.state ?? 'not posted yet'}, served: ${servedCommit?.slice(0, 12) ?? 'no build marker'}).`
	);
	await new Promise((resolve) => setTimeout(resolve, 15_000));
}
