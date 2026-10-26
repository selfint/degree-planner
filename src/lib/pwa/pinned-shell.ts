import { shellRecoveryScript } from './shell-recovery';

/** Navigations belong to the installed worker, not the current network release.
 * Repair must verify this worker's build before storing any fetched document. */
export async function servePinnedShell(
	read: () => Promise<Response | undefined>,
	repair: () => Promise<void>
): Promise<Response> {
	try {
		const cached = await read();
		if (cached) return cached;
		await repair();
		const restored = await read();
		if (restored) return restored;
	} catch (error) {
		console.warn('PlanIt installed shell unavailable', error);
		// Never fall through to network navigation HTML: it may belong to a
		// newer deployment whose worker has not been accepted by the user.
	}
	return new Response(
		`<!doctype html><html lang="he" dir="rtl" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PlanIt</title><style>
:root{color-scheme:dark;--bg:#19191d;--fg:#fff;--muted:#adb5b9;--accent:#4ca59f;--border:#45454d}html[data-theme=light]{color-scheme:light;--bg:#f8fafc;--fg:#172533;--muted:#435261;--accent:#0f6f67;--border:#ccd4da}*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:1.5rem;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,sans-serif}main{width:min(100%,28rem)}h1{font-size:1.35rem;line-height:1.4}p{color:var(--muted);line-height:1.6;overflow-wrap:anywhere}.actions{display:flex;gap:.75rem;flex-wrap:wrap;align-items:center}button,a{font:inherit;color:var(--fg);border:1px solid var(--border);background:transparent;border-radius:.5rem;padding:.65rem .85rem;text-decoration:none;cursor:pointer}button{border-color:var(--accent)}button:disabled{opacity:.6;cursor:wait}button:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}#recovery-status{min-height:1.6em;font-size:.9rem}
</style></head><body><main><h1 id="recovery-title">לא ניתן לפתוח את הגרסה המותקנת</h1><p id="recovery-description">קובצי היישום המותקן אינם זמינים. התוכניות השמורות לא נמחקו. נסו שוב או עדכנו את היישום המותקן.</p><div class="actions"><button id="recover-app" type="button">עדכון היישום המותקן</button><a id="recovery-retry" href="">נסו שוב</a></div><p id="recovery-status" role="status" aria-live="polite"></p><noscript>JavaScript is required to update PlanIt. / יש להפעיל JavaScript כדי לעדכן את PlanIt.</noscript></main><script>${shellRecoveryScript()}</script></body></html>`,
		{
			status: 503,
			headers: {
				'content-type': 'text/html; charset=utf-8',
				'cache-control': 'no-store'
			}
		}
	);
}
