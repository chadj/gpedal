const path = require('path');
const BabiliPlugin = require("babili-webpack-plugin");

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  devtool: 'cheap-module-source-map',
  plugins: [
    new BabiliPlugin()
  ]
};
