const path = require('path');

// @actions/cache v4+ only exports "." in package.json "exports". Deep imports into
// lib/internal/* still exist on disk but are not part of the public API — webpack
// enforces "exports", so we alias to the real files (same approach as relying on internals).
const actionsCacheRoot = path.resolve(__dirname, 'node_modules/@actions/cache');
const actionsCacheInternal = (name) =>
    path.join(actionsCacheRoot, 'lib/internal', `${name}.js`);

module.exports = {
    mode: 'production',
    target: 'node',
    optimization: {
        minimize: false
    },
    entry: {
        'restore/index': './src/restore.ts',
        'save/index': './src/save.ts',
        'saveOnly/index': './src/saveOnly.ts'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js'
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        // Only typecheck files reachable from entry points (not *.test.ts).
                        onlyCompileBundledFiles: true,
                        // tsconfig has noEmit for `tsc --noEmit`; webpack must emit JS.
                        compilerOptions: { noEmit: false },
                    },
                },
                exclude: /node_modules/,
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js'],
        // @actions/* v3 are ESM-only in "exports" (import, no require). Webpack resolves
        // our TS→CJS stubs with the commonjs path and would pick "require" first otherwise.
        byDependency: {
            commonjs: {
                conditionNames: ['import', 'require', 'module', '...'],
            },
        },
        alias: {
            '@actions/cache/lib/internal/cacheUtils': actionsCacheInternal('cacheUtils'),
            '@actions/cache/lib/internal/tar': actionsCacheInternal('tar'),
            '@actions/cache/lib/internal/constants': actionsCacheInternal('constants'),
        },
    },
};
