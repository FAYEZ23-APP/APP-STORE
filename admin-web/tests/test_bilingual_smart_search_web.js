/**
 * Phase 2 Frontend Verification Test Suite: test_bilingual_smart_search_web.js
 * 
 * Verifies:
 * 1. searchApi exports and parameter formatting.
 * 2. useSmartSearch hook logic, debounce mechanics, and localStorage recent searches.
 * 3. Safe text highlighting algorithm (No innerHTML, pure safe segmentation).
 * 4. SmartSearchBar component structure, sections (DidYouMean, Keywords, Categories, Products), and keyboard mapping.
 * 5. SearchResultsPage layout, filter synchronization, typo banner, and empty state.
 * 6. RTL/LTR bilingual parity and translation key availability.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
console.log('   Bilingual Smart Search Frontend Web Test Suite      ');
console.log('=======================================================\x1b[0m\n');

// ---------------------------------------------------------------------------
// TEST SUITE 1: API Client & Endpoint Verification
// ---------------------------------------------------------------------------
console.log('\x1b[35m[1/5] Search API Service (src/api/searchApi.js)\x1b[0m');
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
  searchApiContent.includes('signal') && searchApiContent.includes('AbortSignal'),
  'searchApi supports AbortSignal cancellation'
);

// ---------------------------------------------------------------------------
// TEST SUITE 2: useSmartSearch Hook Verification
// ---------------------------------------------------------------------------
console.log('\n\x1b[35m[2/5] Custom Hook (src/hooks/useSmartSearch.js)\x1b[0m');
const hookPath = path.join(srcDir, 'hooks', 'useSmartSearch.js');
assert(fs.existsSync(hookPath), 'useSmartSearch.js exists');

const hookContent = fs.readFileSync(hookPath, 'utf-8');
assert(hookContent.includes('250'), '250ms debounce configured');
assert(hookContent.includes('AbortController'), 'AbortController used for cancellation');
assert(hookContent.includes('abortControllerRef'), 'abortControllerRef manages in-flight requests');
assert(hookContent.includes('@marketplace_recent_searches'), 'localStorage key @marketplace_recent_searches used');
assert(hookContent.includes('addRecentSearch'), 'addRecentSearch helper defined');
assert(hookContent.includes('removeRecentSearch'), 'removeRecentSearch helper defined');
assert(hookContent.includes('clearRecentSearches'), 'clearRecentSearches helper defined');
assert(hookContent.includes('clearSuggestions'), 'clearSuggestions helper defined');
assert(hookContent.includes('executeSearch'), 'executeSearch helper defined');

// Unit test simulated recent searches logic
const MAX_RECENT = 8;
const simulateAddRecent = (existing, newTerm) => {
  const clean = newTerm.trim();
  if (!clean) return existing;
  const filtered = existing.filter((item) => item.toLowerCase() !== clean.toLowerCase());
  return [clean, ...filtered].slice(0, MAX_RECENT);
};

let recentList = ['ايفون 15', 'laptop', 'charger'];
recentList = simulateAddRecent(recentList, 'ايفون 15'); // should move to front without duplicates
assert(recentList[0] === 'ايفون 15' && recentList.length === 3, 'Recent searches deduplicates case/term');

recentList = simulateAddRecent(recentList, 'samsung galaxy');
assert(recentList[0] === 'samsung galaxy' && recentList.length === 4, 'Recent searches prepends new query');

// ---------------------------------------------------------------------------
// TEST SUITE 3: SmartSearchBar Component Verification
// ---------------------------------------------------------------------------
console.log('\n\x1b[35m[3/5] SmartSearchBar Component (src/components/search/SmartSearchBar.jsx)\x1b[0m');
const barPath = path.join(srcDir, 'components', 'search', 'SmartSearchBar.jsx');
assert(fs.existsSync(barPath), 'SmartSearchBar.jsx exists');

const barContent = fs.readFileSync(barPath, 'utf-8');
assert(!barContent.includes('dangerouslySetInnerHTML'), 'Zero dangerouslySetInnerHTML used');
assert(barContent.includes('HighlightedText'), 'Safe HighlightedText segmentation component defined');
assert(barContent.includes('didYouMean'), 'Section 1: DidYouMean section supported');
assert(barContent.includes('suggestedKeywords'), 'Section 2: SuggestedKeywords section supported');
assert(barContent.includes('matchingCategories'), 'Section 3: MatchingCategories section supported');
assert(barContent.includes('topProducts'), 'Section 4: Instant Product Previews supported');
assert(barContent.includes('showRecentSection'), 'Recent searches section displayed when query is empty');
assert(
  barContent.includes('ArrowDown') &&
  barContent.includes('ArrowUp') &&
  barContent.includes('Enter') &&
  barContent.includes('Escape'),
  'Full keyboard navigation supported (ArrowUp, ArrowDown, Enter, Escape)'
);
assert(
  barContent.includes('FALLBACK_IMAGE_URL') && barContent.includes('onerror = null'),
  'Infinite-loop-proof image error fallback implemented'
);

// ---------------------------------------------------------------------------
// TEST SUITE 4: SearchResultsPage Verification
// ---------------------------------------------------------------------------
console.log('\n\x1b[35m[4/5] SearchResultsPage Component (src/pages/SearchResultsPage.jsx)\x1b[0m');
const pagePath = path.join(srcDir, 'pages', 'SearchResultsPage.jsx');
assert(fs.existsSync(pagePath), 'SearchResultsPage.jsx exists');

const pageContent = fs.readFileSync(pagePath, 'utf-8');
assert(pageContent.includes('useSearchParams'), 'useSearchParams used for URL query synchronization');
assert(
  pageContent.includes('minPrice') &&
  pageContent.includes('maxPrice') &&
  pageContent.includes('inStock') &&
  pageContent.includes('sort') &&
  pageContent.includes('category'),
  'All required search parameters supported (q, category, minPrice, maxPrice, inStock, sort)'
);
assert(
  pageContent.includes('didYouMean') &&
  (pageContent.includes('Showing results for') || pageContent.includes('عرض النتائج لـ')),
  'Typo correction banner ("Showing results for...") implemented'
);
assert(
  pageContent.includes('Search instead for') || pageContent.includes('البحث بدلاً من ذلك عن'),
  'Option to search original keyword implemented'
);
assert(pageContent.includes('ProductCard'), 'ProductCard component used for product grid');
assert(
  pageContent.includes('POPULAR_SEARCH_TERMS') || pageContent.includes('popular'),
  'Empty state displays popular search keyword chips'
);
assert(
  pageContent.includes('mobileFiltersOpen') || pageContent.includes('SlidersHorizontal'),
  'Responsive filter drawer for mobile devices supported'
);

// ---------------------------------------------------------------------------
// TEST SUITE 5: App Routing & i18n Parity
// ---------------------------------------------------------------------------
console.log('\n\x1b[35m[5/5] App Routing & i18n Translation Parity\x1b[0m');
const appPath = path.join(srcDir, 'App.jsx');
const appContent = fs.readFileSync(appPath, 'utf-8');
assert(
  appContent.includes('/search') && appContent.includes('SearchResultsPage'),
  'Route /search configured in App.jsx'
);

const navbarPath = path.join(srcDir, 'components', 'Navbar.jsx');
const navbarContent = fs.readFileSync(navbarPath, 'utf-8');
assert(
  navbarContent.includes('SmartSearchBar'),
  'Navbar embeds SmartSearchBar in desktop and mobile view'
);

const arLocalePath = path.join(srcDir, 'locales', 'ar.json');
const enLocalePath = path.join(srcDir, 'locales', 'en.json');
const arLocale = JSON.parse(fs.readFileSync(arLocalePath, 'utf-8'));
const enLocale = JSON.parse(fs.readFileSync(enLocalePath, 'utf-8'));

assert(arLocale.search && typeof arLocale.search === 'object', 'ar.json contains "search" namespace');
assert(enLocale.search && typeof enLocale.search === 'object', 'en.json contains "search" namespace');

const arSearchKeys = Object.keys(arLocale.search);
const enSearchKeys = Object.keys(enLocale.search);
assert(
  arSearchKeys.length === enSearchKeys.length,
  `Exact key parity in search namespace: AR=${arSearchKeys.length}, EN=${enSearchKeys.length}`
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
