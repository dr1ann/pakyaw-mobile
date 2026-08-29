const fs = require('node:fs');
const path = require('node:path');

const forbiddenFiles = [
  'firebase.json',
  '.firebaserc',
  'firestore.rules',
  'firestore.rules.bak',
  'firestore.indexes.json',
];

const presentFiles = forbiddenFiles.filter((file) =>
  fs.existsSync(path.join(__dirname, '..', file)),
);

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
);
const deploymentScripts = Object.entries(packageJson.scripts ?? {})
  .filter(([, command]) => /firebase\s+deploy/.test(command))
  .map(([name]) => name);

if (presentFiles.length > 0 || deploymentScripts.length > 0) {
  console.error('Firebase backend deployment files/scripts are not allowed in app-driver.');
  if (presentFiles.length > 0) console.error(`Files: ${presentFiles.join(', ')}`);
  if (deploymentScripts.length > 0) console.error(`Scripts: ${deploymentScripts.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Firebase boundary OK: app-driver is client-only; deployment is Admin-owned.');
}
