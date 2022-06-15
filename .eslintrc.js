module.exports = {
    ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/', '.eslintrc.js'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint/eslint-plugin'],
    extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
    ],
    root: true,
    env: {
        node: true,
        jest: true,
    },
    rules: {
        'prettier/prettier': [
            'warn',
            { 'singleQuote': true, 'endOfLine': 'auto', 'tabWidth': 4, 'printWidth': 180, 'arrow-parens': 'avoid' },
        ],
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
    },
};