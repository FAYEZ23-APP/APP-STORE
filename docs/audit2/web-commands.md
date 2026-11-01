# Web Audit Execution Commands Log
Date: 2026-11-01
Scope: admin-web and storefront audit
Auditor: Independent Senior Auditor (READ-ONLY Mode)

## Executed Commands

1. Initial inspection of admin-web item, git status, and audit directory:
```powershell
powershell -Command "Get-Item admin-web; git status -s admin-web; Test-Path docs/audit2"
```

2. List files in docs/audit2:
```powershell
powershell -Command "Get-ChildItem docs/audit2 -ErrorAction SilentlyContinue | Select-Object Name, Length"
```

3. Locate the REAL source (junction target, tracked count, git tree, commit history):
```powershell
powershell -Command "Get-Item admin-web | Format-List *; (git ls-files admin-web | Measure-Object).Count; git ls-tree HEAD admin-web; git log -n 5 --oneline -- admin-web"
```

4. Verify git history across all branches and working tree status:
```powershell
powershell -Command "git log --all --oneline -- admin-web | Measure-Object; git status -s admin-web | Measure-Object"
```

5. Find all HTML files across repository:
```powershell
powershell -Command "Get-ChildItem -Filter *.html -Recurse -Depth 3 | Select-Object FullName"
```

6. Inspect Program.cs for static files, CORS, and SPA routing:
```powershell
powershell -Command "Select-String -Path 'backend\Marketplace.API\Program.cs' -Pattern 'Cors|Static|Spa|Security|Header|Fallback' -Context 2,2"
```

7. List relative paths of all files in admin-web:
```powershell
Get-ChildItem -Path admin-web -Recurse -File | Where-Object { $_.FullName -notmatch '\\(node_modules|dist)\\' } | ForEach-Object { $_.FullName.Substring((Get-Location).Path.Length + 1) }
```

8. Search for all VITE environment variables across src/:
```powershell
Get-ChildItem -Path admin-web\src -Recurse -File | Select-String -Pattern "import\.meta\.env" | Select-Object Path, LineNumber, Line
```

9. Search for all storage keys (localStorage, sessionStorage, cookies):
```powershell
Get-ChildItem -Path admin-web\src -Recurse -File | Select-String -Pattern "localStorage|sessionStorage|cookie" | Select-Object Path, LineNumber, Line
```

10. Search for dangerous DOM sinks (dangerouslySetInnerHTML, innerHTML, eval):
```powershell
Get-ChildItem -Path admin-web\src -Recurse -File | Select-String -Pattern "dangerouslySetInnerHTML|innerHTML|outerHTML|eval\(|document\.write"
```

11. Check open redirect and window navigation sinks:
```powershell
Get-ChildItem -Path admin-web\src -Recurse -File | Select-String -Pattern "window\.location|window\.open|<a\s+[^>]*href="
```

12. Search for iframe and postMessage usage:
```powershell
Get-ChildItem -Path admin-web\src -Recurse -File | Select-String -Pattern "postMessage|iframe"
```

13. Run dependency vulnerability audits:
```powershell
cd admin-web; npm audit; npm audit --omit=dev
```

14. Check package-lock.json for install scripts:
```powershell
Select-String -Path 'admin-web\package-lock.json' -Pattern 'hasInstallScript' -Context 3,1
```

15. Production build execution into temporary directory and bundle inspection:
```powershell
node scripts/audit2/analyze_web_build.js
```

16. Physical CSS properties scan (RTL compliance):
```powershell
Get-ChildItem -Path admin-web\src -Recurse -File | Select-String -Pattern "\b(ml-|mr-|pl-|pr-|text-left|text-right)\b" | Select-Object Path, LineNumber, Line
```

17. Hardcoded Arabic text scan in JSX:
```powershell
Get-ChildItem -Path admin-web\src -Recurse -File -Include "*.jsx" | Select-String -Pattern ">[^<{]*[\u0600-\u06FF]+[^<}]*<" | Select-Object Path, LineNumber, Line
```

18. WCAG 2.1 AA theme token contrast calculation:
```powershell
node scripts/audit2/check_contrast.js
```

19. Scan pages for states (loading, error, empty, pagination) and API calls:
```powershell
node scripts/audit2/analyze_pages_and_apis.js
```

20. Backend vs Web API endpoint parity mapping:
```powershell
node scripts/audit2/map_backend_vs_web_apis.js
```

21. 10 random claims self-check re-verification:
```powershell
node scripts/audit2/verify_claims.js
```
