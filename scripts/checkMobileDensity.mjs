import { spawnSync } from 'node:child_process';
import {
	cp,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	symlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Deliberately fixed: comparisons must not drift to a later PR revision.
const baselineRevision = '7d52aaf00df3ffe7e0a3f572b97431e6f3e4ff3b';
const root = process.cwd();
const output = resolve('test-results/mobile-density');
const temporary = await mkdtemp(join(tmpdir(), 'degree-planner-density-'));
const before = join(temporary, 'before');

function run(command, args, cwd = root, env = {}) {
	const result = spawnSync(command, args, {
		cwd,
		env: { ...process.env, ...env },
		stdio: 'inherit'
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
}
function revision() {
	const result = spawnSync('git', ['rev-parse', 'HEAD'], {
		cwd: root,
		encoding: 'utf8'
	});
	if (result.status !== 0) throw new Error('Cannot identify source revision');
	return result.stdout.trim();
}
async function reports(directory) {
	const found = [];
	const entries = await readdir(directory, { withFileTypes: true }).catch(
		(error) => {
			if (error.code === 'ENOENT') return [];
			throw error;
		}
	);
	for (const entry of entries) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) found.push(...(await reports(path)));
		else if (entry.name === 'density.json')
			found.push(JSON.parse(await readFile(path, 'utf8')));
	}
	return found;
}

const executionFailures = [];
function capture(cwd, variant, sourceRevision) {
	try {
		run(
			'npx',
			['playwright', 'test', '--config=playwright.density.config.ts'],
			cwd,
			{
				DENSITY_VARIANT: variant,
				DENSITY_SOURCE_REVISION: sourceRevision,
				DENSITY_OUTPUT_DIR: join(output, variant)
			}
		);
	} catch (error) {
		executionFailures.push(`${variant} browser suite failed: ${error.message}`);
	}
}

let hasWorktree = false;
try {
	await mkdir(output, { recursive: true });
	// actions/checkout uses a shallow clone. Fetch just the exact baseline object.
	const exists = spawnSync(
		'git',
		['cat-file', '-e', `${baselineRevision}^{commit}`],
		{ stdio: 'ignore' }
	);
	if (exists.status !== 0)
		run('git', ['fetch', '--depth=1', 'origin', baselineRevision]);
	run('git', ['worktree', 'add', '--detach', before, baselineRevision]);
	hasWorktree = true;
	await cp(join(root, 'density-tests'), join(before, 'density-tests'), {
		recursive: true
	});
	await cp(
		join(root, 'playwright.density.config.ts'),
		join(before, 'playwright.density.config.ts')
	);
	await symlink(
		join(root, 'node_modules'),
		join(before, 'node_modules'),
		'dir'
	);
	// Build only the app: Storybook is not part of this actual-shell measurement.
	run('npm', ['run', 'generate-catalogs'], before);
	run('npx', ['vite', 'build'], before);
	capture(before, 'before', baselineRevision);
	// The Chromium integration step already built this checkout. Local runs can
	// opt into building it; never serve the baseline build as the corrected app.
	if (process.argv.includes('--build-head')) {
		run('npm', ['run', 'generate-catalogs']);
		run('npx', ['vite', 'build']);
	}
	capture(root, 'after', revision());

	const oldReports = await reports(join(output, 'before'));
	const newReports = await reports(join(output, 'after'));
	const failures = [...executionFailures];
	const comparisons = [];
	if (oldReports.length !== 4 || newReports.length !== 4)
		failures.push(
			'Expected all four viewport/language pairs on both revisions.'
		);
	for (const current of newReports) {
		const previous = oldReports.find(
			(item) =>
				item.language === current.language &&
				item.viewport.width === current.viewport.width &&
				item.viewport.height === current.viewport.height
		);
		if (!previous) {
			failures.push(
				`No identical baseline viewport/language for ${current.language}.`
			);
			continue;
		}
		if (current.measurements.length !== 6 || previous.measurements.length !== 6)
			failures.push('Incomplete route/state evidence.');
		for (const after of current.measurements) {
			const before = previous.measurements.find(
				(item) => item.route === after.route
			);
			if (!before) {
				failures.push(`No baseline for ${after.route}.`);
				continue;
			}
			const label = `${current.viewport.width}x${current.viewport.height}/${current.language}/${after.route}`;
			const usableHeightGain =
				Math.round(
					(after.usableViewportHeight - before.usableViewportHeight) * 10
				) / 10;
			const taskTopGain =
				Math.round((before.taskContentTop - after.taskContentTop) * 10) / 10;
			const visibleCardGain =
				after.fullyVisibleCourseCards - before.fullyVisibleCourseCards;
			comparisons.push({
				label,
				before,
				after,
				usableHeightGain,
				taskTopGain,
				visibleCardGain
			});
			if (usableHeightGain < 40)
				failures.push(
					`${label}: usable viewport improved only ${usableHeightGain}px; require at least 40px.`
				);
			if (
				before.taskContentTop === null ||
				after.taskContentTop === null ||
				taskTopGain < 40
			)
				failures.push(
					`${label}: primary task starts only ${taskTopGain}px earlier; require at least 40px.`
				);
			if (['plan', 'search'].includes(after.route) && visibleCardGain < 1)
				failures.push(`${label}: no additional fully visible course card.`);
		}
	}
	const report = {
		schemaVersion: 1,
		baselineRevision,
		correctedRevision: revision(),
		thresholds: {
			minimumUsableViewportGainPx: 40,
			minimumTaskTopGainPx: 40,
			minimumExtraVisiblePlanAndSearchCards: 1
		},
		comparisons,
		failures
	};
	await writeFile(
		join(output, 'comparison.json'),
		`${JSON.stringify(report, null, 2)}\n`
	);
	const summary = [
		'# Full-shell mobile density comparison',
		'',
		`Baseline: ${baselineRevision}`,
		`Corrected checkout: ${revision()}`,
		'',
		'Each pair uses the identical viewport, language, public catalog and fictional guest plan. Screenshots show the complete application shell, not Storybook. Measurements use the initial page position and account for card clipping by scrolling ancestors.',
		'',
		'| Viewport/language/route | Header before → after | Task top before → after | Usable height gain | Fully visible cards before → after |',
		'| --- | --- | --- | --- | --- |',
		...comparisons.map(
			({ label, before, after, usableHeightGain }) =>
				`| ${label} | ${before.headerHeight} → ${after.headerHeight}px | ${before.taskContentTop} → ${after.taskContentTop}px | +${usableHeightGain}px | ${before.fullyVisibleCourseCards} → ${after.fullyVisibleCourseCards} |`
		),
		'',
		failures.length
			? `Failed assertions:\n${failures.map((failure) => `- ${failure}`).join('\n')}`
			: 'All density and task-flow assertions passed.',
		'',
		'Limitations: Chromium mobile emulation, not physical-device or installed-app testing. Account sign-in and private data are excluded. Worker update coverage changes only a comment in the actual built worker.'
	].join('\n');
	await writeFile(join(output, 'comparison.md'), `${summary}\n`);
	if (process.env.GITHUB_STEP_SUMMARY)
		await writeFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, {
			flag: 'a'
		});
	if (failures.length) throw new Error(failures.join('\n'));
	console.log(summary);
} finally {
	if (hasWorktree) run('git', ['worktree', 'remove', '--force', before]);
}
