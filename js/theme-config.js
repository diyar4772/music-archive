// Electric Violet — the identity design-tokens.json and mobile/constants/theme.ts
// already declare. The `green` and `emerald` scales are deliberately remapped
        // onto it: the markup carries ~135 legacy green utility classes, and rebinding
        // the scale re-skins all of them at once instead of editing every call site.
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        primary: {
                            DEFAULT: "#8B5CF6",
                            light: "#A78BFA",
                            dark: "#7C3AED",
                        },
                        accent: {
                            DEFAULT: "#F472B6",
                            dark: "#EC4899",
                        },

                        // Legacy scale rebind — "green" now reads as Electric Violet.
                        green: {
                            50: "#F5F3FF", 100: "#EDE9FE", 200: "#DDD6FE", 300: "#C4B5FD",
                            400: "#A78BFA", 500: "#8B5CF6", 600: "#7C3AED", 700: "#6D28D9",
                            800: "#5B21B6", 900: "#4C1D95", 950: "#2E1065",
                        },
                        // …and "emerald" as the pink accent, so `from-green-500 to-emerald-600`
                        // renders the brand's violet→pink gradient.
                        emerald: {
                            50: "#FDF2F8", 100: "#FCE7F3", 200: "#FBCFE8", 300: "#F9A8D4",
                            400: "#F472B6", 500: "#EC4899", 600: "#DB2777", 700: "#BE185D",
                            800: "#9D174D", 900: "#831843", 950: "#500724",
                        },

                        // Surfaces
                        "background-light": "#FAFAFA",
                        "background-dark": "#0A0A0B",
                        "card-light": "#FFFFFF",
                        "card-dark": "#1A1A20",
                        "surface": "#121214",
                        "surface-elevated": "#1E1E24",
                        "surface-hover": "#2A2A32",

                        // Text
                        "text-light": "#18181B",
                        "text-dark": "#FAFAFA",
                        "text-secondary-light": "#52525B",
                        "text-secondary-dark": "#A1A1AA",
                        "text-muted": "#71717A",

                        // Card accents, re-tuned to sit inside the violet/pink family
                        "accent-coral": "#F472B6",   // likes
                        "accent-purple": "#8B5CF6",  // artists
                        "accent-teal": "#22D3EE",    // playlists
                        "accent-orange": "#FBBF24",  // ratings
                    },
                    fontFamily: {
                        display: ["Inter", "system-ui", "sans-serif"],
                    },
                    borderRadius: {
                        "2xl": "1rem",
                        "3xl": "1.5rem",
                    },
                    boxShadow: {
                        'glow-coral': '0 0 32px -8px rgba(244, 114, 182, 0.45)',
                        'glow-purple': '0 0 32px -8px rgba(139, 92, 246, 0.45)',
                        'glow-teal': '0 0 32px -8px rgba(34, 211, 238, 0.40)',
                        'glow-orange': '0 0 32px -8px rgba(251, 191, 36, 0.40)',
                        'card': '0 1px 2px rgba(0,0,0,.04), 0 8px 24px -12px rgba(0,0,0,.12)',
                        'card-dark': '0 1px 2px rgba(0,0,0,.4), 0 12px 32px -16px rgba(0,0,0,.8)',
                    },
                    keyframes: {
                        'fade-up': {
                            '0%': { opacity: '0', transform: 'translateY(12px)' },
                            '100%': { opacity: '1', transform: 'translateY(0)' },
                        },
                        shimmer: {
                            '100%': { transform: 'translateX(100%)' },
                        },
                    },
                    animation: {
                        'fade-in': 'fade-up .4s cubic-bezier(.16,1,.3,1) both',
                        'fade-up': 'fade-up .5s cubic-bezier(.16,1,.3,1) both',
                    },
                },
            },
        };
