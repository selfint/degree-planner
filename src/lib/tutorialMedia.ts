/** Recording inventory, not a declaration that generated assets are published. */
export const mediaGroups = {
	tutorials: ['course-card', 'plan-course'],
	features: ['feature-search']
} as const;
export type MediaTopic = (typeof mediaGroups)[keyof typeof mediaGroups][number];

export function selectMediaTopics(group = 'tutorials'): readonly MediaTopic[] {
	if (group === 'all') return Object.values(mediaGroups).flat();
	if (group === 'tutorials' || group === 'features') return mediaGroups[group];
	throw new Error(`Unknown media group: ${group}`);
}

export function mediaVariants(topic: MediaTopic) {
	return (['en', 'he'] as const).flatMap((language) =>
		(['light', 'dark'] as const).map((theme) => ({
			topic,
			language,
			theme,
			name: `${topic}-${language}-${theme}`
		}))
	);
}
