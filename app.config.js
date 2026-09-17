const staticConfig = require('./app.json').expo;

const mapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
const plugins = staticConfig.plugins.map((plugin) => {
  const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
  if (pluginName !== 'react-native-maps') return plugin;
  if (!mapsApiKey) return pluginName;

  return [pluginName, {
    iosGoogleMapsApiKey: mapsApiKey,
    androidGoogleMapsApiKey: mapsApiKey,
  }];
});

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
  plugins,
  android,
  ios,
  extra,
};
