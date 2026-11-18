// Diagnostic trace, not a paint-latency benchmark. No visibility/geometry reads.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { localQaOrigin } from './localQa.mjs';
const origin = localQaOrigin(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
);
const out = process.argv[2] ?? '/tmp/catalog-work';
const browser = await chromium.launch({
	args: ['--disable-background-networking'],
	proxy: { server: 'http://127.0.0.1:9', bypass: 'localhost,127.0.0.1,[::1]' }
});
try {
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
		serviceWorkers: 'block',
		proxy: { server: 'http://127.0.0.1:9', bypass: 'localhost,127.0.0.1,[::1]' }
	});
	await context.route('**/*', (route) =>
		new URL(route.request().url()).origin === origin
			? route.continue()
			: route.abort()
	);
	await context.addInitScript(() => {
		localStorage.setItem('lang', 'en');
		localStorage.setItem('version', '4');
		localStorage.setItem(
			'userData',
			JSON.stringify({
				degree: ['2021_200', '00002120', 'SC00001313_CG00004522'],
				semesters: [['01040033', '02340124'], [], []],
				currentSemester: 1,
				exemptions: [],
				wishlist: []
			})
		);
	});
	const page = await context.newPage();
	await page.goto(origin + '/app/plan');
	await page.waitForFunction(
		() =>
			document.querySelector('.console-shell:not([inert])') &&
			!document.querySelector('.console-loading')
	);
	const cdp = await context.newCDPSession(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
	const frames = () =>
		page.evaluate(
			() =>
				new Promise((resolve) => {
					let left = 8;
					const next = () => (--left ? requestAnimationFrame(next) : resolve());
					requestAnimationFrame(next);
				})
		);
	for (const kind of ['first', 'repeat-immediate', 'repeat-settled']) {
		const traceEvents = [];
		const collect = ({ value }) => traceEvents.push(...value);
		cdp.on('Tracing.dataCollected', collect);
		await cdp.send('Profiler.enable');
		await cdp.send('Profiler.start');
		await cdp.send('Tracing.start', {
			categories:
				'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing',
			options: 'record-as-much-as-possible'
		});
		await page.evaluate(() =>
			document.addEventListener(
				'click',
				(event) => {
					if (
						event.isTrusted &&
						event.target.closest('a[href$="/app/catalog"]')
					)
						performance.mark('catalog-native-click');
				},
				{ once: true, capture: true }
			)
		);
		// Known header coordinates from the checked 390px English layout. Native input,
		// no locator actionability check, hit testing, checkVisibility or layout query.
		await page.mouse.click(276, 25);
		await page.waitForFunction(
			() =>
				document.querySelector(
					'a[href$="/app/catalog"][aria-current="page"]'
				) &&
				document.querySelector('[data-catalog-cache]:not([inert])') &&
				document.querySelectorAll('.catalog-page .course-card').length ===
					827 &&
				!document.querySelector(
					'.catalog-page .catalog-loading,.catalog-page .course-loading'
				)
		);
		await frames();
		await page.evaluate(() => performance.mark('catalog-profile-end'));
		const { profile } = await cdp.send('Profiler.stop');
		const complete = new Promise((resolve) =>
			cdp.once('Tracing.tracingComplete', resolve)
		);
		await cdp.send('Tracing.end');
		await complete;
		cdp.off('Tracing.dataCollected', collect);
		writeFileSync(`${out}.${kind}.cpuprofile`, JSON.stringify(profile));
		writeFileSync(`${out}.${kind}.trace.json`, JSON.stringify({ traceEvents }));
		await page.screenshot({
			path: `${out}.${kind}.png`,
			caret: 'initial',
			animations: 'allow'
		});
		console.log(
			JSON.stringify({
				kind,
				rate: 4,
				trace: `${out}.${kind}.trace.json`,
				note: 'Eight observation frames after full DOM readiness; not a first-paint metric.'
			})
		);
		await page.mouse.click(328, 25);
		await page.waitForURL(origin + '/app/plan');
		if (kind === 'repeat-immediate') await frames();
	}
} finally {
	await browser.close();
}
