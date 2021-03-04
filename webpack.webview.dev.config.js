const webpack = require('webpack');
const path = require('path');
const AntdDayjsWebpackPlugin = require('antd-dayjs-webpack-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
    mode: 'development',
    entry: './src/view/app/index.tsx',
    output: {
        path: path.resolve(__dirname, 'assets', 'webview'),
        filename: 'main.js',
    },
    devtool: 'eval-source-map',
    resolve: {
        extensions: ['.js', '.ts', '.tsx', '.json'],
        fallback: {
            fs: false,
        },
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
    plugins: [
        // new BundleAnalyzerPlugin(),
        new webpack.DefinePlugin({
            'process.browser': 'true',
        }),
        new AntdDayjsWebpackPlugin(),
        new NodePolyfillPlugin(),
    ],
};
