const path = require("path");

module.exports = {
  entry: {
    app: "./app/script.js"
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js"
  }
};
