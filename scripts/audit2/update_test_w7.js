const fs = require('fs');
let content = fs.readFileSync('backend/tests/test_wave7_features_postgres.js', 'utf8');

const regex = /\/\/ 2\. Register Seller & Buyer[\s\S]*?const buyerToken = buyerLogin\.body\.token;/;

const newSection = `// 2. Register Seller & Buyer
    const ts = Date.now();
    const sellerEmail = \`seller_w7_\${ts}@marketplace.local\`;
    const sellerPhone = "011" + Math.floor(10000000 + Math.random() * 90000000);
    const sellerReg = await request(\`\${baseUrl}/api/auth/register\`, { method: "POST" }, {
      name: "تاجر الغربية للإلكترونيات",
      email: sellerEmail,
      phone: sellerPhone,
      password: "Password123!",
      role: "Seller",
      acceptedTermsAndPrivacy: true
    });
    recordCheck("W7-02", "Seller registered", sellerReg.status === 200 || sellerReg.status === 201 || sellerReg.status === 202);

    const sellerLogin = await request(\`\${baseUrl}/api/auth/login\`, { method: "POST" }, {
      identifier: sellerEmail,
      password: "Password123!"
    });
    const sellerToken = sellerLogin.body.token || sellerLogin.body.accessToken;
    let sellerId = sellerLogin.body.user?.id || sellerLogin.body.userId;
    if (!sellerId) {
      const me = await request(\`\${baseUrl}/api/users/me\`, { headers: { Authorization: \`Bearer \${sellerToken}\` } });
      sellerId = me.body.id;
    }

    const buyerEmail = \`buyer_w7_\${ts}@marketplace.local\`;
    const buyerPhone = "012" + Math.floor(10000000 + Math.random() * 90000000);
    const buyerReg = await request(\`\${baseUrl}/api/auth/register\`, { method: "POST" }, {
      name: "أحمد محمود",
      email: buyerEmail,
      phone: buyerPhone,
      password: "Password123!",
      role: "Buyer",
      acceptedTermsAndPrivacy: true
    });
    recordCheck("W7-03", "Buyer registered", buyerReg.status === 200 || buyerReg.status === 201 || buyerReg.status === 202);

    const buyerLogin = await request(\`\${baseUrl}/api/auth/login\`, { method: "POST" }, {
      identifier: buyerEmail,
      password: "Password123!"
    });
    const buyerToken = buyerLogin.body.token || buyerLogin.body.accessToken;`;

if (regex.test(content)) {
    content = content.replace(regex, newSection);
    fs.writeFileSync('backend/tests/test_wave7_features_postgres.js', content, 'utf8');
    console.log('Regex replace succeeded.');
} else {
    console.error('Regex did not match.');
}
