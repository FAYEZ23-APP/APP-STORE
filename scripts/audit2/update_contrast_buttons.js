const fs = require('fs');

function update(file, s, r) {
  let content = fs.readFileSync(file, 'utf8');
  const isCrlf = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');
  const normS = s.replace(/\r\n/g, '\n');
  const normR = r.replace(/\r\n/g, '\n');
  if (!content.includes(normS)) {
    console.error(`FAILED to find in ${file}`);
    return false;
  }
  content = content.replace(normS, normR);
  if (isCrlf) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
  return true;
}

// 1. DashboardScreen.js
update('mobile/src/screens/seller/DashboardScreen.js',
`                {updatingStock ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={[styles.modalBtnText, { color: colors.white }]}>{t('common.save')}</Text>
                )}`,
`                {updatingStock ? (
                  <ActivityIndicator size="small" color={colors.accentContrast} />
                ) : (
                  <Text style={[styles.modalBtnText, { color: colors.accentContrast }]}>{t('common.save')}</Text>
                )}`
);

// 2. SellerCouponsScreen.js
update('mobile/src/screens/seller/SellerCouponsScreen.js',
`            <TouchableOpacity
              onPress={handleOpenCreateModal}
              style={[tw\`px-3 py-2 rounded-xl flex-row items-center\`, { backgroundColor: colors.accent }]}
            >
              <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" style={isRTL ? tw\`ml-1\` : tw\`mr-1\`} />
              <Text style={tw\`text-white text-xs font-black\`}>{t('coupons.createCoupon')}</Text>
            </TouchableOpacity>`,
`            <TouchableOpacity
              onPress={handleOpenCreateModal}
              style={[tw\`px-3 py-2 rounded-xl flex-row items-center\`, { backgroundColor: colors.accent }]}
            >
              <MaterialCommunityIcons name="plus" size={18} color={colors.accentContrast} style={isRTL ? tw\`ml-1\` : tw\`mr-1\`} />
              <Text style={[tw\`text-xs font-black\`, { color: colors.accentContrast }]}>{t('coupons.createCoupon')}</Text>
            </TouchableOpacity>`
);

update('mobile/src/screens/seller/SellerCouponsScreen.js',
`              <TouchableOpacity
                onPress={handleOpenCreateModal}
                style={[tw\`mt-4 px-4 py-2.5 rounded-xl flex-row items-center\`, { backgroundColor: colors.accent }]}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" style={isRTL ? tw\`ml-1\` : tw\`mr-1\`} />
                <Text style={tw\`text-white text-xs font-bold\`}>{t('coupons.createCoupon')}</Text>
              </TouchableOpacity>`,
`              <TouchableOpacity
                onPress={handleOpenCreateModal}
                style={[tw\`mt-4 px-4 py-2.5 rounded-xl flex-row items-center\`, { backgroundColor: colors.accent }]}
              >
                <MaterialCommunityIcons name="plus" size={16} color={colors.accentContrast} style={isRTL ? tw\`ml-1\` : tw\`mr-1\`} />
                <Text style={[tw\`text-xs font-bold\`, { color: colors.accentContrast }]}>{t('coupons.createCoupon')}</Text>
              </TouchableOpacity>`
);
