export const pwaMessages = {
	en: {
		retry: 'Try again',
		refreshFailed: 'Refresh failed',
		cachedRefreshFailed:
			'Refresh failed. Saved course data is still available.',
		ready: 'All courses ready offline',
		downloading: 'Preparing offline access…',
		shellOutdated: 'Offline app update pending',
		signInErrors: {
			domain:
				'Google sign-in is not enabled for this website address (auth/unauthorized-domain). The maintainer needs to add this exact hostname to Firebase Authentication’s authorized domains:',
			popup:
				'The Google sign-in window was blocked or is not supported here. Allow pop-ups and try again. If the installed app cannot open it, use PlanIt in your browser; its storage may be separate.',
			cancelled: 'Google sign-in was cancelled. You can try again.',
			network:
				'Google sign-in could not connect. Check your internet connection and try again.',
			unknown:
				'Google sign-in could not finish. Try again, or report the problem if it continues.'
		},
		courseActionsUnavailable:
			'Course details are available. Plan actions will return when your saved plan is ready; account changes need an internet connection.',
		accountUnavailable:
			'Reconnect to load your account plan. Your draft stays in this window.',
		offline:
			'You’re offline. All downloaded course and catalog data and saved guest plans remain available once offline setup is complete. Plan editing, saving, account plans, sign-in and syncing need internet. Keep this window open until account changes finish syncing.',
		update: 'Update available.',
		updateAccept: 'Update',
		updateBlocked: 'Save or cancel changes; wait for saving.',
		updateOtherTabs:
			'Save your work in other PlanIt tabs and close them, then try Update again.',
		updateFailed:
			'Update could not finish. Your window was not reloaded. Try again.',
		unavailable: 'Offline setup incomplete',
		close: 'Dismiss update notice'
	},
	he: {
		retry: 'נסו שוב',
		refreshFailed: 'רענון הנתונים נכשל',
		cachedRefreshFailed:
			'רענון הנתונים נכשל. נתוני הקורסים השמורים עדיין זמינים.',
		ready: 'כל הקורסים זמינים ללא אינטרנט',
		downloading: 'הכנה לשימוש ללא אינטרנט…',
		shellOutdated: 'עדכון לשימוש ללא אינטרנט ממתין',
		signInErrors: {
			domain:
				'התחברות Google אינה מאושרת לכתובת האתר הזו (auth/unauthorized-domain). יש להוסיף את שם המארח המדויק לרשימת הדומיינים המורשים ב-Firebase Authentication:',
			popup:
				'חלון ההתחברות של Google נחסם או אינו נתמך כאן. אפשרו חלונות קופצים ונסו שוב. אם היישום המותקן אינו מצליח לפתוח אותו, השתמשו ב-PlanIt בדפדפן; ייתכן שהאחסון שלו נפרד.',
			cancelled: 'ההתחברות ל-Google בוטלה. אפשר לנסות שוב.',
			network: 'לא ניתן להתחבר ל-Google. בדקו את החיבור לאינטרנט ונסו שוב.',
			unknown:
				'ההתחברות ל-Google לא הושלמה. נסו שוב, או דווחו על הבעיה אם היא נמשכת.'
		},
		courseActionsUnavailable:
			'פרטי הקורס זמינים. פעולות התוכנית יחזרו כשהתוכנית השמורה תהיה מוכנה; שינויים בחשבון דורשים חיבור לאינטרנט.',
		accountUnavailable:
			'התחברו לאינטרנט כדי לטעון את התוכנית בחשבון. הטיוטה נשמרת בחלון הזה.',
		offline:
			'אין חיבור לאינטרנט. לאחר השלמת ההכנה, נתוני הקורסים והקטלוגים שהורדו ותוכניות אורח שמורות זמינים. עריכת תוכניות, שמירה, תוכניות בחשבון, התחברות וסנכרון דורשים אינטרנט. השאירו את החלון פתוח עד לסיום סנכרון השינויים בחשבון.',
		update: 'עדכון זמין.',
		updateAccept: 'עדכון',
		updateBlocked: 'שמרו או בטלו שינויים והמתינו לסיום השמירה.',
		updateOtherTabs:
			'שמרו את השינויים בלשוניות האחרות של PlanIt וסגרו אותן, ואז נסו לעדכן שוב.',
		updateFailed: 'העדכון לא הושלם. החלון לא נטען מחדש. נסו שוב.',
		unavailable: 'ההכנה ללא אינטרנט לא הושלמה',
		close: 'סגירת הודעת העדכון'
	}
} as const;
