// Manual visual QA: do not replace this with geometry/visibility assertions.
// Playwright's normal WebKit screenshot preparation can hide reveal failures.
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { localQaOrigin } from './localQa.mjs';

const require = createRequire(import.meta.url);
const source = dirname(require.resolve('playwright-core/package.json'));
const version = JSON.parse(
	await readFile(join(source, 'package.json'), 'utf8')
).version;
if (version !== '1.57.0')
	throw new Error('Review the no-flush adapter for this Playwright version.');
const origin = localQaOrigin(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
);
const output = resolve(process.argv[2] ?? '/tmp/catalog-wheel-audit');
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), 'catalog-wheel-driver-'));
const driver = join(temporary, 'playwright-core');
const input = createInterface({ input: process.stdin, output: process.stdout });
const results = [];
let browser;
try {
	await cp(source, driver, { recursive: true });
	// Change only an isolated test-driver copy, never the installed driver or engine.
	for (const [file, before, after] of [
		[
			'screenshotter.js',
			'const syncAnimations = this._page.delegate.shouldToggleStyleSheetToSyncAnimations();',
			'const syncAnimations = false;'
		],
		[
			'webkit/wkInput.js',
			'    await this._session.send("Page.updateScrollingState");\n    await progress.race(this._page.mainFrame().evaluateExpression(`new Promise(requestAnimationFrame)`, { world: "utility" }));\n',
			''
		]
	]) {
		const path = join(driver, 'lib/server', file);
		const text = await readFile(path, 'utf8');
		if (!text.includes(before))
			throw new Error(`Unsupported driver implementation: ${file}`);
		await writeFile(path, text.replace(before, after));
	}
	const { webkit } = await import(
		pathToFileURL(join(driver, 'index.mjs')).href
	);
	browser = await webkit.launch({
		proxy: { server: 'http://127.0.0.1:9', bypass: 'localhost,127.0.0.1,[::1]' }
	});
	const guest = {
		degree: ['2021_200', '00002120', 'SC00001313_CG00004522'],
		semesters: [[], [], []],
		currentSemester: 0,
		exemptions: [],
		wishlist: []
	};
	for (const [language, width] of [
		['en', 390],
		['he', 390],
		['en', 1180],
		['he', 1180]
	]) {
		// Wheel input is unsupported in Playwright's mobile-WebKit mode. These are
		// wheel-capable narrow/wide WebKit contexts, not physical iPhone tests.
		const context = await browser.newContext({
			viewport: { width, height: 844 },
			serviceWorkers: 'block'
		});
		await context.route('**/*', (route) =>
			new URL(route.request().url()).origin === origin
				? route.continue()
				: route.abort()
		);
		await context.addInitScript(
			({ guest, language }) => {
				localStorage.setItem('lang', language);
				localStorage.setItem('theme', language === 'he' ? 'dark' : 'light');
				localStorage.setItem('version', '4');
				localStorage.setItem('userData', JSON.stringify(guest));
				window.wheelAudit = { lastScroll: 0, wheels: [], pointers: [] };
				document.addEventListener(
					'scroll',
					() => (window.wheelAudit.lastScroll = performance.now()),
					true
				);
				document.addEventListener(
					'wheel',
					(event) =>
						window.wheelAudit.wheels.push({
							trusted: event.isTrusted,
							x: event.deltaX,
							y: event.deltaY
						}),
					{ passive: true }
				);
				for (const type of ['pointerdown', 'pointerup', 'click'])
					document.addEventListener(
						type,
						(event) =>
							window.wheelAudit.pointers.push({
								type,
								trusted: event.isTrusted,
								tag: event.target.tagName,
								href: event.target.closest('a')?.href,
								x: event.clientX,
								y: event.clientY
							}),
						true
					);
			},
			{ guest, language }
		);
		const page = await context.newPage();
		await page.goto(origin + '/app/catalog');
		await page.waitForFunction(
			() =>
				document.querySelectorAll('.catalog-page .course-card').length ===
					827 &&
				!document.querySelector(
					'.catalog-page .catalog-loading,.catalog-page .course-loading'
				)
		);
		await page.evaluate(() => document.fonts.ready);
		await page.mouse.move(width / 2, 420);
		const captures = [];
		const capture = async (label) => {
			const path = join(output, `${language}-${width}-${label}.png`);
			// Viewport capture only; no stylesheet/caret changes, animation flushing,
			// element screenshots, scrollTop writes, or descendant geometry reads.
			await page.screenshot({ path, caret: 'initial', animations: 'allow' });
			captures.push(path);
		};
		for (let step = 1; step <= 8; step++) {
			await page.mouse.wheel(0, 640);
			await page.evaluate(
				() =>
					new Promise((resolve) =>
						requestAnimationFrame(() => requestAnimationFrame(resolve))
					)
			);
			if ([1, 4, 8].includes(step)) await capture(`wheel-${step}`);
		}
		// Establish a settled screenshot using scroll-event timestamps, not geometry.
		// This does not delay or retry a click, or insert a pause between down and up.
		await page.waitForFunction(
			() => performance.now() - window.wheelAudit.lastScroll > 250
		);
		await capture('settled');
		console.log(JSON.stringify({ language, width, captures }));
		const { x, y, code } = JSON.parse(
			await input.question(
				'Inspect screenshots; enter {"x":number,"y":number,"code":"course code"}: '
			)
		);
		if (!Number.isFinite(x) || !Number.isFinite(y) || !/^\d{8}$/.test(code))
			throw new Error('Invalid coordinate/course selection');
		await page.mouse.click(x, y); // One native click, no locator actionability read/retry.
		let passed = true;
		try {
			await page.waitForURL(origin + '/app/course/' + code, { timeout: 5000 });
		} catch {
			passed = false;
			process.exitCode = 1;
		}
		const result = {
			language,
			width,
			captures,
			expectedCode: code,
			passed,
			url: page.url(),
			input: await page.evaluate(() => window.wheelAudit)
		};
		results.push(result);
		console.log(JSON.stringify(result));
		await context.close();
	}
} finally {
	input.close();
	await browser?.close();
	await writeFile(
		join(output, 'results.json'),
		JSON.stringify({ version, results }, null, 2)
	);
	await rm(temporary, { recursive: true, force: true });
}
