const fs = require('fs');
const path = require('path');

// 1. SellerStoreScreen.js
const sellerStorePath = path.resolve('mobile/src/screens/buyer/SellerStoreScreen.js');
let sContent = fs.readFileSync(sellerStorePath, 'utf8');
sContent = sContent.replace("borderColor: '#1E293B'", "borderColor: colors.secondaryBorder");
fs.writeFileSync(sellerStorePath, sContent, 'utf8');

// 2. DashboardScreen.js
const dashPath = path.resolve('mobile/src/screens/seller/DashboardScreen.js');
let dContent = fs.readFileSync(dashPath, 'utf8');
dContent = dContent.replace(
  /style=\{tw`px-3 py-1\.5 bg-orange-500\/20 border border-orange-500\/40 rounded-xl flex-row items-center`\}[\s\S]*?<Text style=\{tw`text-orange-400 font-bold text-xs`\}>\{t\('seller\.wallet'\)\}<\/Text>/,
  `style={[tw\`px-3 py-1.5 rounded-xl flex-row items-center border\`, { backgroundColor: colors.goldSoft, borderColor: colors.goldBorder }]}
              >
                <MaterialCommunityIcons name="wallet-outline" size={16} color={colors.gold} style={isRTL ? tw\`ml-1\` : tw\`mr-1\`} />
                <Text style={[tw\`font-bold text-xs\`, { color: colors.gold }]}>{t('seller.wallet')}</Text>`
);
fs.writeFileSync(dashPath, dContent, 'utf8');

console.log('Final polish replacements done!');
