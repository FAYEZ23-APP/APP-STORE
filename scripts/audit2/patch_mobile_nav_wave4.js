const fs = require('fs');
const path = require('path');

const appNavPath = path.resolve(__dirname, '../../mobile/src/navigation/AppNavigator.js');
let appNav = fs.readFileSync(appNavPath, 'utf8');

if (!appNav.includes('marketplacemobile://')) {
  appNav = appNav.replace(
    "prefixes: ['marketplace://', 'https://marketplace.com'],",
    "prefixes: ['marketplace://', 'marketplacemobile://', 'https://marketplace.com'],"
  );
}

if (!appNav.includes("'product/:id'")) {
  appNav = appNav.replace(
    "ProductDetails: 'product/:productId',",
    "ProductDetails: 'product/:productId',\r\n        ProductDetailsAlt: 'product/:id',"
  );
}

fs.writeFileSync(appNavPath, appNav, 'utf8');
console.log('✓ Updated AppNavigator.js with deep link prefixes');

// Also update BuyerTabs.js to add redirect for Profile tab for guest
const buyerTabsPath = path.resolve(__dirname, '../../mobile/src/navigation/BuyerTabs.js');
let buyerTabs = fs.readFileSync(buyerTabsPath, 'utf8');

if (!buyerTabs.includes("name=\"Profile\"\r\n        component={ProfileScreen}\r\n        listeners=")) {
  const profileTarget = '      <Tab.Screen\r\n        name="Profile"\r\n        component={ProfileScreen}\r\n        options={{';
  const profileReplacement = '      <Tab.Screen\r\n        name="Profile"\r\n        component={ProfileScreen}\r\n        listeners={({ navigation: nav }) => ({\r\n          tabPress: (e) => {\r\n            if (!userId) {\r\n              e.preventDefault();\r\n              nav.navigate(\'Login\');\r\n            }\r\n          },\r\n        })}\r\n        options={{';

  if (buyerTabs.includes(profileTarget)) {
    buyerTabs = buyerTabs.replace(profileTarget, profileReplacement);
    fs.writeFileSync(buyerTabsPath, buyerTabs, 'utf8');
    console.log('✓ Added guest redirect listener to Profile tab in BuyerTabs.js');
  } else {
    // try LF
    const profileTargetLF = '      <Tab.Screen\n        name="Profile"\n        component={ProfileScreen}\n        options={{';
    const profileReplacementLF = '      <Tab.Screen\n        name="Profile"\n        component={ProfileScreen}\n        listeners={({ navigation: nav }) => ({\n          tabPress: (e) => {\n            if (!userId) {\n              e.preventDefault();\n              nav.navigate(\'Login\');\n            }\n          },\n        })}\n        options={{';
    if (buyerTabs.includes(profileTargetLF)) {
      buyerTabs = buyerTabs.replace(profileTargetLF, profileReplacementLF);
      fs.writeFileSync(buyerTabsPath, buyerTabs, 'utf8');
      console.log('✓ Added guest redirect listener to Profile tab in BuyerTabs.js (LF)');
    }
  }
}
