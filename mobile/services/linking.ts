import * as Linking from 'expo-linking';

/**
 * Deep linking configuration for Music Archive app
 * Handles URLs like:
 * - musicarchive://library/spotify:track:xxx
 * - musicarchive://dig?mood=energetic
 *
 * Add your own https:// origin to `prefixes` for universal links. Nothing is
 * listed here on purpose: a stale domain in this list would hand deep links to
 * whoever registers it next.
 */
export const linking = {
    prefixes: [
        'musicarchive://',
    ],
    config: {
        screens: {
            '(tabs)': {
                screens: {
                    library: {
                        screens: {
                            track: 'library/:trackId',
                        },
                    },
                    dig: {
                        path: 'dig',
                        parse: {
                            mood: (mood: string) => mood,
                        },
                    },
                    index: '',
                    curator: 'curator',
                    profile: 'profile',
                },
            },
            '(auth)': {
                screens: {
                    login: 'login',
                    register: 'register',
                },
            },
            modal: 'modal',
        },
    },
};

/**
 * Parse a deep link URL and return route parameters
 */
export const parseDeepLink = (url: string): { route: string; params?: any } | null => {
    try {
        const parsed = Linking.parse(url);
        
        if (!parsed.path) {
            return null;
        }

        // Handle library track links
        if (parsed.path.includes('library/')) {
            const trackId = parsed.path.split('library/')[1];
            return {
                route: '/(tabs)/library',
                params: { trackId },
            };
        }

        // Handle dig mode with mood
        if (parsed.path.includes('dig')) {
            return {
                route: '/(tabs)/dig',
                params: { mood: parsed.queryParams?.mood },
            };
        }

        return null;
    } catch (error) {
        console.error('Error parsing deep link:', error);
        return null;
    }
};

export default linking;

