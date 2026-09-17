const assert = require('node:assert/strict');
const appConfig = require('../app.config.js');

const expected = {
  name: 'Pakyaw Passenger',
  slug: 'pakyaw-passenger',
  scheme: 'pakyaw-passenger',
  androidPackage: 'com.pakyaw.passenger',
  iosBundleIdentifier: 'com.pakyaw.passenger',
};

assert.equal(appConfig.name, expected.name);
assert.equal(appConfig.slug, expected.slug);
assert.equal(appConfig.scheme, expected.scheme);
assert.equal(appConfig.android.package, expected.androidPackage);
assert.equal(appConfig.ios.bundleIdentifier, expected.iosBundleIdentifier);
assert.notEqual(appConfig.android.package, 'com.example.pakyaw');
assert.notEqual(appConfig.extra?.eas?.projectId, '40b0edd2-d2db-42ef-8600-23b61b4315b4');

const driverPermissions = new Set([
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
]);
for (const permission of appConfig.android.permissions ?? []) {
  assert.equal(driverPermissions.has(permission), false, `Passenger must not request ${permission}`);
}
assert.equal(appConfig.plugins.some((plugin) => (
  Array.isArray(plugin) ? plugin[0] : plugin
) === './plugins/withAndroidPictureInPicture'), false);

console.log(`Passenger identity is isolated: ${appConfig.android.package} / ${appConfig.ios.bundleIdentifier}`);
console.log('Driver background location, foreground service, and Picture-in-Picture configuration are absent.');
console.log('EAS project and native Firebase config are intentionally supplied per environment.');
