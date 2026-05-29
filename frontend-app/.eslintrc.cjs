/**
 * ESLint config for frontend-app (Vite + React + TS).
 *
 * Authenticated SPA: lower legal exposure than the public marketing site
 * (a plaintiff's scanner can't crawl behind login), but accessibility
 * still matters for couples and vendors with disabilities. See the
 * "Accessibility Rules" section in the root CLAUDE.md for the principles
 * these rules enforce.
 *
 * jsx-a11y/recommended is enabled at default severity (error) so new code
 * cannot regress. If an existing component trips a rule that genuinely
 * needs ARIA we don't yet understand, add a targeted // eslint-disable-next-line
 * with a comment explaining why, never silence the rule globally.
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'jsx-a11y'],
  settings: {
    react: { version: 'detect' },
  },
  ignorePatterns: ['dist', 'node_modules', '*.config.*', '.eslintrc.cjs'],
  rules: {
    // We use TypeScript for prop validation, not PropTypes.
    'react/prop-types': 'off',
    // Apostrophes in JSX text are valid HTML; React escapes them correctly.
    // The rule exists for the rare case where they collide with HTML entities,
    // which has zero accessibility impact and creates massive churn.
    'react/no-unescaped-entities': 'off',
    // Allow `any` for now; tightening this is a separate cleanup pass.
    '@typescript-eslint/no-explicit-any': 'off',
    // Unused vars: error, but allow underscore-prefixed for intentional cases.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // `role` is also our auth prop on <ProtectedRoute role="COUPLE">. The
    // default jsx-a11y/aria-role rule fires on any `role` attribute regardless
    // of element. ignoreNonDOM scopes it to actual DOM elements only.
    'jsx-a11y/aria-role': ['error', { ignoreNonDOM: true }],
    // Over-eager: fires on the very common <label>Name</label><input /> sibling
    // pattern even when paired correctly. Downgrade to warn so CI ratchets but
    // doesn't block. Real label↔input binding gets enforced through code
    // review + the CLAUDE.md accessibility checklist.
    'jsx-a11y/label-has-associated-control': 'warn',
  },
}
