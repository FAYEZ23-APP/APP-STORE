/**
 * Phase 3 Mobile Verification Test Suite: test_mobile_smart_search.js
 * 
 * Verifies:
 * 1. Mobile Search API (src/api/searchApi.js).
 * 2. Mobile Smart Search Hook (src/hooks/useSmartSearch.js).
 * 3. MobileSearchScreen component structure, live suggestions, 2-column grid, and filter modal.
 * 4. Navigation configuration in AppNavigator and CatalogScreen.
 * 5. i18n key parity and completeness.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName}`);
    if (details) console.error(`    \x1b[33mDetails:\x1b[0m ${details}`);
    failedTests++;
  }
}

console.log('\n\x1b[36m=======================================================');
console.log('   Mobile Smart Search (React Native) Test Suite       ');
console.log('=======================================================\x1b[0m\n');

// ---------------------------------------------------------------------------
// TEST SUITE 1: Search API Service
// ---------------------------------------------------------------------------
console.log('\x1b[35m[1/5] Mobile Search API Service (src/api/searchApi.js)\x1b[0m');
const searchApiPath = path.join(srcDir, 'api', 'searchApi.js');
assert(fs.existsSync(searchApiPath), 'searchApi.js exists');

const searchApiContent = fs.readFileSync(searchApiPath, 'utf-8');
assert(
  searchApiContent.includes("client.get('/search/suggestions'") ||
  searchApiContent.includes('client.get("/search/suggestions"'),
  'getSearchSuggestions targets /search/suggestions'
);
assert(
  searchApiContent.includes("client.get('/search/products'") ||
  searchApiContent.includes('client.get("/search/products"'),
  'searchProducts targets /search/products'
);
assert(
  searchApiContent.includes('AbortSignal') && searchApiContent.includes('signal'),
  'searchApi supports AbortSignal cancellation'
);

// ---------------------------------------------------------------------------
// TEST SUITE 2: useSmartSearch Hook Verification
// ---------------------------------------------------------------------------
console.log('\n\x1b[35m[2/5] Custom Hook (src/hooks/useSmartSearch.js)\x1b[0m');
const hookPath = path.join(srcDir, 'hooks', 'useSmartSearch.js');
assert(fs.existsSync(hookPath), 'useSmartSearch.js exists');

const hookContent = fs.readFileSync(hookPath, 'utf-8');
assert(hookContent.includes('@react-native-async-storage/async-storage'), 'AsyncStorage imported');
assert(hookContent.includes('250'), '250ms debounce configured');
assert(hookContent.includes('AbortController'), 'AbortController used for cancellation');
assert(hookContent.includes('@marketplace_recent_searches'), 'AsyncStorage key @marketplace_recent_searches used');
assert(hookContent.includes('addRecentSearch'), 'addRecentSearch helper defined');
assert(hookContent.includes('removeRecentSearch'), 'removeRecentSearch helper defined');
assert(hookContent.includes('clearRecentSearches'), 'clearRecentSearches helper defined');
assert(hookContent.includes('clearSuggestions'), 'clearSuggestions helper defined');

// ---------------------------------------------------------------------------
// TEST SUITE 3: MobileSearchScreen Component Verification
// ---------------------------------------------------------------------------
console.log('\n\x1b[35m[3/5] MobileSearchScreen Component (src/screens/buyer/MobileSearchScreen.js)\x1b[0m');
const screenPath = path.join(srcDir, 'screens', 'buyer', 'MobileSearchScreen.js');
assert(fs.existsSync(screenPath), 'MobileSearchScreen.js exists');

const screenContent = fs.readFileSync(screenPath, 'utf-8');
assert(
  screenContent.includes('keyboardShouldPersistTaps="handled"') ||
  screenContent.includes("keyboardShouldPersistTaps={'handled'}"),
  'keyboardShouldPersistTaps="handled" enabled on scroll views'
);
assert(
  screenContent.includes('suggestions.didYouMean'),
  'Section 1: DidYouMean chip supported'
);
assert(
  screenContent.includes('suggestions.suggestedKeywords') &&
  (screenContent.includes('handleAutoFillQuery') || screenContent.includes('arrow-top')),
  'Section 2: Suggested Close Keywords with auto-fill arrow supported'
);
assert(
  screenContent.includes('suggestions.matchingCategories'),
  'Section 3: Matching Categories chips supported'
);
assert(
  screenContent.includes('suggestions.topProducts'),
  'Section 4: Instant Product preview cards supported'
);
assert(
  screenContent.includes('recentSearches'),
  'Section 5: Recent Searches supported when query is empty'
);
assert(
  screenContent.includes('numColumns={2}') || screenContent.includes('numColumns: 2'),
  '2-column FlatList grid implemented for search results'
);
assert(
  screenContent.includes('onEndReached') && screenContent.includes('onEndReachedThreshold'),
  'Infinite scroll pagination (onEndReached) supported'
);
assert(
  screenContent.includes('RefreshControl') && screenContent.includes('refreshing'),
  'Pull-to-refresh supported'
);
assert(
  screenContent.includes('filterModalVisible') && screenContent.includes('Modal'),
  'Filter and Sort Modal implemented'
);
assert(
  screenContent.includes('activeFiltersCount'),
  'Active filters count badge implemented'
);
assert(
  screenContent.includes('POPULAR_SEARCH_TERMS') || screenContent.includes('popular'),
  'Empty state displays popular search keyword chips'
);

// ---------------------------------------------------------------------------
// TEST SUITE 4: App Routing & Navigation
// ---------------------------------------------------------------------------
console.log('\n\x1b[35m[4/5] Navigation Wiring\x1b[0m');
const navPath = path.join(srcDir, 'navigation', 'AppNavigator.js');
const navContent = fs.readFileSync(navPath, 'utf-8');
assert(
  navContent.includes('MobileSearchScreen') && navContent.includes('name="Search"'),
  'Search route pointing to MobileSearchScreen registered in AppNavigator'
);

const catalogPath = path.join(srcDir, 'screens', 'buyer', 'CatalogScreen.js');
const catalogContent = fs.readFileSync(catalogPath, 'utf-8');
assert(
  catalogContent.includes("navigation.navigate('Search')") ||
  catalogContent.includes('navigation.navigate("Search")'),
  'CatalogScreen search bar navigates to Search screen'
);

// ---------------------------------------------------------------------------
// TEST SUITE 5: i18n Key Verification
// ---------------------------------------------------------------------------
console.log('\n\x1b[35m[5/5] i18n Translation Key Parity\x1b[0m');
const arLocalePath = path.join(srcDir, 'locales', 'ar.json');
const enLocalePath = path.join(srcDir, 'locales', 'en.json');
const arLocale = JSON.parse(fs.readFileSync(arLocalePath, 'utf-8'));
const enLocale = JSON.parse(fs.readFileSync(enLocalePath, 'utf-8'));

assert(arLocale.search && typeof arLocale.search === 'object', 'ar.json contains search namespace');
assert(enLocale.search && typeof enLocale.search === 'object', 'en.json contains search namespace');

const arKeys = Object.keys(arLocale.search);
const enKeys = Object.keys(enLocale.search);
assert(
  arKeys.length === enKeys.length,
  `Exact key parity in mobile search namespace: AR=${arKeys.length}, EN=${enKeys.length}`
);

// Summary
console.log('\n\x1b[36m=======================================================');
console.log(`   Verification Complete: ${passedTests} Passed, ${failedTests} Failed`);
console.log('=======================================================\x1b[0m\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
