const fs = require('fs');
let s = fs.readFileSync('mobile/App.js', 'utf8');
const isCrlf = s.includes('\r\n');
s = s.replace(/\r\n/g, '\n');

if (!s.includes('OfflineBanner')) {
  s = s.replace(
    "import ErrorBoundary from './src/components/ErrorBoundary';",
    "import ErrorBoundary from './src/components/ErrorBoundary';\nimport OfflineBanner from './src/components/OfflineBanner';"
  );
  s = s.replace(
    "return <AppNavigator />;",
    "return (\n    <View style={styles.contentContainer}>\n      <OfflineBanner />\n      <AppNavigator />\n    </View>\n  );"
  );
  s = s.replace(
    "  root: {\n    flex: 1,\n    backgroundColor: colors.screenBg,\n  },",
    "  root: {\n    flex: 1,\n    backgroundColor: colors.screenBg,\n  },\n  contentContainer: {\n    flex: 1,\n  },"
  );
}

if (isCrlf) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('mobile/App.js', s, 'utf8');
console.log('App.js updated successfully with OfflineBanner');
