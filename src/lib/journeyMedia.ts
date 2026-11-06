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
export const journeyDescriptions: Record<
	JourneyTopic,
	Record<'en' | 'he', string>
> = {
	'setup-recovery': {
		en: 'Cancel and recover interrupted degree setup, save a real course, then reopen the plan. This journey intentionally switches language, theme and screen size to verify persistence.',
		he: 'ביטול ושחזור הגדרות תואר שנקטעו, שמירת קורס אמיתי ופתיחת התוכנית מחדש. התרחיש משנה בכוונה שפה, ערכת צבעים וגודל מסך כדי לבדוק שמירה.'
	},
	'independent-share': {
		en: 'Generate a share preview, import it into an independent guest, edit the copy and verify that the original owner plan stays unchanged.',
		he: 'יצירת תצוגת שיתוף, ייבוא לאורח עצמאי, עריכת העותק ואימות שתוכנית הבעלים המקורית לא השתנתה.'
	},
	'shorter-import': {
		en: 'Reject a shorter import that would lose Current, choose an in-range Current explicitly, then import and reopen the saved plan.',
		he: 'דחיית ייבוא קצר שיאבד את הסמסטר הנוכחי, בחירה מפורשת של סמסטר נוכחי בטווח, ואז ייבוא ופתיחה מחדש של התוכנית השמורה.'
	},
	'safe-shortening': {
		en: 'Keep the selected Current semester protected until it is explicitly moved, then safely shorten and reload the plan.',
		he: 'שמירה על הסמסטר הנוכחי שנבחר עד לשינוי מפורש שלו, ואז קיצור בטוח וטעינה מחדש של התוכנית.'
	}
};
