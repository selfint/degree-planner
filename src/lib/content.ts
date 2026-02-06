export const cms = {
	en: {
		lang: 'en',
		dir: 'ltr',
		common: {
			getStarted: 'Get Started',
			catalog: 'Catalog',
			seasons: ['Winter', 'Spring', 'Summer'],
			na: 'N/A',
			yes: 'Yes',
			no: 'No',
			or: 'OR',
			dependencies: 'Dependencies',
			dependants: 'Dependants',
			adjacencies: 'Adjacencies',
			exclusives: 'Exclusives',
			semester: 'Semester',
			faculty: 'Faculty',
			course: 'Course',
			loading: 'Loading'
		},
		header: {
			searchPlaceholder: 'Search',
			catalog: 'Catalog',
			plan: 'Plan',
			progress: 'Progress',
			name: 'PlanIt.'
		},
		footer: {
			createdBy: 'Created by',
			author: 'Tom Selfin',
			reportIssue: 'Report an issue'
		},
		landing: {
			catchphrase: ['Plan your degree', 'with ease.'],
			howItWorks: [
				'Start from the recommended plan for your degree.',
				'Browse the catalog for interesting courses to fulfill requirements.',
				'Plan your courses for each semester, ensuring their requirements are met.',
				'When test schedules are published, quickly adapt your plan to maximize study time for each test.'
			],
			courseCard: 'The course card is the building block of PlanIt.',
			settings: {
				header: `Settings`,
				description: `
					Select your degree, and optionally a path.

					Upload your transcript to insert your courses.

					You can also manually add all your courses.
				`
			},
			plan: {
				header: `
					Find a plan that satisfies all course requirements.
					Save courses for future planning in your wish list.
				`,
				testSchedule: `
					View the test schedule for the current semester.
					The first value is the date of the first test,
					and each following value is the amount of days
					to the next test.
					The first row is for first exams, and the second for second exams.
				`
			},
			catalog: {
				header: `
					See degree catalog, and your progress in it.
					Progress is by course count and points.
					Each progress bar has 3 values:
				`,
				done: 'done',
				planned: 'planned',
				total: 'total',
				notification: {
					header: 'If a requirement has special rules that were applied, a',
					notification: 'notification',
					footer: 'will appear with an explanation.'
				},
				footer: `
					Courses are sorted by median, and count as done if they
					were taken before the current semester.
				`
			},
			course: `
				See course info, dependencies, exclusives, and more.
				Add them to your current semester or wish list.
				Click the course code to go to the SAP course page.
			`,
			semester: `
				Click on the semester's name to go to its page.
				View all courses that can be taken in that semester.
				For the current semester, see the possible test
				schedules for the courses you have selected.
			`,
			share: {
				title: 'Share Plan',
				description: `
					Share your plan with a unique read-only public link.
					Anyone with the link can view a copy of your plan,
					and can copy it to their own account.

					Even shared links do not allow editing your plan.
				`
			},
			search: `
				Search for courses by name or by number.
			`
		},
		settings: {
			degree: 'Degree',
			share: 'Share plan',
			year: 'Year',
			selectYear: 'Select year',
			faculty: 'Faculty',
			selectFaculty: 'Select faculty',
			path: 'Path',
			selectPath: 'Select path',
			selectDegree: 'Select degree',
			save: 'Save',
			cancel: 'Cancel',
			points: 'Points',
			count: 'Count',
			choice: 'Choice',
			overflowed: 'Overflowed',
			to: 'to',
			progress: 'Progress',
			current: 'Current',
			total: 'Total',
			revert: 'Revert to recommended',
			upload: 'Upload transcript',
			uploadLabel: 'Choose file',
			preview: 'Preview',
			exemptions: 'Exemptions',
			signInWith: 'Sign in with',
			signOut: 'Sign out',
			guest: 'Guest',
			noPath: 'Degree has no paths'
		},
		plan: {
			wishlist: 'Wish list'
		},
		catalog: {
			wishlist: 'Wish list',
			exempt: 'Exempt',
			freeChoicePrefix: 'Free choice'
		},
		course: {
			median: 'Median',
			points: 'Points',
			plan: 'Plan',
			removeFromSemester: 'Remove from semester',
			removeFromWishlist: 'Remove from wish list',
			removeFromExemption: 'Remove from exemptions',
			wishlist: 'Wish list',
			exempt: 'Add to exemptions',
			available: 'Available',
			info: 'Info',
			appliesTo: 'Applies towards',
			checkingRequirements: 'Validating'
		},
		preview: {
			overwriteWarning:
				'This will overwrite your current plan and is irreversible. Are you sure you want to continue?',
			catalog: 'catalog',
			copy: 'Copy plan'
		},
		search: {
			resultsFor: 'Results for',
			resultsFound: 'results found',
			filters: 'Filters',
			available: 'Available',
			faculty: 'Faculty',
			allFaculties: 'All faculties',
			points: 'Points',
			minPoints: 'Min points',
			maxPoints: 'Max points',
			median: 'Median',
			displaying: 'Displaying',
			of: 'of'
		},
		semester: {
			wishlist: 'Wish list'
		}
	},
	he: {
		lang: 'he',
		dir: 'rtl',
		common: {
			getStarted: 'התחל',
			catalog: 'קטלוג',
			seasons: ['חורף', 'אביב', 'קיץ'],
			na: 'לא זמין',
			yes: 'כן',
			no: 'לא',
			or: 'או',
			dependencies: 'קדמים',
			dependants: 'תלויים',
			adjacencies: 'צמודים',
			exclusives: 'ללא זיכוי נוסף',
			semester: 'סמסטר',
			faculty: 'פקולטה',
			course: 'קורס',
			loading: 'טוען'
		},
		header: {
			searchPlaceholder: 'חיפוש',
			catalog: 'קטלוג',
			plan: 'תוכנית',
			progress: 'התקדמות',
			name: 'PlanIt.'
		},
		footer: {
			createdBy: 'נוצר על ידי',
			author: 'תום סלפין',
			reportIssue: 'דווח על בעיה'
		},
		landing: {
			catchphrase: ['תכנן את התואר', 'בקלות.'],
			howItWorks: [
				'התחל מהתוכנית המומלצת לתואר שלך.',
				'עיין בקטלוג למציאת קורסים מעניינים למילוי דרישות.',
				'תכנן את הקורסים לכל סמסטר, עם וידוי שהדרישות שלהם נענו.',
				'כאשר לוח המבחנים מתפרסם, התאם את התוכנית שלך במהירות כדי למקסם את זמן הלמידה לכל מבחן.'
			],
			courseCard: 'כרטיס הקורס הוא הבסיס ל-PlanIt.',
			settings: {
				header: `הגדרות`,
				description: `
					בחר את הקטלוג הרלוונטי אליך.

					העלה גיליון ציונים כדי לראות את הקורסים שלך.

					ניתן גם לשבץ קורסים ידנית.
				`
			},
			progress: {
				header: `
					בחר תואר. ראה את כל הדרישות שלו, והתקדמותך בהן.
					לכל דרישה יש 2 ערכים:
				`,
				done: 'בוצע',
				planned: 'מתוכנן',
				total: 'סה״כ',
				notification: {
					header: 'אם לדרישה יש כללים מיוחדים שהשפיעו על ההתקדמות, אז',
					notification: 'התראה',
					footer: 'תופיע עם הסבר.'
				},
				markAsDone: `
					מתחת לכל דרישה עם התקדמות, מפורטים הקורסים
					שתרמו לה. קורסים שמתוכננים לסמסטרים עתידיים
					יהיו דהויים. קורסים נחשבים כמבוצעים אם הושלמו
					לפני הסמסטר הנוכחי.
				`
			},
			plan: {
				header: `
					מצא תוכנית שמקיימת את כל דרישות הקורסים.
					שמור קורסים לתכנון עתידי ברשימת המשאלות שלך.
				`,
				testSchedule: `
					צפה בלוח המבחנים לסמסטר הנוכחי.
					הערך הראשון הוא תאריך המבחן הראשון,
					והערכים הבאים הם מספר הימים
					עד למבחן הבא.
					השורה הראשונה היא עבור מועדי א׳, והשנייה עבור מועדי ב׳.
				`
			},
			catalog: {
				header: `
					ראה את הקטלוג של התואר, והתקדמותך בו.
					ההתקדמות היא לפי מספר קורסים ונקודות.
					לכל סרגל התקדמות יש 3 ערכים:
				`,
				done: 'בוצע',
				planned: 'מתוכנן',
				total: 'סה״כ',
				notification: {
					header: 'אם לדרישה יש כללים מיוחדים שהשפיעו על ההתקדמות, אז',
					notification: 'התראה',
					footer: 'תופיע עם הסבר.'
				},
				footer: `
					קורסים מסודרים לפי חציון, ונחשבים כמבוצעים אם הושלמו
					לפני הסמסטר הנוכחי.
				`
			},
			course: `
				ראה מידע על הקורס, קדמים, מקצועות ללא זיכוי נוסף, ועוד.
				הוסף אותם לסמסטר הנוכחי או לרשימת המשאלות שלך.
				לחץ על קוד הקורס כדי לעבור לדף הקורס ב-SAP.
			`,
			semester: `
				לחץ על שם הסמסטר כדי לעבור לדף שלו.
				צפה בכל הקורסים שניתן ללמוד בסמסטר זה.
				לסמסטר הנוכחי, ראה את זמני הלמידה למבחנים
				עבור הקורסים שבחרת.
			`,
			share: {
				title: 'שתף תוכנית',
				description: `
				שתף את התוכנית שלך עם קישור ציבורי לקריאה בלבד.
				כל מי שיש לו את הקישור יכול לראות עותק של התוכנית שלך,
				ויכול להעתיק אותה לחשבון שלו.

				גם קישורים ששותפו לא מאפשרים עריכה של התוכנית שלך.
			`
			},
			search: `
				חפש קורסים לפי שם או לפי מספר.
			`
		},
		settings: {
			degree: 'תואר',
			share: 'שתף תוכנית',
			year: 'שנה',
			selectYear: 'בחר שנה',
			faculty: 'פקולטה',
			selectFaculty: 'בחר פקולטה',
			path: 'מסלול',
			selectPath: 'בחר מסלול',
			selectDegree: 'בחר תואר',
			save: 'שמור',
			cancel: 'בטל',
			points: 'נקודות',
			count: 'קורסים',
			choice: 'בחירה',
			overflowed: 'נוספו',
			to: 'ל',
			progress: 'התקדמות',
			current: 'נוכחי',
			total: 'סה"כ',
			revert: 'חזור למומלצת',
			upload: 'העלאת גיליון ציונים',
			uploadLabel: 'בחר קובץ',
			preview: 'צפייה מוקדמת',
			exemptions: 'זיכויים',
			signInWith: 'התחבר דרך',
			signOut: 'התנתק',
			guest: 'אורח',
			noPath: 'אין מסלולים בתואר'
		},
		plan: {
			wishlist: 'רשימת משאלות'
		},
		catalog: {
			wishlist: 'רשימת משאלות',
			exempt: 'פטור',
			freeChoicePrefix: 'בחירה חופשית'
		},
		course: {
			median: 'חציון',
			points: 'נקודות',
			plan: 'הוספה',
			removeFromSemester: 'הסר מהסמסטר',
			removeFromWishlist: 'הסר מרשימת המשאלות',
			removeFromExemption: 'הסר מרשימת הפטורים',
			wishlist: 'רשימת משאלות',
			exempt: 'רשימת פטורים',
			available: 'זמין',
			info: 'מידע',
			appliesTo: 'תורם לדרישות',
			checkingRequirements: 'דירשות בבדיקה'
		},
		preview: {
			overwriteWarning:
				'זה ידרוס את התוכנית הנוכחית שלך ולא ניתן לביטול. האם אתה בטוח שברצונך להמשיך?',
			catalog: 'קטלוג',
			copy: 'העתק תוכנית'
		},
		search: {
			resultsFor: 'תוצאות עבור',
			resultsFound: 'תוצאות נמצאו',
			filters: 'סינונים',
			available: 'זמין',
			faculty: 'פקולטה',
			allFaculties: 'כל הפקולטות',
			points: 'נקודות',
			minPoints: 'מינימום נקודות',
			maxPoints: 'מקסימום נקודות',
			median: 'חציון',
			displaying: 'מוצגות',
			of: 'מתוך'
		},
		semester: {
			wishlist: 'רשימת משאלות'
		}
	}
} as const;
