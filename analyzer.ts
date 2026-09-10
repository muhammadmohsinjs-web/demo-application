const fs = require('fs');

console.log('Analyzer started');

const files = fs.readdirSync('.');

console.log('Files found in repository:');

for (const file of files) {
  console.log('-', file);
}

console.log('Analysis complete');
