const fs = require('fs');
const path = require('path');
const text = fs.readFileSync(path.join(__dirname, '../../backend/Marketplace.Infrastructure/Data/Migrations/AppDbContextModelSnapshot.cs'), 'utf8');
const searchStr = 'modelBuilder.Entity("Marketplace.Domain.Entities.ReturnRequest"';
const idx = text.indexOf(searchStr);
if (idx !== -1) {
    console.log(text.substring(idx + 800, idx + 2500));
}
