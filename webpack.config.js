const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  devtool: 'cheap-module-eval-source-map',
  devServer: {
    contentBase: path.join(__dirname, "dist"),
    compress: true,
    host: '0.0.0.0',
    port: 8443,
    https: true,
    hot: false,
  }
};
