export const cms = {
	en: {
		lang: 'en',
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
			exclusives: 'Exclusives',
			semester: 'Semester',
			faculty: 'Faculty'
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
			catchphrase: ['Plan your degree', 'with confidence.'],
			about: `
                Setup a plan for your entire degree, check requirements at a
				glance. Browse the sorted catalog, and find the best courses for
				each requirement. Get suggestions each semester for the optimal
				test schedule. Ensure you have completed all prerequisites for
				every course. Share your plan with friends.
            `,
			progress: 'View your progress and plan your degree'
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
			total: 'Total',
			revert: 'Revert to recommended'
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
		lang: 'he',
		dir: 'rtl',
		common: {
			getStarted: 'התחל',
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
			faculty: 'פקולטה'
		},
		header: {
			searchPlaceholder: 'חיפוש',
			catalog: 'קטלוג',
			plan: 'תוכנית',
			progress: 'דרישות',
			name: 'PlanIt.'
		},
		footer: {
			createdBy: 'נוצר על ידי',
			author: 'תום סלפין',
			reportIssue: 'דווח על בעיה'
		},
		landing: {
			catchphrase: ['תכנן את התואר', 'בביטחון.'],
			about: `
				תבנה תוכנית לכל התואר שלך, בדוק דרישות במבט.
				עיין בקטלוג הממוין, ומצא את הקורסים הטובים ביותר לכל דרישה.
				קבל המלצות לכל סמסטר לסידור המבחנים האופטימלי.
				וודא שהשלמת את כל הקדמים לכל קורס. שתף את התוכנית שלך עם חברים.
			`,
			progress: 'צפה בהתקדמותך ותכנן את התואר שלך'
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
			count: 'קורסים',
			choice: 'בחירה',
			overflowed: 'נוספו',
			to: 'ל',
			requirements: 'דרישות',
			current: 'נוכחי',
			total: 'סה"כ',
			revert: 'חזור למומלצת'
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
			plan: 'הוספה',
			removeFromSemester: 'הסר מהסמסטר',
			removeFromWishlist: 'הסר מרשימת המשאלות',
			wishlist: 'רשימת משאלות',
			available: 'זמין',
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
