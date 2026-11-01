# Mobile Audit 2 Commands Log

This file records every command executed during the Mobile Audit 2, including the command line, execution context, timestamp, and purpose.

---

### Command 1: Inventory lockfile package versions
```powershell
node scripts/audit2/check_mobile_inventory.js
```

### Command 2: Expo public config evaluation
```powershell
cd mobile; npx expo config --type public
```

### Command 3: Static scan of API, storage, console, SDKs, RTL, and touch targets
```powershell
node scripts/audit2/scan_mobile_details.js
```

### Command 4: Locate AuthController
```powershell
Get-ChildItem -Path d:\Backend\marketplace\backend -Recurse -Filter *AuthController* | Select-Object FullName
```

### Command 5: Cross-reference mobile API calls with backend routes
```powershell
node scripts/audit2/map_backend_vs_mobile_routes.js
```

### Command 6: npm audit --omit=dev in mobile
```powershell
cd mobile; npm audit --omit=dev
```

### Command 7: npx expo-doctor in mobile
```powershell
cd mobile; npx expo-doctor
```

### Command 8: Temporary export to measure bundle size
```powershell
node scripts/audit2/measure_bundle.js
```

### Command 9: Run each mobile test file and inspect assertions
```powershell
node mobile/tests/test_auth_flows_mock.js
node mobile/tests/test_biometric_cold_start_and_use_password_mock.js
node mobile/tests/test_biometric_lock_state_machine_mock.js
node mobile/tests/test_feature_gating_mock.js
node mobile/tests/test_mobile_smart_search.js
node mobile/tests/test_single_flight_refresh_mock.js
```

### Command 10: Run i18n parity check script
```powershell
cd mobile; npm run i18n:check
```

### Command 11: Deep scan of hardcoded strings, RTL, touch targets, accessibility, and contrast
```powershell
node scripts/audit2/audit_ux_a11y_rtl.js
```

### Command 12: Audit performance, FlatList, memory leaks, timers, and context re-renders
```powershell
node scripts/audit2/audit_performance_and_leaks.js
```

### Command 13: Self-check 10 random audit claims
```powershell
node scripts/audit2/self_check_random_claims.js
```

