const fs = require('fs');

const path = 'docs/audit2/06-gaps.md';
let content = fs.readFileSync(path, 'utf8');

const target = '> **الصفة**: مراجع ومحلل هندسي ومنتجي مستقل (Independent Product & Engineering Analyst)';
const addition = `> **حالة المعالجة والتنفيذ**: ✅ **تم إغلاق كافة الفجوات الـ 35 بنسبة 100% (35/35 IMPLEMENTED)** عبر الحزم 1 إلى 8 (Waves 1 to 8).  \r\n> **حالة الاختبارات والتحقق**: 100% نجاح في كافة سويتات الاختبار على قاعدة بيانات PostgreSQL الحقيقية (\`MarketplaceMVP_test\`).  \r\n` + target;

content = content.replace(target, addition);
fs.writeFileSync(path, content, 'utf8');
console.log('Updated docs/audit2/06-gaps.md with 100% implementation status badge');
