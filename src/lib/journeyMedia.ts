export const journeyTopics = [
	'setup-recovery',
	'independent-share',
	'shorter-import',
	'safe-shortening'
] as const;
export type JourneyTopic = (typeof journeyTopics)[number];
export const journeyTitles: Record<
	JourneyTopic,
	Record<'en' | 'he', string>
> = {
	'setup-recovery': {
		en: 'Recover setup, save and reopen a course',
		he: 'שחזור הגדרות, שמירת קורס ופתיחה מחדש'
	},
	'independent-share': {
		en: 'Share and import into an independent guest',
		he: 'שיתוף וייבוא לאורח עצמאי'
	},
	'shorter-import': {
		en: 'Choose Current before importing a shorter plan',
		he: 'בחירת סמסטר נוכחי לפני ייבוא תוכנית קצרה'
	},
	'safe-shortening': {
		en: 'Shorten a plan without losing Current',
		he: 'קיצור תוכנית בלי לאבד את הסמסטר הנוכחי'
	}
};
export const journeySegments: Record<JourneyTopic, string[]> = {
	'setup-recovery': ['setup-and-save', 'reopen-plan'],
	'independent-share': [
		'owner-share',
		'share-preview',
		'recipient-import',
		'owner-unchanged'
	],
	'shorter-import': ['choose-current'],
	'safe-shortening': ['protect-current']
};
