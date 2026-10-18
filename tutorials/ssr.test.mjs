import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Exercise the actual production-prerendered document, not source-code strings.
// Run `npm run build` first; a missing output is a setup failure, not feature red.
const html = readFileSync(
	'.svelte-kit/output/prerendered/pages/index.html',
	'utf8'
);

test('the rendered landing page contains two accessible, user-controlled tutorials', () => {
	assert.match(html, /id="landing-title"/, 'the real landing page rendered');
	assert.match(
		html,
		/data-testid="landing-tutorials"/,
		'the rendered landing page must include the tutorial section'
	);
	const videos = [...html.matchAll(/<video\b([^>]*?)>([\s\S]*?)<\/video>/g)];
	assert.equal(videos.length, 2, 'both requested tutorials are rendered');
	for (const [, attributes, body] of videos) {
		assert.match(attributes, /\bcontrols(?:\s|=|$)/);
		assert.match(attributes, /preload="none"/);
		assert.match(attributes, /\bplaysinline(?:\s|=|$)/);
		assert.match(attributes, /aria-label="[^"]+"/);
		assert.doesNotMatch(attributes, /\b(?:autoplay|loop)(?:\s|=|$)/);
		assert.match(body, /type="video\/mp4"/);
		assert.match(body, /type="video\/webm"/);
		assert.match(body, /<track[^>]+kind="captions"/);
	}
	assert.equal(
		(html.match(/class="tutorial-steps/g) ?? []).length,
		2,
		'both transcripts are plain visible lists'
	);
});
