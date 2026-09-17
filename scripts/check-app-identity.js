const assert = require('node:assert/strict');
const appConfig = require('../app.config.js');

const expected = {
  name: 'Pakyaw Driver',
  slug: 'pakyaw-driver',
  scheme: 'pakyaw-driver',
  androidPackage: 'com.pakyaw.driver',
  iosBundleIdentifier: 'com.pakyaw.driver',
};

assert.equal(appConfig.name, expected.name);
assert.equal(appConfig.slug, expected.slug);
assert.equal(appConfig.scheme, expected.scheme);
assert.equal(appConfig.android.package, expected.androidPackage);
assert.equal(appConfig.ios.bundleIdentifier, expected.iosBundleIdentifier);
assert.notEqual(appConfig.android.package, 'com.example.pakyaw');
assert.notEqual(appConfig.extra?.eas?.projectId, '40b0edd2-d2db-42ef-8600-23b61b4315b4');

console.log(`Driver identity is isolated: ${appConfig.android.package} / ${appConfig.ios.bundleIdentifier}`);
console.log('EAS project and native Firebase config are intentionally supplied per environment.');
