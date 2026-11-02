const fs = require('fs');

function update(file, s, r) {
  let content = fs.readFileSync(file, 'utf8');
  const isCrlf = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');
  const normS = s.replace(/\r\n/g, '\n');
  const normR = r.replace(/\r\n/g, '\n');
  if (!content.includes(normS)) {
    console.error(`FAILED in ${file}`);
    return false;
  }
  content = content.replace(normS, normR);
  if (isCrlf) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
  return true;
}

// 1. RegisterScreen.js
update('mobile/src/screens/auth/RegisterScreen.js',
`    marginRight: 10,
    marginTop: 2,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: 'left',`,
`    marginEnd: 10,
    marginTop: 2,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: I18nManager.isRTL ? 'right' : 'left',`
);

// 2. ResetPasswordScreen.js
update('mobile/src/screens/auth/ResetPasswordScreen.js',
`          <Ionicons name="arrow-back" size={24} color="#fff" />`,
`          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#fff" />`
);

// 3. VerifyScreen.js
update('mobile/src/screens/auth/VerifyScreen.js',
`          <Ionicons name="arrow-back" size={24} color="#fff" />`,
`          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#fff" />`
);
