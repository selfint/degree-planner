import { spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(
	new URL('./preferUbuntuArchive.sh', import.meta.url)
);
const mirrors =
	'http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n' +
	'https://archive.ubuntu.com/ubuntu/\tpriority:2\n' +
	'https://security.ubuntu.com/ubuntu/\tpriority:3\n';

describe('Ubuntu runner mirror preference', () => {
	let directory;
	let mirrorFile;
	beforeEach(() => {
		directory = mkdtempSync(path.join(tmpdir(), 'journey-apt-mirrors-'));
		mirrorFile = path.join(directory, 'apt-mirrors.txt');
	});
	afterEach(() => rmSync(directory, { recursive: true, force: true }));

	const run = (file) => {
		const result = spawnSync('bash', [script, file], { encoding: 'utf8' });
		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
		return result.stdout;
	};

	it('only demotes Azure while preserving official fallback and signing bytes', () => {
		writeFileSync(mirrorFile, mirrors);
		const sourcesFile = path.join(directory, 'ubuntu.sources');
		const sources =
			'Types: deb\nURIs: mirror+file:/etc/apt/apt-mirrors.txt\n' +
			'Suites: noble noble-updates noble-security\nComponents: main universe\n' +
			'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n';
		writeFileSync(sourcesFile, sources);
		run(mirrorFile);
		expect(readFileSync(mirrorFile, 'utf8')).toBe(
			mirrors.replace('priority:1', 'priority:4')
		);
		expect(readFileSync(sourcesFile, 'utf8')).toBe(sources);
	});

	it('is idempotent and leaves unrelated or already customized entries untouched', () => {
		const content =
			mirrors +
			'# http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n' +
			'http://azure.archive.ubuntu.com/ubuntu/\tpriority:10\n' +
			'http://azure.archive.ubuntu.com/ubuntu/\tpriority:5\n' +
			'https://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n' +
			'http://azure.archive.ubuntu.com.example/ubuntu/\tpriority:1\n';
		writeFileSync(mirrorFile, content);
		run(mirrorFile);
		run(mirrorFile);
		expect(readFileSync(mirrorFile, 'utf8')).toBe(
			content.replace('priority:1', 'priority:4')
		);
	});

	it('does not create or replace APT configuration if the optional file is absent', () => {
		expect(run(mirrorFile)).toContain('existing APT sources are unchanged');
		expect(existsSync(mirrorFile)).toBe(false);
	});

	it('runs before both dependency installers without changing the capture timeout', () => {
		const workflow = readFileSync(
			new URL(
				'../.github/workflows/student-journey-videos.yml',
				import.meta.url
			),
			'utf8'
		);
		const preference = workflow.indexOf(
			'sudo bash scripts/preferUbuntuArchive.sh'
		);
		expect(preference).toBeGreaterThan(-1);
		for (const installer of [
			'npx playwright install --with-deps chromium',
			'sudo apt-get update && sudo apt-get install -y ffmpeg'
		])
			expect(workflow.indexOf(installer)).toBeGreaterThan(preference);
		expect(workflow).toContain('timeout-minutes: 30');
	});
});
