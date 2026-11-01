# دليل أوامر التدقيق والاستكشاف (Audit Commands Inventory)

> [!NOTE]
> هذا الملف يحتوي على جميع الأوامر والسكربتات المستخدمة لاستخراج الحقائق والأدلة من الشيفرة المصدرية (Codebase) مباشرة دون افتراضات مسبقة.

---

## 1. فحص بيئة التشغيل والإصدارات (Environment & Tooling)
```powershell
# استعلام عن إصدارات الأدوات المثبتة
dotnet --version
node --version
npm --version
git --version
```

## 2. خريطة المستودع والمشاريع (Repository & Project Inventory)
```powershell
# فحص المجلدات الجذرية وحالة الروابط الرمزية (NTFS Junctions)
Get-ChildItem -Path . -Force
Get-Item admin-web | Select-Object Name, LinkType, Target

# التحقق من الملفات المتتبعة بواسطة git
git ls-files | Select-String -Pattern "csproj|package.json|slnx?"

# حصر مشاريع الدوت نت وأطر العمل المستهدفة (TargetFramework)
Get-ChildItem -Path backend -Filter *.csproj -Recurse | ForEach-Object {
    [PSCustomObject]@{
        Path = $_.FullName
        TargetFramework = (Select-String -Path $_.FullName -Pattern "<TargetFramework>(.*?)</TargetFramework>").Matches.Groups[1].Value
    }
}

# فحص بناء الواجهة الخلفية
dotnet build backend/Marketplace.slnx --no-restore
```

## 3. حصر مسارات الواجهة الخلفية (Backend Routes Inventory)
```bash
# تشغيل سكربت المسح الضوئي للمتحكمات لاستخراج الـ 89 مساراً بالكامل مع الصلاحيات والأعلام
node scripts/audit/scan-routes.js
```

## 4. حصر جداول قاعدة البيانات من لقطة EF Core (DB Tables Inventory)
```powershell
# استخراج أسماء الجداول الفعلية من AppDbContextModelSnapshot
Select-String -Path backend/Marketplace.Infrastructure/Data/Migrations/AppDbContextModelSnapshot.cs -Pattern 'b\.ToTable\("([^"]+)"' |
    ForEach-Object { $_.Matches.Groups[1].Value } |
    Sort-Object -Unique
```

## 5. حصر هجرات قاعدة البيانات (EF Core Migrations Inventory)
```powershell
# حصر ملفات الهجرة المسجلة في Infrastructure
Get-ChildItem -Path backend/Marketplace.Infrastructure/Data/Migrations -Filter *.cs |
    Where-Object { -not $_.Name.Contains("Designer") -and -not $_.Name.Contains("Snapshot") } |
    Select-Object Name, Length, LastWriteTime
```

## 6. حصر أعلام الميزات والإعدادات (Feature Flags & Settings Inventory)
```powershell
# فحص الإعدادات وأعلام الميزات في appsettings.json
Get-Content backend/Marketplace.API/appsettings.json

# حصر استخدام سمة [RequireFeature] في المتحكمات
Select-String -Path backend/Marketplace.API/Controllers/*.cs -Pattern 'RequireFeature'
```

## 7. حصر شاشات الموبايل والملاحة (Mobile Screens Inventory)
```powershell
# فحص شاشات الموبايل وهياكل الملاحة (Navigators)
Get-Content mobile/src/navigation/AppNavigator.js
Get-Content mobile/src/navigation/BuyerTabs.js
Get-Content mobile/src/navigation/SellerTabs.js
Get-Content mobile/src/navigation/AdminTabs.js
```

## 8. حصر صفحات الويب والملاحة (Admin Web Pages Inventory)
```powershell
# فحص مسارات وصفحات موقع الويب
Get-Content admin-web/src/App.jsx
```

## 9. التحقق من قاعدة بيانات الاختبار (TEST_DB Safety Check)
```powershell
# التحقق من أن قاعدة البيانات تنتهي بـ _test بدون كشف كلمة المرور
$db = $env:TEST_DB
if ($db -match 'Database=([^;]+)') { $dbName = $matches[1] }
elseif ($db -match '/([^/?]+)(\?|$)') { $dbName = $matches[1] }
else { $dbName = "UNKNOWN" }
[PSCustomObject]@{ DatabaseName = $dbName; EndsWithTest = $dbName.EndsWith("_test") }
```

## 10. تشغيل حزمة الاختبارات الشاملة (Test Harness Execution)
```powershell
# تشغيل جميع أجنحة الاختبار المعتمدة وإعادة توليد tests/RESULTS.md
powershell -ExecutionPolicy Bypass -File scripts/run-all-tests.ps1
```
