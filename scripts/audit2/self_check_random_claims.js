const fs = require('fs');
const path = require('path');

const SEED = 20261101;
console.log(`Self-check verification running with deterministic seed: ${SEED}\n`);

// Pseudo-random generator with seed
function pseudoRandom(s) {
  let mask = 0xffffffff;
  let m_w = (123456789 + s) & mask;
  let m_z = (987654321 - s) & mask;
  return function() {
    m_z = (36969 * (m_z & 65535) + (m_z >>> 16)) & mask;
    m_w = (18000 * (m_w & 65535) + (m_w >>> 16)) & mask;
    let result = ((m_z << 16) + (m_w & 65535)) >>> 0;
    result /= 4294967296;
    return result;
  };
}

const rng = pseudoRandom(SEED);

const claims = [
  {
    id: 1,
    claim: 'package.json defines expo at ^58.0.0 and react-native at 0.88.0',
    verify: () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../mobile/package.json'), 'utf8'));
      return pkg.dependencies.expo === '^58.0.0' && pkg.dependencies['react-native'] === '0.88.0';
    }
  },
  {
    id: 2,
    claim: 'Both app.json and app.config.js exist in the mobile directory',
    verify: () => {
      return fs.existsSync(path.resolve(__dirname, '../../mobile/app.json')) &&
             fs.existsSync(path.resolve(__dirname, '../../mobile/app.config.js'));
    }
  },
  {
    id: 3,
    claim: 'app.config.js package name is com.egyptianmarketplace.app whereas app.json is com.marketplace.app',
    verify: () => {
      const appJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../mobile/app.json'), 'utf8'));
      const appConfig = require('../../mobile/app.config.js');
      return appJson.expo.android.package === 'com.marketplace.app' &&
             appConfig.expo.android.package === 'com.egyptianmarketplace.app';
    }
  },
  {
    id: 4,
    claim: 'client.js has no timeout property configured on axios.create',
    verify: () => {
      const content = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/api/client.js'), 'utf8');
      const createBlock = content.match(/axios\.create\(\{([\s\S]*?)\}\)/);
      return createBlock && !createBlock[1].includes('timeout');
    }
  },
  {
    id: 5,
    claim: 'OrdersApi createOrder injects Idempotency-Key header when provided',
    verify: () => {
      const content = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/api/ordersApi.js'), 'utf8');
      return content.includes("headers['Idempotency-Key'] = effectiveKey;");
    }
  },
  {
    id: 6,
    claim: 'Total leaf i18n keys in sync between ar.json and en.json is 1063 (corrected from outdated 1051 claim)',
    verify: () => {
      function getLeafKeys(obj, prefix = '') {
        let keys = [];
        for (const k of Object.keys(obj)) {
          const fullKey = prefix ? `${prefix}.${k}` : k;
          if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
            keys = keys.concat(getLeafKeys(obj[k], fullKey));
          } else {
            keys.push(fullKey);
          }
        }
        return keys;
      }
      const ar = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../mobile/src/locales/ar.json'), 'utf8'));
      const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../mobile/src/locales/en.json'), 'utf8'));
      const arCount = getLeafKeys(ar).length;
      const enCount = getLeafKeys(en).length;
      return arCount === 1063 && enCount === 1063;
    }
  },
  {
    id: 7,
    claim: 'AuthContext creates unmemoized provider value object literal',
    verify: () => {
      const content = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/context/AuthContext.js'), 'utf8');
      return content.includes('<AuthContext.Provider\n      value={{');
    }
  },
  {
    id: 8,
    claim: 'SecureStore refresh token key format is refresh_token_${userId} without requireAuthentication',
    verify: () => {
      const content = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/utils/storage.js'), 'utf8');
      return content.includes('const getRefreshTokenKey = (userId) => `${REFRESH_TOKEN_PREFIX}${userId}`;') &&
             content.includes('await SecureStore.setItemAsync(getRefreshTokenKey(userId), refreshToken);');
    }
  },
  {
    id: 9,
    claim: 'NavigationContainer in AppNavigator does not specify a linking prop',
    verify: () => {
      const content = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/navigation/AppNavigator.js'), 'utf8');
      return content.includes('<NavigationContainer') && !content.includes('linking');
    }
  },
  {
    id: 10,
    claim: 'withCleartextTraffic plugin sets android:usesCleartextTraffic to true',
    verify: () => {
      const content = fs.readFileSync(path.resolve(__dirname, '../../mobile/plugins/withCleartextTraffic.js'), 'utf8');
      return content.includes("mainApplication.$['android:usesCleartextTraffic'] = 'true';");
    }
  },
  {
    id: 11,
    claim: 'ErrorBoundary displays errorInfo.componentStack on screen in production',
    verify: () => {
      const content = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/components/ErrorBoundary.js'), 'utf8');
      return content.includes('{this.state.errorInfo?.componentStack && (') &&
             content.includes('{this.state.errorInfo.componentStack}');
    }
  },
  {
    id: 12,
    claim: 'There are 15 screens with FlatList and 0 have initialNumToRender or windowSize set',
    verify: () => {
      const srcDir = path.resolve(__dirname, '../../mobile/src/screens');
      let flatListCount = 0;
      let windowedCount = 0;
      function check(dir) {
        fs.readdirSync(dir).forEach(f => {
          const p = path.join(dir, f);
          if (fs.statSync(p).isDirectory()) check(p);
          else if (f.endsWith('.js')) {
            const c = fs.readFileSync(p, 'utf8');
            if (c.includes('<FlatList')) {
              flatListCount++;
              if (c.includes('initialNumToRender') || c.includes('windowSize')) windowedCount++;
            }
          }
        });
      }
      check(srcDir);
      return flatListCount === 15 && windowedCount === 0;
    }
  }
];

// Shuffle claims using RNG and pick 10
const shuffled = [...claims].sort(() => rng() - 0.5);
const selected = shuffled.slice(0, 10);

console.log(`Selected 10 claims for re-verification:\n`);
let passedCount = 0;

selected.forEach((item, idx) => {
  const result = item.verify();
  if (result) passedCount++;
  console.log(`[Claim ${idx + 1}] (ID ${item.id}): ${item.claim}`);
  console.log(`  -> Status: ${result ? 'VERIFIED [V]' : 'FAILED'}\n`);
});

console.log(`Result: ${passedCount}/10 claims successfully re-verified.`);
