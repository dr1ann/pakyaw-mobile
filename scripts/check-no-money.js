const fs = require('fs');
const path = require('path');

// Transport fare and cash-display terminology is in scope. This guard only
// rejects the deferred wallet/stored-value/payment-processing domain.
const FORBIDDEN_PATTERNS = [
  /\bwallet\b/i,
  /stored[\s_-]*value/i,
  /cash[\s_-]*in/i,
  /top[\s_-]*up/i,
  /passenger[\s_-]*credits?/i,
  /payment[\s_-]*(processing|intent|webhook)/i,
  /\b(?:psp|settlement|payouts?)\b/i,
];
const SRC_DIR = path.resolve(__dirname, '../src');

let hasError = false;

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    // Normalize path separators to forward slashes for easier checks
    const normalizedPath = fullPath.replace(/\\/g, '/');

    // Exclude lib/fare and tests
    if (normalizedPath.includes('/src/lib/fare')) {
      continue;
    }
    if (normalizedPath.includes('/tests/') || file === 'tests') {
      continue;
    }

    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(file)) {
      // Exclude test files
      if (/\.test\.(ts|tsx|js|jsx)$/.test(file)) {
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(line))) {
          console.error(`Forbidden term found in ${fullPath}:${index + 1}`);
          console.error(`  > ${line.trim()}`);
          hasError = true;
        }
      });
    }
  }
}

console.log('Running monetary terms check on src/...');
scanDir(SRC_DIR);

if (hasError) {
  console.error('Check failed: Found deferred wallet/stored-value/payment-processing terms in transport modules.');
  process.exit(1);
} else {
  console.log('Check passed: No forbidden terms found.');
  process.exit(0);
}
