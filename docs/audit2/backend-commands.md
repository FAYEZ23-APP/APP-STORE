# Backend Audit Command Log

This file records every command executed during the backend audit.

1. `New-Item -ItemType Directory -Force -Path docs\audit2, scripts\audit2`
2. `Get-ChildItem -Path backend -Recurse -Filter *.csproj | Select-Object FullName`
3. `Get-ChildItem -Path . -Recurse -Filter *test*.csproj | Select-Object FullName`
4. `Get-ChildItem -Path . -Recurse -Filter *.csproj | Select-Object FullName`
5. `Get-ChildItem -Path . -Directory`
6. `Get-ChildItem -Path tests`
7. `Get-ChildItem -Path scripts`
8. `Get-ChildItem -Path . -Recurse -Filter *.sln | Select-Object FullName`
9. `Get-ChildItem -Path backend`
10. `Get-Item Marketplace.API, Marketplace.Application, Marketplace.Domain, Marketplace.Infrastructure | Select-Object FullName, LinkType, Target`
11. `Get-ChildItem -Path Marketplace.API`
12. `dotnet --version`
13. `dotnet list backend/Marketplace.slnx package --vulnerable --include-transitive`
14. `Get-ChildItem -Path backend/Marketplace.Application, backend/Marketplace.Infrastructure -Recurse -File | Select-Object FullName`
15. `Get-ChildItem -Path backend/Marketplace.API/Controllers -File | Select-Object Name`
16. `Get-ChildItem -Path scripts/audit`
17. `Get-ChildItem -Path backend/Marketplace.Application -Recurse -Filter *Validator*.cs | Select-Object FullName`
18. `Get-ChildItem -Path backend/Marketplace.Application/Validators -Recurse -Filter *.cs | Select-String -Pattern "class\s+\w+\s*:\s*AbstractValidator<([^>]+)>"`
19. `node -v`
20. `Get-ChildItem -Path backend/Marketplace.API -Filter appsettings*.json | Select-Object Name`
21. `$env:TEST_DB`
22. `Get-ChildItem -Path mobile, admin-web -Recurse -Filter *api* | Select-Object FullName`
23. `Get-ChildItem -Path mobile/src/api -File | Select-Object Name`
24. `node scripts/audit2/generate-inventory.js`
25. `node scripts/audit/scan-routes.js`
26. `Get-ChildItem -Path admin-web/src -Recurse -Filter *client* | Select-Object FullName`
27. `Get-ChildItem -Path . -Recurse -Include *swagger*.json, *openapi*.json, *openapi*.yaml, *openapi*.yml | Select-Object FullName`
28. `Get-ChildItem -Path mobile/src -Recurse -Include *.js, *.jsx | Select-String -Pattern "updateOrderStatus"`
29. `Get-ChildItem -Path admin-web/src -Recurse -Include *.js, *.jsx | Select-String -Pattern "updateOrderStatus"`
30. `node scripts/audit2/contract-check.js`
31. `Get-ChildItem -Path mobile/src/api, admin-web/src/api -File | Select-String -Pattern "client\.(get|post|put|delete|patch)"`
32. `Get-ChildItem -Path backend/Marketplace.Application/Services -Recurse -File | Select-Object Name`
33. `Get-ChildItem -Path backend/Marketplace.Application/Services/OrderService.cs | Select-String -Pattern "CancelOrderAsync" -Context 0, 30`
34. `Get-ChildItem -Path backend -Recurse -Filter *.cs | Select-String -Pattern "(FromSqlRaw|ExecuteSqlRaw|ExecuteSqlInterpolated|FromSqlInterpolated)"`
35. `Get-ChildItem -Path backend/Marketplace.Application/Services/Search -Recurse -File | Select-String -Pattern "Sql"`
36. `Get-ChildItem -Path backend/Marketplace.Application/Services/UserService.cs | Select-String -Pattern "GetAddressByIdAsync" -Context 0, 15`
37. `Get-ChildItem -Path backend -Recurse -Filter JwtService.cs | Select-Object FullName`
38. `Get-ChildItem -Path backend/Marketplace.Application/Services/AuthService.cs | Select-String -Pattern "RefreshTokenAsync" -Context 0, 30`
39. `Get-ChildItem -Path backend -Recurse -Filter BCryptPasswordHasher.cs | Select-Object FullName`
40. `Get-ChildItem -Path backend -Recurse -Filter VerificationService.cs | Select-Object FullName`
41. `Get-ChildItem -Path backend/Marketplace.Application/DTOs/Users -Recurse | Select-String -Pattern "class UpdateProfileRequest" -Context 0, 10`
42. `Get-ChildItem -Path backend -Recurse -Filter ImageUploadService.cs | Select-Object FullName`
43. `Get-ChildItem -Path backend -Recurse -Filter *.cs | Select-String -Pattern "(HttpClient|GetAsync|PostAsync|SendAsync|WebRequest)"`
44. `Get-ChildItem -Path backend -Recurse -Filter *.cs | Select-String -Pattern "(nosniff|Hsts|HttpsRedirection|X-Frame-Options|Content-Security-Policy)"`
45. `Get-ChildItem -Path backend -Recurse -Filter *.cs | Select-String -Pattern "Log(Information|Warning|Error|Critical|Debug|Trace)\("`
46. `Get-ChildItem -Path backend -Recurse -Filter *.cs | Select-String -Pattern "Console\.Write"`
47. `Get-ChildItem -Path backend -Recurse -Filter GoogleTokenValidator.cs | Select-Object FullName`
48. `Get-ChildItem -Path backend -Recurse -Filter ResendEmailSender.cs | Select-Object FullName`
49. `Get-ChildItem -Path backend/Marketplace.Infrastructure/BackgroundServices -File | Select-Object Name`
50. `Get-ChildItem -Path backend -Recurse -Filter PushNotificationQueue.cs | Select-Object FullName`
51. `Get-ChildItem -Path backend/Marketplace.Application/Services/OrderService.cs | Select-String -Pattern "Notification" -Context 0, 5`
52. `Get-ChildItem -Path mobile/src, admin-web/src -Recurse -Include *.js, *.jsx | Select-String -Pattern "(OnReceipt|COD|CashOnDelivery|PaymentMethod|deliveryMethod|ShipmentStatus)"`
53. `Get-ChildItem -Path mobile/src/screens/buyer/CheckoutScreen.js | Select-String -Pattern "paymentMethod" -Context 2, 5`
54. `Get-ChildItem -Path mobile/src, admin-web/src -Recurse -Include *.js, *.jsx | Select-String -Pattern "err(or)?\.response\?\.data"`
55. `Get-ChildItem -Path mobile/src, admin-web/src -Recurse -Include *.js, *.jsx | Select-String -Pattern "defectImage"`
56. `dotnet test`
57. `dotnet test backend/Marketplace.slnx`
58. `dotnet build backend/Marketplace.slnx`
59. `Get-Process -Id 4744 -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, StartTime, Path`
60. `Get-NetTCPConnection -OwningProcess 4744 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State`
61. `Get-Random -Minimum 100000 -Maximum 999999`
