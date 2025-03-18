const path = require('path');

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
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
};
