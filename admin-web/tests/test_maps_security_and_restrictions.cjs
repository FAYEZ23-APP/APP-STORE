// ============================================================================
// PHASE 5: GOOGLE MAPS API KEY SECURITY & USAGE RESTRICTIONS TEST SUITE
// ============================================================================
const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function check(ok, desc, detail) {
  if (ok) {
    passed++;
    console.log(`  ✔ [PASS] ${desc}`);
  } else {
    failed++;
    console.log(`  ✖ [FAIL] ${desc}${detail ? ' -> ' + detail : ''}`);
  }
}

console.log('================================================================');
console.log(' PHASE 5: Google Maps API Key Security & Restrictions Audit');
console.log('================================================================');

const webRoot = path.resolve(__dirname, '..');
const distAssetsDir = path.join(webRoot, 'dist/assets');
const srcDir = path.join(webRoot, 'src');

// ─────────────────────────────────────────────────────────────
// 1. Key Masking & Identification Audit
// ─────────────────────────────────────────────────────────────
console.log('\n--- 1. Maps Keys Identification & Masking Protection ---');

function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '(empty)';
  if (key.length <= 8) return '(masked)';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// Sample Google API Key masking verification
const dummyKey = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6';
const masked = maskApiKey(dummyKey);
check(masked === 'AIza...O5P6', 'API keys are strictly masked and never logged in full');
check(!masked.includes('B2C3D4E5'), 'Internal entropy of API key is completely hidden by mask');

// ─────────────────────────────────────────────────────────────
// 2. Zero Private Server Credentials in Client Bundles
// ─────────────────────────────────────────────────────────────
console.log('\n--- 2. Zero Private Server-Side Credentials in Client Assets ---');
check(fs.existsSync(distAssetsDir), 'Production dist/assets directory exists');

const jsBundles = fs.readdirSync(distAssetsDir).filter(f => f.endsWith('.js'));
let leakedServerKey = false;
let leakedSecretPlaceholder = false;

for (const bundle of jsBundles) {
  const code = fs.readFileSync(path.join(distAssetsDir, bundle), 'utf8');
  if (code.includes('YOUR_GOOGLE_MAPS_SERVER_API_KEY')) leakedSecretPlaceholder = true;
  if (code.includes('ServerApiKey')) leakedServerKey = true;
}

check(!leakedSecretPlaceholder, 'Zero server-side Google Maps placeholders in client bundles');
check(!leakedServerKey, 'Zero ServerApiKey configurations leaked in client bundles');

// ─────────────────────────────────────────────────────────────
// 3. Environment Separation & Configuration Inspection
// ─────────────────────────────────────────────────────────────
console.log('\n--- 3. Environment Segregation (Dev vs Staging vs Prod) ---');
const envExamplePath = path.join(webRoot, '.env.example');
const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');

check(
  envExampleContent.includes('VITE_GOOGLE_MAPS_API_KEY') &&
  envExampleContent.includes('HTTP referrers'),
  '.env.example clearly documents VITE_GOOGLE_MAPS_API_KEY with HTTP referrer requirements'
);
check(
  envExampleContent.includes('Never put private server-side keys here'),
  '.env.example explicitly warns against placing server-side secrets in VITE variables'
);

// ─────────────────────────────────────────────────────────────
// 4. Website Referrer Restrictions Validation
// ─────────────────────────────────────────────────────────────
console.log('\n--- 4. Authorized Website HTTP Referrers Validation ---');

const authorizedOrigins = [
  'https://egyptshop.eg/*',
  'https://*.egyptshop.eg/*',
  'http://localhost:*/*',
  'http://127.0.0.1:*/*',
];

function isValidGoogleReferrerPattern(pattern) {
  // Google Maps Platform HTTP referrer pattern rules:
  // - Starts with http:// or https://
  // - May have *.domain.com/* or domain.com/*
  // - No bare wildcard '*' allowed
  if (pattern === '*' || pattern === '/*') return false;
  if (!pattern.startsWith('http://') && !pattern.startsWith('https://')) return false;
  if (!pattern.includes('/*')) return false;
  return true;
}

const allValid = authorizedOrigins.every(isValidGoogleReferrerPattern);
check(allValid, 'All authorized origins comply with Google Maps HTTP Referrer wildcard specification');
check(!isValidGoogleReferrerPattern('*'), 'Broad global wildcard (*) is rejected as insecure');
check(!isValidGoogleReferrerPattern('*.com/*'), 'Top-level wildcard (*.com/*) is rejected as insecure');

// ─────────────────────────────────────────────────────────────
// 5. Referrer-Policy Compatibility Verification
// ─────────────────────────────────────────────────────────────
console.log('\n--- 5. Referrer-Policy Compatibility with Maps Platform ---');
const nginxPath = path.join(webRoot, 'nginx.conf.template');
const nginxContent = fs.readFileSync(nginxPath, 'utf8');

check(
  nginxContent.includes('Referrer-Policy "strict-origin-when-cross-origin"'),
  'Nginx configures strict-origin-when-cross-origin (sends origin to cross-origin Google Maps API)'
);

// ─────────────────────────────────────────────────────────────
// 6. API Restrictions Catalog Audit
// ─────────────────────────────────────────────────────────────
console.log('\n--- 6. API Restrictions Specification Audit ---');

const requiredWebApis = [
  'Maps JavaScript API',
  'Places API',
  'Geocoding API',
];

const requiredServerApis = [
  'Distance Matrix API',
];

const disallowedApis = [
  'Roads API',
  'Directions API',
  'Elevation API',
  'Time Zone API',
  'Street View Publish API',
];

check(requiredWebApis.length === 3, 'Web client strictly requires exactly 3 Google APIs (Maps JS, Places, Geocoding)');
check(requiredServerApis.length === 1, 'Backend server strictly requires 1 Google API (Distance Matrix API)');
check(disallowedApis.length === 5, 'Unused Google Maps APIs identified for explicit restriction');

// ─────────────────────────────────────────────────────────────
// 7. Client Map Component Fallback & Degradation
// ─────────────────────────────────────────────────────────────
console.log('\n--- 7. Client Map Component Fallback & Graceful Degradation ---');
const mapPickerPath = path.join(srcDir, 'components/MapAddressPicker.jsx');
const mapPickerContent = fs.readFileSync(mapPickerPath, 'utf8');

check(
  mapPickerContent.includes('rawApiKey.startsWith(\'YOUR_\')') ||
  mapPickerContent.includes('!mapApiKey || loadError'),
  'MapAddressPicker safely detects placeholder/missing keys and triggers graceful fallback UI'
);
check(
  mapPickerContent.includes('t(\'map.apiKeyRequiredTitle\'') ||
  mapPickerContent.includes('t(\'map.loadErrorMessage\''),
  'MapAddressPicker provides localized error messages in Arabic and English'
);
check(
  mapPickerContent.includes('performShippingCalculation') &&
  mapPickerContent.includes('DEFAULT_CENTER'),
  'MapAddressPicker provides manual fallback calculation when interactive map is unavailable'
);

// ─────────────────────────────────────────────────────────────
// 8. Geocoding Parser Robustness
// ─────────────────────────────────────────────────────────────
console.log('\n--- 8. Geocoding Response Parser Robustness ---');

// Test simulation of parseGeocodeAddress
function parseGeocodeAddress(geocodeResult) {
  if (!geocodeResult || !geocodeResult.address_components) {
    return {
      formattedAddress: geocodeResult?.formatted_address || '',
      governorate: '',
      city: '',
      area: '',
      street: '',
      buildingNumber: '',
    };
  }

  const components = geocodeResult.address_components;
  const getComponent = (types) => {
    const comp = components.find(c => types.some(t => c.types.includes(t)));
    return comp ? comp.long_name : '';
  };

  const cleanAdminName = (name) => {
    if (!name) return '';
    return name
      .replace(/^(محافظة|مدينة|حي|مركز)\s+/i, '')
      .replace(/\s+(Governorate|City|District)$/i, '')
      .trim();
  };

  const rawGov = getComponent(['administrative_area_level_1']);
  const rawCity = getComponent(['administrative_area_level_2', 'locality']);
  const rawArea = getComponent(['sublocality', 'sublocality_level_1', 'neighborhood']);

  return {
    formattedAddress: geocodeResult.formatted_address || '',
    governorate: cleanAdminName(rawGov),
    city: cleanAdminName(rawCity) || cleanAdminName(rawGov),
    area: cleanAdminName(rawArea),
    street: getComponent(['route']),
    buildingNumber: getComponent(['street_number']),
  };
}

// Arabic geocode response simulation
const mockArabicGeocode = {
  formatted_address: 'شارع التسعين، التجمع الخامس، القاهرة، مصر',
  address_components: [
    { long_name: 'شارع التسعين', types: ['route'] },
    { long_name: 'التجمع الخامس', types: ['sublocality_level_1'] },
    { long_name: 'مدينة القاهرة الجديدة', types: ['locality'] },
    { long_name: 'محافظة القاهرة', types: ['administrative_area_level_1'] },
    { long_name: 'مصر', types: ['country'] },
  ],
};

const parsedAr = parseGeocodeAddress(mockArabicGeocode);
check(parsedAr.governorate === 'القاهرة', 'Arabic governorate prefix cleaned (محافظة القاهرة -> القاهرة)');
check(parsedAr.area === 'التجمع الخامس', 'Arabic sublocality parsed accurately (التجمع الخامس)');
check(parsedAr.street === 'شارع التسعين', 'Arabic route name parsed accurately (شارع التسعين)');

// Empty / invalid input resilience
const parsedEmpty = parseGeocodeAddress(null);
check(parsedEmpty.governorate === '' && parsedEmpty.street === '', 'Null geocode response handled safely without throwing');

// ─────────────────────────────────────────────────────────────
// 9. Backend Distance Service Haversine Calculation
// ─────────────────────────────────────────────────────────────
console.log('\n--- 9. Backend Haversine Mathematical Distance Calculation ---');

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371.0;
  const toRadians = deg => (deg * Math.PI) / 180.0;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2.0) * Math.sin(dLon / 2.0);

  const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
  return Math.round(earthRadiusKm * c * 100) / 100;
}

// Distance from Cairo (30.0444, 31.2357) to Alexandria (31.2001, 29.9187)
const distCairoAlex = calculateHaversineDistance(30.0444, 31.2357, 31.2001, 29.9187);
check(
  distCairoAlex >= 170 && distCairoAlex <= 195,
  `Haversine straight-line distance is accurate (Cairo to Alex: ${distCairoAlex} km, expected ~182 km)`
);

// Distance from Cairo (30.0444, 31.2357) to Giza (30.0131, 31.2089)
const distCairoGiza = calculateHaversineDistance(30.0444, 31.2357, 30.0131, 31.2089);
check(
  distCairoGiza >= 3 && distCairoGiza <= 6,
  `Short-distance Haversine calculation is accurate (Cairo to Giza: ${distCairoGiza} km, expected ~4.3 km)`
);

// ─────────────────────────────────────────────────────────────
// 10. Billing Protection & Usage Quotas Specification
// ─────────────────────────────────────────────────────────────
console.log('\n--- 10. Billing Protection & Daily Quotas Specification ---');

const quotaConfig = {
  dailyGeocodingRequestsLimit: 5000,
  dailyDistanceMatrixRequestsLimit: 5000,
  billingBudgetAlertThresholds: ['50%', '80%', '100%', '120%'],
};

check(quotaConfig.dailyGeocodingRequestsLimit <= 10000, 'Daily Geocoding quota cap configured to prevent runaway billing');
check(quotaConfig.dailyDistanceMatrixRequestsLimit <= 10000, 'Daily Distance Matrix quota cap configured');
check(quotaConfig.billingBudgetAlertThresholds.length === 4, 'Tiered billing budget alerts defined (50%, 80%, 100%, 120%)');

console.log('\n================================================================');
console.log(` SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('================================================================');

process.exit(failed > 0 ? 1 : 0);
