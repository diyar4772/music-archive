/**
 * Base Component Class
 * Provides a foundation for all UI components with lifecycle methods
 * and DOM manipulation utilities
 */
export class Component {
    constructor(container, props = {}) {
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        this.props = props;
        this.state = {};
        this.listeners = [];
        this.isMounted = false;
    }

    /**
     * Set component state and trigger re-render
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
        if (this.isMounted) {
            this.render();
        }
    }

    /**
     * Render the component (to be implemented by subclasses)
     */
    render() {
        throw new Error('render() method must be implemented');
    }

    /**
     * Mount the component to the DOM
     */
    mount() {
        if (!this.container) {
            console.error('Component container not found', this.constructor.name);
            return;
        }

        try {
            this.render();
            this.isMounted = true;
            this.onMount();
        } catch (error) {
            console.error(`Error mounting component ${this.constructor.name}:`, error);
            console.error('Error stack:', error.stack);
            if (this.container) {
                const box = document.createElement('div');
                box.className = 'p-4 text-red-500';
                box.textContent = `${this.constructor.name} yüklenemedi: ${error.message}`;
                this.container.replaceChildren(box);
            }
        }
    }

    /**
     * Unmount the component from the DOM
     */
    unmount() {
        this.isMounted = false;
        this.removeEventListeners();
        this.onUnmount();
    }

    /**
     * Lifecycle hook: called after component is mounted
     */
    onMount() {
        // Override in subclasses
    }

    /**
     * Lifecycle hook: called before component is unmounted
     */
    onUnmount() {
        // Override in subclasses
    }

    /**
     * Create a DOM element with attributes and children
     */
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);

        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className' || key === 'class') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key === 'onclick' || key.startsWith('on')) {
                // Handle event listeners
                const eventName = key.slice(2).toLowerCase();
                element.addEventListener(eventName, value);
            } else if (key === 'data') {
                // Handle data attributes
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.setAttribute(`data-${dataKey}`, dataValue);
                });
            } else {
                element.setAttribute(key, value);
            }
        });

        // Append children
        if (typeof children === 'string') {
            element.innerHTML = children;
        } else if (Array.isArray(children)) {
            children.forEach(child => {
                if (child instanceof Node) {
                    element.appendChild(child);
                } else if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                }
            });
        }

        return element;
    }

    /**
     * Add event listener and track it for cleanup
     */
    addEventListener(element, event, handler) {
        if (typeof element === 'string') {
            element = this.container.querySelector(element);
        }
        if (element) {
            element.addEventListener(event, handler);
            this.listeners.push({ element, event, handler });
        }
    }

    /**
     * Remove all tracked event listeners
     */
    removeEventListeners() {
        this.listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.listeners = [];
    }

    /**
     * Query selector within component container
     */
    querySelector(selector) {
        return this.container?.querySelector(selector);
    }

    /**
     * Query selector all within component container
     */
    querySelectorAll(selector) {
        return this.container?.querySelectorAll(selector) || [];
    }

    /**
     * Update innerHTML safely
     */
    setHTML(html) {
        if (this.container) {
            try {
                this.container.innerHTML = html;
            } catch (error) {
                console.error(`Error setting HTML in ${this.constructor.name}:`, error);
                this.container.innerHTML = `<div class="p-4 text-red-500">Error rendering content</div>`;
            }
        } else {
            console.error(`Container not found for ${this.constructor.name}`);
        }
    }

    /**
     * Append child element
     */
    appendChild(child) {
        if (this.container && child) {
            this.container.appendChild(child);
        }
    }

    /**
     * Clear container
     */
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
