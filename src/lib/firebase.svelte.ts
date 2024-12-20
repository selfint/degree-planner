import type { User as FirebaseUser } from 'firebase/auth';

export type SessionData = {
	user: FirebaseUser | undefined;
	token: string | undefined;
};

export const session: SessionData = $state({
	user: undefined,
	token: undefined
});
