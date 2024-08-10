import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-plugin-prettier/recommended';

export default [
    { files: ['**/*.{js,cjs,ts}'] },
    { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } },
    { languageOptions: { globals: globals.node } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    {
        rules: {
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'prettier/prettier': [
                'error',
                {
                    semi: true,
                    trailingComma: 'all',
                    singleQuote: true,
                    printWidth: 180,
                    tabWidth: 4,
                    arrowParens: 'avoid',
                    endOfLine: 'auto',
                },
            ],
        },
    },
];
