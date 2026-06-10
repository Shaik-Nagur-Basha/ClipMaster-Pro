const fs = require('fs');
const path = require('path');

const tempDir = require('electron')?.app ? require('electron').app.getPath('temp') : path.join(process.env.USERPROFILE, 'AppData\\Local\\Temp');
const filePath = path.join(tempDir, 'ClipMaster-Pro-Setup.exe');

console.log('Target file path:', filePath);
console.log('File exists:', fs.existsSync(filePath));

if (fs.existsSync(filePath)) {
  try {
    fs.unlinkSync(filePath);
    console.log('SUCCESS: File deleted successfully!');
  } catch (err) {
    console.error('ERROR: Failed to delete file:', err);
  }
} else {
  console.log('File does not exist at path.');
}
