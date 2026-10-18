export type TutorialTopic = 'course-card' | 'plan-course';
export const tutorialCopy = {
	en: {
		title: 'See how it works',
		intro: 'Two short walkthroughs, recorded in the real planner.',
		transcript: 'Read the steps',
		unavailable:
			'The video could not load. You can still read every step below.',
		captions: 'English descriptions',
		'course-card': {
			title: 'Read a course card',
			description:
				'Zoom in on the details, then follow the cursor from the exam marker to requirement warnings.',
			steps: [
				{
					title: 'Course marker',
					text: 'Color identifies the course. A circle means an exam is listed; a square means none is listed.'
				},
				{
					title: 'Median',
					text: 'The smaller number is the historical median grade, when available.'
				},
				{
					title: 'Credits',
					text: 'The bold number is the credit value of the course.'
				},
				{
					title: 'Course name',
					text: 'The name stays readable for up to three lines. Open the course to see all its details.'
				},
				{
					title: 'Course code',
					text: 'The code uniquely identifies the course, including its leading zeroes.'
				},
				{
					title: 'Requirement warnings',
					text: 'Open the warning to check prerequisites, corequisites, exclusions, or semester availability.'
				}
			]
		},
		'plan-course': {
			title: 'Find a course and plan it',
			description:
				'Search, inspect the course, add it to your current semester, and check your plan.',
			steps: [
				{
					title: 'Search',
					text: 'Enter a course name or code, then press Enter.'
				},
				{
					title: 'Open the course',
					text: 'Select the matching card to see the description, credits, and prerequisites.'
				},
				{
					title: 'Add to your semester',
					text: 'Choose Plan to add the course to the current semester.'
				},
				{
					title: 'Check your plan',
					text: 'Open Plan. The course is in your semester, and the credit total has updated.'
				}
			]
		}
	},
	he: {
		title: 'רואים איך זה עובד',
		intro: 'שתי הדרכות קצרות, שהוקלטו בתוך המתכנן.',
		transcript: 'קריאת השלבים',
		unavailable: 'לא ניתן לטעון את הסרטון. אפשר לקרוא את כל השלבים בהמשך.',
		captions: 'תיאורים בעברית',
		'course-card': {
			title: 'מכירים את כרטיס הקורס',
			description:
				'מתקרבים לפרטים ועוקבים אחרי הסמן, מסימון המבחן ועד אזהרות הדרישות.',
			steps: [
				{
					title: 'סימון הקורס',
					text: 'הצבע מזהה את הקורס. עיגול מציין מבחן רשום; ריבוע מציין שלא רשום מבחן.'
				},
				{
					title: 'חציון',
					text: 'המספר הקטן הוא חציון הציונים ההיסטורי, כאשר הנתון זמין.'
				},
				{
					title: 'נקודות זכות',
					text: 'המספר המודגש הוא מספר נקודות הזכות של הקורס.'
				},
				{
					title: 'שם הקורס',
					text: 'השם מוצג בעד שלוש שורות. פותחים את הקורס כדי לראות את כל הפרטים.'
				},
				{
					title: 'מספר הקורס',
					text: 'המספר מזהה את הקורס באופן ייחודי, כולל האפסים בתחילתו.'
				},
				{
					title: 'אזהרות דרישות',
					text: 'פותחים את האזהרה כדי לבדוק קורסי קדם, קורסים צמודים, חפיפות או זמינות בסמסטר.'
				}
			]
		},
		'plan-course': {
			title: 'מוצאים קורס ומוסיפים לתוכנית',
			description:
				'מחפשים, בודקים את פרטי הקורס, מוסיפים לסמסטר הנוכחי ורואים את התוכנית.',
			steps: [
				{ title: 'חיפוש', text: 'מקלידים שם או מספר קורס ולוחצים Enter.' },
				{
					title: 'פתיחת הקורס',
					text: 'בוחרים את הכרטיס המתאים כדי לראות תיאור, נקודות זכות ודרישות קדם.'
				},
				{
					title: 'הוספה לסמסטר',
					text: 'לוחצים על הוספה כדי להכניס את הקורס לסמסטר הנוכחי.'
				},
				{
					title: 'בדיקת התוכנית',
					text: 'פותחים את התוכנית. הקורס מופיע בסמסטר וסכום נקודות הזכות מתעדכן.'
				}
			]
		}
	}
} as const;
