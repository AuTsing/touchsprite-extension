const path = require('path');

module.exports = {
    entry: './src/view/app/index.tsx',
    output: {
        path: path.resolve(__dirname, 'assets', 'webview'),
        filename: 'main.js',
    },
    devtool: 'eval-source-map',
    resolve: {
        extensions: ['.js', '.ts', '.tsx', '.json'],
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                loader: 'ts-loader',
                options: {},
            },
            {
                test: /\.css$/,
                use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
            },
        ],
    },
    performance: {
        hints: false,
    },
};
