import {
	expect,
	type Page,
	type Locator,
	type Browser
} from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type Language = 'en' | 'he';
export type Theme = 'light' | 'dark';
export const rawRoot = path.resolve('test-results/tutorials-raw');
const demo = process.env.PW_DEMO === 'on';

// The SVG, 56px cursor, pressed scale and pulse styling are from Planit's
// first-time-user-experience.spec.ts, pinned and attributed in tutorials/README.md.
export async function installCursor(page: Page) {
	const svg = await readFile(
		new URL('../assets/modern-cursor.svg', import.meta.url),
		'utf8'
	);
	await page.addStyleTag({
		content: `
		* { cursor: none !important; }
		.demo-cursor { position: fixed; width: 56px; height: 56px; pointer-events: none; z-index: 999999; transform: translate(-50%, -50%); transition: transform 140ms ease-out, filter 140ms ease-out; filter: drop-shadow(0 6px 14px rgb(2 6 23 / 0.24)); }
		.demo-cursor svg { display: block; width: 100%; height: 100%; }
		.demo-cursor[data-pressed='true'] { transform: translate(-50%, -50%) scale(0.9); filter: drop-shadow(0 3px 8px rgb(2 6 23 / 0.2)); }
		.demo-click-pulse { position: fixed; width: 12px; height: 12px; border-radius: 9999px; border: 2px solid var(--color-accent, rgb(20 184 166)); background: transparent; pointer-events: none; z-index: 999998; transform: translate(-50%, -50%) scale(0.2); animation: demo-click-pulse 520ms ease-out forwards; }
		@keyframes demo-click-pulse { 0% { opacity: 0.95; transform: translate(-50%, -50%) scale(0.2); } 70% { opacity: 0.4; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(3.8); } }
		.tutorial-caption { position: fixed; z-index: 999990; inset: auto 32px 28px; padding: 20px 26px; border: 1px solid rgb(var(--color-border)); border-radius: 16px; background: rgb(var(--color-background) / 0.97); color: rgb(var(--color-content-primary)); font: 500 28px/1.45 system-ui, sans-serif; text-align: start; box-shadow: 0 8px 36px #0002; pointer-events: none; }
		.tutorial-caption strong { display: block; color: rgb(var(--color-accent-primary)); font-size: 18px; margin-bottom: 4px; }
		[data-tutorial-focus] { outline: 2px solid rgb(var(--color-accent-primary)); outline-offset: 4px; border-radius: 2px; }
	`
	});
	await page.evaluate((svg) => {
		const cursor = document.createElement('div');
		cursor.className = 'demo-cursor';
		cursor.innerHTML = svg;
		cursor.setAttribute('aria-hidden', 'true');
		cursor.style.left = '840px';
		cursor.style.top = '400px';
		document.body.append(cursor);
		document.addEventListener('mousemove', (event) => {
			cursor.style.left = `${event.clientX}px`;
			cursor.style.top = `${event.clientY}px`;
		});
	}, svg);
	await page.mouse.move(840, 400);
}

export async function pause(page: Page, milliseconds: number) {
	if (demo) await page.waitForTimeout(milliseconds);
}

export async function moveTo(page: Page, target: Locator) {
	await expect(target).toBeVisible();
	const box = await target.boundingBox();
	if (!box) throw new Error('Tutorial target has no visible bounding box');
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
		steps: demo ? 30 : 1
	});
}

export async function click(page: Page, target: Locator) {
	await target.scrollIntoViewIfNeeded();
	await moveTo(page, target);
	await pause(page, 300);
	await page.evaluate(() => {
		const cursor = document.querySelector<HTMLElement>('.demo-cursor')!;
		cursor.dataset.pressed = 'true';
		const pulse = document.createElement('span');
		pulse.className = 'demo-click-pulse';
		pulse.style.left = cursor.style.left;
		pulse.style.top = cursor.style.top;
		document.body.append(pulse);
		setTimeout(() => pulse.remove(), 650);
	});
	await page.mouse.down();
	await pause(page, 80);
	await page.mouse.up();
	await page.evaluate(() => {
		document.querySelector<HTMLElement>('.demo-cursor')!.dataset.pressed =
			'false';
	});
}

export async function createRecording(
	browser: Browser,
	baseURL: string,
	language: Language,
	theme: Theme,
	semesters: string[][]
) {
	await mkdir(rawRoot, { recursive: true });
	const context = await browser.newContext({
		baseURL,
		viewport: { width: 960, height: 720 },
		colorScheme: theme,
		serviceWorkers: 'allow',
		...(demo
			? { recordVideo: { dir: rawRoot, size: { width: 960, height: 720 } } }
			: {})
	});
	const page = await context.newPage();
	await page.addInitScript(
		({ language, theme, semesters }) => {
			localStorage.setItem('lang', language);
			localStorage.setItem('theme', theme);
			if (!localStorage.getItem('version')) {
				localStorage.setItem('version', '4');
				localStorage.setItem(
					'userData',
					JSON.stringify({
						degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
						currentSemester: 0,
						semesters,
						exemptions: [],
						wishlist: []
					})
				);
			}
		},
		{ language, theme, semesters }
	);
	// Public course/catalog JSON and the real guest storage are untouched.
	// External requests are blocked in these fictional guest recordings.
	await page.route('**/*', (route) =>
		new URL(route.request().url()).origin === new URL(baseURL).origin
			? route.continue()
			: route.abort()
	);
	let started = 0;
	const captions: { start: number; end: number; text: string }[] = [];
	return {
		page,
		context,
		async start() {
			// Genuine offline readiness; never hide a failure footer for a recording.
			await expect(page.getByTestId('pwa-status')).toHaveAttribute(
				'data-state',
				'ready',
				{ timeout: 60_000 }
			);
			await expect(page.getByTestId('pwa-error-detail')).toHaveCount(0);
			await page.evaluate(() => document.fonts.ready);
			await installCursor(page);
			if (demo) {
				// A removed slate gives the encoder an actual video-frame boundary,
				// rather than estimating setup from asynchronous wall-clock duration.
				await page.evaluate(() => {
					const slate = document.createElement('div');
					slate.id = 'tutorial-recording-slate';
					slate.style.cssText =
						'position:fixed;inset:0;z-index:2147483647;background:rgb(255,0,255)';
					document.body.append(slate);
				});
				await page.waitForTimeout(400);
				await page.evaluate(() =>
					document.getElementById('tutorial-recording-slate')!.remove()
				);
			}
			started = Date.now();
		},
		async caption(title: string, text: string, target?: Locator) {
			await expect(page.getByTestId('pwa-error-detail')).toHaveCount(0);
			const now = (Date.now() - started) / 1000;
			if (captions.length) captions.at(-1)!.end = now;
			captions.push({ start: now, end: now + 3, text: `${title}: ${text}` });
			await page.evaluate(
				({ title, text, language }) => {
					document
						.querySelector('[data-tutorial-focus]')
						?.removeAttribute('data-tutorial-focus');
					let overlay =
						document.querySelector<HTMLElement>('.tutorial-caption');
					if (!overlay) {
						overlay = document.createElement('div');
						overlay.className = 'tutorial-caption';
						document.body.append(overlay);
					}
					overlay.dir = language === 'he' ? 'rtl' : 'ltr';
					overlay.replaceChildren();
					const heading = document.createElement('strong');
					heading.textContent = title;
					overlay.append(heading, document.createTextNode(text));
				},
				{ title, text, language }
			);
			if (target) {
				await target.evaluate((node) =>
					node.setAttribute('data-tutorial-focus', '')
				);
				await moveTo(page, target);
			}
			await expect(page.locator('.tutorial-caption')).toContainText(text);
		},
		async frame(name: string) {
			await page.screenshot({ path: path.join(rawRoot, `${name}.png`) });
		},
		async finish(name: string) {
			const duration = (Date.now() - started) / 1000;
			if (captions.length) captions.at(-1)!.end = duration;
			const video = page.video();
			await page.close();
			if (!demo) return;
			expect(
				video,
				'record mode must produce a real browser video'
			).not.toBeNull();
			await video!.saveAs(path.join(rawRoot, `${name}.webm`));
			await writeFile(
				path.join(rawRoot, `${name}.json`),
				JSON.stringify(
					{ duration, captions, language, theme, timeline: 'magenta-slate-v1' },
					null,
					2
				)
			);
		}
	};
}
