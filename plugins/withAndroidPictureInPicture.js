const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

const REQUIRED_CONFIG_CHANGES = [
  'keyboard',
  'keyboardHidden',
  'orientation',
  'screenSize',
  'screenLayout',
  'uiMode',
  'smallestScreenSize',
];

module.exports = function withAndroidPictureInPicture(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    const manifest = configWithManifest.modResults;
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    const attrs = mainActivity.$;
    const configChanges = new Set(
      String(attrs['android:configChanges'] ?? '')
        .split('|')
        .filter(Boolean),
    );

    for (const configChange of REQUIRED_CONFIG_CHANGES) {
      configChanges.add(configChange);
    }

    attrs['android:supportsPictureInPicture'] = 'true';
    attrs['android:resizeableActivity'] = 'true';
    attrs['android:configChanges'] = [...configChanges].join('|');

    return configWithManifest;
  });
};
