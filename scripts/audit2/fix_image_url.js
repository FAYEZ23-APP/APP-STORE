const fs = require('fs');
let content = fs.readFileSync('backend/tests/test_wave7_features_postgres.js', 'utf8');

content = content.replace("imageUrls: ['/uploads/earbuds.jpg']", "imageUrls: []");

fs.writeFileSync('backend/tests/test_wave7_features_postgres.js', content, 'utf8');
console.log('Fixed imageUrl to empty array.');
