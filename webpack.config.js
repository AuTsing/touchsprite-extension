// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const webpack = require('webpack');
const path = require('path');
const AntdDayjsWebpackPlugin = require('antd-dayjs-webpack-plugin');

module.exports = {
    entry: './src/view/app/index.tsx',
    stats: {
        modules: false,
    },
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
    plugins: [
        new webpack.DefinePlugin({
            'process.browser': 'true',
        }),
        new AntdDayjsWebpackPlugin(),
        // new BundleAnalyzerPlugin(),
    ],
};
