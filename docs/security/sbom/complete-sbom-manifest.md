# Software Bill of Materials (SBOM) Manifest

**Project**: Egypt Shop Marketplace  
**Standard**: CycloneDX v1.5 JSON Specification  
**Generated**: 2026-11-07T05:11:51.760Z  

## 1. Backend (.NET 10 / NuGet)

| Package Name | Version | Scope | License | Known Vulnerabilities |
|:-------------|:-------:|:-----:|:-------:|:---------------------:|
| `Microsoft.AspNetCore.Authentication.JwtBearer` | `10.0.12` | required | MIT | 0 (Verified via `dotnet list package --vulnerable`) |
| `Microsoft.EntityFrameworkCore.Design` | `10.0.5` | required | MIT | 0 (Verified via `dotnet list package --vulnerable`) |
| `Microsoft.EntityFrameworkCore.Relational` | `10.0.5` | required | MIT | 0 (Verified via `dotnet list package --vulnerable`) |
| `Swashbuckle.AspNetCore` | `10.2.3` | required | MIT | 0 (Verified via `dotnet list package --vulnerable`) |
| `FluentValidation` | `12.1.1` | required | Apache-2.0 | 0 (Verified via `dotnet list package --vulnerable`) |
| `FluentValidation.DependencyInjectionExtensions` | `12.1.1` | required | Apache-2.0 | 0 (Verified via `dotnet list package --vulnerable`) |
| `Microsoft.EntityFrameworkCore` | `10.0.5` | required | MIT | 0 (Verified via `dotnet list package --vulnerable`) |
| `BCrypt.Net-Next` | `4.2.0` | required | MIT | 0 (Verified via `dotnet list package --vulnerable`) |
| `Google.Apis.Auth` | `1.77.0` | required | Apache-2.0 | 0 (Verified via `dotnet list package --vulnerable`) |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | `10.0.3` | required | PostgreSQL | 0 (Verified via `dotnet list package --vulnerable`) |
| `Microsoft.IdentityModel.JsonWebTokens` | `8.19.2` | required | MIT | 0 (Verified via `dotnet list package --vulnerable`) |
| `SkiaSharp` | `3.116.1` | required | MIT | 0 (Verified via `dotnet list package --vulnerable`) |
| `Microsoft.NET.Test.Sdk` | `17.13.0` | test | MIT | 0 (Verified via `dotnet list package --vulnerable`) |
| `xunit` | `2.9.3` | test | Apache-2.0 | 0 (Verified via `dotnet list package --vulnerable`) |
| `xunit.runner.visualstudio` | `3.0.2` | test | Apache-2.0 | 0 (Verified via `dotnet list package --vulnerable`) |

## 2. Admin Web (React 19 / Vite / TailwindCSS)

| Package Name | Version | Scope | License | Known Vulnerabilities |
|:-------------|:-------:|:-----:|:-------:|:---------------------:|
| `@react-google-maps/api` | `2.20.8` | required | MIT | 0 (Verified via `npm audit`) |
| `axios` | `1.20.0` | required | MIT | 0 (Verified via `npm audit`) |
| `i18next` | `26.4.7` | required | MIT | 0 (Verified via `npm audit`) |
| `jwt-decode` | `4.0.0` | required | MIT | 0 (Verified via `npm audit`) |
| `lucide-react` | `1.58.0` | required | ISC | 0 (Verified via `npm audit`) |
| `react` | `19.3.1` | required | MIT | 0 (Verified via `npm audit`) |
| `react-dom` | `19.3.1` | required | MIT | 0 (Verified via `npm audit`) |
| `react-i18next` | `17.0.20` | required | MIT | 0 (Verified via `npm audit`) |
| `react-router-dom` | `7.18.4` | required | MIT | 0 (Verified via `npm audit`) |
| `@tailwindcss/vite` | `4.3.3` | optional | MIT | 0 (Verified via `npm audit`) |
| `@types/react` | `19.3.0` | optional | MIT | 0 (Verified via `npm audit`) |
| `@types/react-dom` | `19.3.0` | optional | MIT | 0 (Verified via `npm audit`) |
| `@vitejs/plugin-react` | `4.7.0` | optional | MIT | 0 (Verified via `npm audit`) |
| `oxlint` | `1.88.0` | optional | MIT | 0 (Verified via `npm audit`) |
| `tailwindcss` | `4.3.3` | optional | MIT | 0 (Verified via `npm audit`) |
| `vite` | `6.4.5` | optional | MIT | 0 (Verified via `npm audit`) |

## 3. Mobile (React Native / Expo SDK 58)

| Package Name | Version | Scope | License | Runtime Impact |
|:-------------|:-------:|:-----:|:-------:|:--------------:|
| `@expo/vector-icons` | `15.1.1` | required | MIT | Production Binary |
| `@react-native-async-storage/async-storage` | `2.2.0` | required | MIT | Production Binary |
| `@react-navigation/bottom-tabs` | `7.20.0` | required | MIT | Production Binary |
| `@react-navigation/native` | `7.5.0` | required | MIT | Production Binary |
| `@react-navigation/native-stack` | `7.20.0` | required | MIT | Production Binary |
| `axios` | `1.20.0` | required | MIT | Production Binary |
| `babel-preset-expo` | `58.0.23` | required | MIT | Production Binary |
| `expo` | `58.0.22` | required | MIT | Production Binary |
| `expo-auth-session` | `58.0.14` | required | MIT | Production Binary |
| `expo-crypto` | `58.0.7` | required | MIT | Production Binary |
| `expo-font` | `58.0.11` | required | MIT | Production Binary |
| `expo-image` | `58.0.17` | required | MIT | Production Binary |
| `expo-image-manipulator` | `58.0.15` | required | MIT | Production Binary |
| `expo-image-picker` | `58.0.10` | required | MIT | Production Binary |
| `expo-linear-gradient` | `58.0.3` | required | MIT | Production Binary |
| `expo-local-authentication` | `58.0.2` | required | MIT | Production Binary |
| `expo-location` | `58.0.19` | required | MIT | Production Binary |
| `expo-secure-store` | `58.0.2` | required | MIT | Production Binary |
| `expo-status-bar` | `58.0.4` | required | MIT | Production Binary |
| `expo-updates` | `58.0.20` | required | MIT | Production Binary |
| `expo-web-browser` | `58.0.6` | required | MIT | Production Binary |
| `i18next` | `26.4.2` | required | MIT | Production Binary |
| `jwt-decode` | `4.0.0` | required | MIT | Production Binary |
| `react` | `19.3.0` | required | MIT | Production Binary |
| `react-i18next` | `17.0.16` | required | MIT | Production Binary |
| `react-native` | `0.88.0` | required | MIT | Production Binary |
| `react-native-maps` | `1.29.11` | required | MIT | Production Binary |
| `react-native-safe-area-context` | `5.10.1` | required | MIT | Production Binary |
| `react-native-screens` | `4.30.0` | required | MIT | Production Binary |
| `twrnc` | `4.16.0` | required | MIT | Production Binary |
| `eslint` | `9.39.5` | optional | MIT | Build Tooling only (0 Runtime APK impact) |
| `eslint-config-expo` | `58.0.4` | optional | MIT | Build Tooling only (0 Runtime APK impact) |
