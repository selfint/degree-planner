export const cms = {
	en: {
		dir: 'ltr',
		common: {
			getStarted: 'Get Started',
			seasons: ['Winter', 'Spring', 'Summer'],
			na: 'N/A',
			yes: 'Yes',
			no: 'No',
			or: 'OR',
			dependencies: 'Dependencies',
			dependants: 'Dependants',
			adjacencies: 'Adjacencies',
			semester: 'Semester'
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
			catchphrase: ['Plan your courses', 'with confidence.'],
			about: `
                Setup a plan for your entire degree that fits your interests and maximizes
                your potential. Get personalized suggestions each semester for the optimal
                test schedule. Discover courses, save the ones you like and we will
                scheduled them for you.
            `
		},
		progress: {
			degree: 'Degree',
			share: 'share plan',
			year: 'Year',
			selectYear: 'Select year',
			faculty: 'Faculty',
			selectFaculty: 'Select faculty',
			path: 'Path',
			selectPath: 'Select path',
			save: 'Save',
			cancel: 'Cancel',
			points: 'Points',
			count: 'Count',
			choice: 'Choice',
			overflowed: 'Overflowed',
			to: 'to',
			requirements: 'Requirements',
			current: 'Current',
			total: 'Total'
		},
		plan: {
			wishlist: 'Wish list'
		},
		catalog: {
			wishlist: 'wish_list'
		},
		course: {
			median: 'Median',
			points: 'Points',
			plan: 'Plan',
			removeFromSemester: 'Remove from semester',
			removeFromWishlist: 'Remove from wish list',
			wishlist: 'Wish list',
			available: 'Available',
			info: 'Info'
		},
		preview: {
			overwriteWarning:
				'This will overwrite your current plan and is irreversible. Are you sure you want to continue?',
			catalog: 'catalog',
			copy: 'Copy plan'
		},
		search: {
			resultsFor: 'Results for',
			resultsFound: 'results found'
		},
		semester: {
			wishlist: 'Wish list'
		}
	},
	he: {
		dir: 'rtl',
		common: {
			getStarted: 'התחל',
			seasons: ['חורף', 'אביב', 'קיץ'],
			na: 'לא זמין',
			yes: 'כן',
			no: 'לא',
			or: 'או',
			dependencies: 'תלות',
			dependants: 'תלויים',
			adjacencies: 'שכנים',
			semester: 'סמסטר'
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
			catchphrase: ['תכנן את הקורסים שלך', 'בביטחון.'],
			about: `
				הגדר תוכנית לכל התואר שלך שמתאימה לתחומי העניין שלך וממקסמת
				את הפוטנציאל שלך. קבל הצעות מותאמות אישית לכל סמסטר עבור לוח
				מבחנים אופטימלי. גלה קורסים, שמור את אלה שאתה אוהב ואנחנו
				נכניס אותם לתוכנית עבורך.
			`
		},
		progress: {
			degree: 'תואר',
			share: 'שתף תוכנית',
			year: 'שנה',
			selectYear: 'בחר שנה',
			faculty: 'פקולטה',
			selectFaculty: 'בחר פקולטה',
			path: 'מסלול',
			selectPath: 'בחר מסלול',
			save: 'שמור',
			cancel: 'בטל',
			points: 'נקודות',
			count: 'ספירה',
			choice: 'בחירה',
			overflowed: 'חריגה',
			to: 'ל',
			requirements: 'דרישות',
			current: 'נוכחי',
			total: 'סה"כ'
		},
		plan: {
			wishlist: 'רשימת משאלות'
		},
		catalog: {
			wishlist: 'רשימת משאלות'
		},
		course: {
			median: 'חציון',
			points: 'נקודות',
			plan: 'תוכנית',
			removeFromSemester: 'הסר מהסמסטר',
			removeFromWishlist: 'הסר מרשימת המשאלות',
			wishlist: 'רשימת משאלות',
			available: 'זמין',
			or: 'או',
			info: 'מידע'
		},
		preview: {
			overwriteWarning:
				'זה ידרוס את התוכנית הנוכחית שלך ולא ניתן לביטול. האם אתה בטוח שברצונך להמשיך?',
			catalog: 'קטלוג',
			copy: 'העתק תוכנית'
		},
		search: {
			resultsFor: 'תוצאות עבור',
			resultsFound: 'תוצאות נמצאו'
		},
		semester: {
			wishlist: 'רשימת משאלות'
		}
	}
} as const;
