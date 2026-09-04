/**
 * AddArtistForm Component
 * Handles the add artist form functionality
 */

/**
 * AddArtistForm Controller Class
 */
export class AddArtistFormController {
    constructor(options) {
        this.overlay = document.getElementById(options.overlayId);
        this.closeButton = document.getElementById(options.closeButtonId);
        this.openButton = document.getElementById(options.openButtonId);
        this.form = document.getElementById(options.formId);
        this.onSubmit = options.onSubmit || (() => { });

        this.init();
    }

    init() {
        // Open modal
        if (this.openButton) {
            this.openButton.addEventListener('click', () => this.open());
        }

        // Close on button click
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.close());
        }

        // Close on overlay click
        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.close();
                }
            });
        }

        // Handle form submission
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    }

    open() {
        if (this.overlay) {
            this.overlay.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Focus first input
            const firstInput = this.form?.querySelector('input');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    close() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    isOpen() {
        return this.overlay?.classList.contains('active') || false;
    }

    reset() {
        if (this.form) {
            this.form.reset();
        }
    }

    handleSubmit(e) {
        e.preventDefault();

        // Collect form data
        const formData = {
            name: document.getElementById('artistName')?.value.trim() || '',
            bio: document.getElementById('artistBio')?.value.trim() || '',
            image: document.getElementById('artistImage')?.value.trim() || null,
            wikipedia: document.getElementById('artistWikipedia')?.value.trim() || null,
            spotify: document.getElementById('artistSpotify')?.value.trim() || null
        };

        // Validate
        if (!formData.name) {
            alert('Lütfen sanatçı adını girin.');
            return;
        }

        // Call callback
        this.onSubmit(formData);

        // Reset and close
        this.reset();
        this.close();
    }
}
