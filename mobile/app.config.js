// Adds Firebase (FCM) to the Android build once google-services.json is in
// this folder, so builds keep working before Firebase is set up — push just
// stays off until then. Everything else lives in app.json.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const firebase = path.join(__dirname, "google-services.json");
  if (!fs.existsSync(firebase)) return config;
  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile: "./google-services.json",
    },
  };
};
