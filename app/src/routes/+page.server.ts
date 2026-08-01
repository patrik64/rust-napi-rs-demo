import { greet } from '@demo/rust';
import type { PageServerLoad } from './$types';

// Runs during SSR: the greeting below is produced by the native addon
// before the page ever reaches the browser.
export const load: PageServerLoad = () => {
	return { serverGreeting: greet('the server') };
};
