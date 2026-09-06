/**
 * Flat ESLint config.
 *
 * The repository holds three kinds of JavaScript with different globals:
 * CommonJS on the server, browser ES modules under js/, and the Node test
 * runner under test/. Each gets its own block rather than one lowest common
 * denominator that would let real mistakes through.
 */
const globals = require('globals');

const sharedRules = {
    'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none'
    }],
    'no-undef': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    eqeqeq: ['error', 'smart'],
    'no-implicit-globals': 'error',
    'no-throw-literal': 'error',
    'no-return-await': 'error',
    'no-console': 'off',
    curly: ['error', 'multi-line'],
    'object-shorthand': ['error', 'properties'],
    'no-else-return': 'error',
    'no-lonely-if': 'error',
    'prefer-template': 'error',
    'no-useless-concat': 'error'
};

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'mobile/**',
            'panel-4772.html',
            'Eski raporlar vb/**',
            '_dev_journal/**',
            'memory-bank/**'
        ]
    },
    {
        // Server and tooling: CommonJS, Node globals.
        files: ['server.js', 'server/**/*.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: globals.node
        },
        rules: sharedRules
    },
    {
        // theme-config.js is a classic script that configures the Tailwind CDN
        // before the modules load, so it sees the `tailwind` global it sets up.
        files: ['js/theme-config.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'script',
            globals: { ...globals.browser, tailwind: 'writable' }
        },
        rules: sharedRules
    },
    {
        // Browser application code: ES modules, no Node globals.
        files: ['js/**/*.js', 'admin/**/*.js'],
        ignores: ['js/theme-config.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: globals.browser
        },
        rules: {
            ...sharedRules,
            // Views reach the app-level modals by name to avoid an import cycle
            // back into app.js; every such call is optional-chained.
            'no-restricted-globals': ['error', 'event', 'name', 'length', 'status']
        }
    },
    {
        files: ['test/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: { ...globals.node }
        },
        rules: sharedRules
    },
    {
        files: ['test/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: globals.node
        },
        rules: sharedRules
    }
];
