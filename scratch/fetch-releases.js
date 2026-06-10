const https = require('https');

https.get('https://api.github.com/repos/Shaik-Nagur-Basha/ClipMaster-Pro/releases', {
  headers: {
    'User-Agent': 'NodeJS-Test-Agent',
    'Accept': 'application/vnd.github.v3+json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const releases = JSON.parse(data);
      if (releases.length > 0) {
        console.log('Latest Release:', releases[0].tag_name);
        console.log('Assets:');
        releases[0].assets.forEach(a => {
          console.log(`- ${a.name} (size: ${a.size} bytes)`);
        });
      } else {
        console.log('No releases found.');
      }
    } catch (e) {
      console.error('Failed to parse:', e);
    }
  });
}).on('error', err => {
  console.error('Error:', err);
});
