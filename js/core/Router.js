/**
 * Simple Hash-based Router
 * Handles navigation between views using hash routing
 */
export class Router {
    constructor(routes = {}) {
        this.routes = routes;
        this.currentView = null;
        this.currentRoute = null;
        this.init();
    }

    /**
     * Initialize router and listen for hash changes
     */
    init() {
        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRoute());
        

        // Handle initial route - set default if no hash
        if (!window.location.hash || window.location.hash === '' || window.location.hash === '#') {
            // Don't change URL, just handle the route
            this.handleRoute();
        } else {
            // Handle existing hash
            this.handleRoute();
        }
    }

    /**
     * Register a route
     */
    route(path, viewClass) {
        this.routes[path] = viewClass;
    }

    /**
     * Navigate to a route
     */
    navigate(path, replace = false) {
        if (replace) {
            window.location.replace(`#${path}`);
        } else {
            window.location.hash = path;
        }
    }

    /**
     * Get current route from hash
     */
    getCurrentRoute() {
        const hash = window.location.hash.slice(1);
        if (!hash || hash === '') {
            return 'dashboard'; // Default route
        }
        return hash.split('?')[0]; // Remove query params
    }

    /**
     * Get query parameters from hash
     */
    getQueryParams() {
        const hash = window.location.hash;
        const queryString = hash.split('?')[1];
        if (!queryString) return {};

        // URLSearchParams tolerates malformed escapes, preserves '=' in values
        // and decodes '+' correctly. A pasted URL must not stop navigation.
        return Object.fromEntries(new URLSearchParams(queryString));
    }

    /**
     * Handle route change
     */
    async handleRoute() {
        const route = this.getCurrentRoute();
        const queryParams = this.getQueryParams();

        // Unmount current view
        if (this.currentView && typeof this.currentView.unmount === 'function') {
            this.currentView.unmount();
        }

        // Find matching route
        let ViewClass = this.routes[route];
        
        // Fallback to dashboard or wildcard
        if (!ViewClass) {
            ViewClass = this.routes['dashboard'] || this.routes['*'];
        }

        if (!ViewClass) {
            console.error(`No route found for: ${route}. Available routes:`, Object.keys(this.routes));
            return;
        }

        // Create and mount new view
        try {
            const container = document.getElementById('app');
            if (!container) {
                console.error('App container not found');
                return;
            }

            
            this.currentView = new ViewClass(container, { router: this, queryParams });
            this.currentRoute = route;

            // Mount the view
            if (typeof this.currentView.mount === 'function') {
                this.currentView.mount();

            } else if (typeof this.currentView.render === 'function') {
                // Fallback: call render directly
                this.currentView.render();

            } else {
                console.error('View does not have mount() or render() method');
            }
        } catch (error) {
            console.error(`Error mounting view for route ${route}:`, error);
            console.error('Error stack:', error.stack);
        }
    }

    /**
     * Get current route name
     */
    getCurrentRouteName() {
        return this.currentRoute;
    }

    /**
     * Check if a route is active
     */
    isActive(route) {
        return this.currentRoute === route;
    }
}
