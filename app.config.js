const staticConfig = require('./app.json').expo;

const extra = { ...staticConfig.extra };
if (process.env.EAS_PROJECT_ID) {
  extra.eas = { projectId: process.env.EAS_PROJECT_ID };
} else {
  delete extra.eas;
}

const android = { ...staticConfig.android };
delete android.googleServicesFile;
if (process.env.GOOGLE_SERVICES_JSON) {
  android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
}

const ios = { ...staticConfig.ios };
if (process.env.GOOGLE_SERVICES_PLIST) {
  ios.googleServicesFile = process.env.GOOGLE_SERVICES_PLIST;
}

module.exports = {
  ...staticConfig,
  android,
  ios,
  extra,
};
