import parser from '@babel/eslint-parser';

export default [{
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['node_modules/**', '.expo/**'],
    languageOptions: { parser, parserOptions: {
        requireConfigFile: false,
        babelOptions: { parserOpts: { plugins: ['typescript', 'jsx'] } },
    } },
    rules: {
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-unreachable': 'error',
        'no-constant-condition': 'error',
    },
}];
