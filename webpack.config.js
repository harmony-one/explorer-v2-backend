const path = require('path') // eslint-disable-line
const nodeExternals = require('webpack-node-externals') // eslint-disable-line

module.exports = {
  entry: './src/index.ts',
  mode: 'production',
  externals: [nodeExternals()],
  target: 'node',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      src: path.resolve(__dirname, 'src'),
    },
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
  node: {},
  optimization: {
    minimize: false,
  },
  devtool: 'inline-source-map',
}
