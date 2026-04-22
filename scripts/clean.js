const fs = require('fs');
const path = require('path');

const paths = ['release', 'out'];
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

for (const relativePath of paths) {
  const targetPath = path.resolve(__dirname, '..', relativePath);
  if (!fs.existsSync(targetPath)) continue;

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      break;
    } catch (err) {
      if (err.code !== 'EBUSY' || attempt === 10) {
        console.error(`Failed to remove ${targetPath}:`, err);
        process.exit(1);
      }
      console.warn(`EBUSY deleting ${targetPath}, retrying (${attempt}/10)...`);
      wait(100);
    }
  }
}
