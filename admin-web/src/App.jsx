import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import AuthHeader from './components/AuthHeader';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { getRoleHomePath, isShoppingAllowedForRole } from './utils/roleRouting';

// Lazy-loaded Dev tool: completely dropped by Rollup in production builds
const DevCarrierDrawer = import.meta.env.DEV
  ? React.lazy(() => import('./components/DevCarrierDrawer'))
  : null;

// Buyer Pages (Route-level Code Splitting)
const HomePage = React.lazy(() => import('./pages/HomePage'));
const CategoriesPage = React.lazy(() => import('./pages/CategoriesPage'));
const ProductDetailsPage = React.lazy(() => import('./pages/ProductDetailsPage'));
const SellerStorePage = React.lazy(() => import('./pages/SellerStorePage'));
const SearchResultsPage = React.lazy(() => import('./pages/SearchResultsPage'));
const CartPage = React.lazy(() => import('./pages/CartPage'));
const CheckoutPage = React.lazy(() => import('./pages/CheckoutPage'));
const BuyerOrdersPage = React.lazy(() => import('./pages/BuyerOrdersPage'));
const WishlistPage = React.lazy(() => import('./pages/WishlistPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage'));
const VerifyPage = React.lazy(() => import('./pages/VerifyPage'));

// Seller Pages (Route-level Code Splitting)
const SellerLayout = React.lazy(() => import('./pages/seller/SellerLayout'));
const SellerDashboardPage = React.lazy(() => import('./pages/seller/SellerDashboardPage'));
const SellerProductsPage = React.lazy(() => import('./pages/seller/SellerProductsPage'));
const SellerShipmentsPage = React.lazy(() => import('./pages/seller/SellerShipmentsPage'));
const SellerReturnsPage = React.lazy(() => import('./pages/seller/SellerReturnsPage'));
const SellerCouponsPage = React.lazy(() => import('./pages/seller/SellerCouponsPage'));
const SellerWalletPage = React.lazy(() => import('./pages/seller/SellerWalletPage'));
const SellerProfilePage = React.lazy(() => import('./pages/seller/SellerProfilePage'));

// Admin Pages (Route-level Code Splitting)
const AdminPortalPage = React.lazy(() => import('./pages/admin/AdminPortalPage'));

function PageLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[50vh] flex flex-col items-center justify-center gap-3 p-6 select-none"
    >
      <div className="w-10 h-10 border-4 border-[#C8102E] border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-bold text-slate-500 tracking-wide">
        جاري التحميل...
      </span>
    </div>
  );
}

// Gating flag: isolates non-admin storefront/buyer/seller routes from the hardened admin perimeter.
// When disabled (e.g. VITE_STOREFRONT_WEB_ENABLED=false), admin-web serves strictly as an admin back-office portal.
const isStorefrontEnabled = import.meta.env.VITE_STOREFRONT_WEB_ENABLED !== 'false';

function StorefrontRoute({ children }) {
  const { isAuthenticated, userRole, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isShoppingAllowedForRole(isAuthenticated, userRole)) {
    return <Navigate to={getRoleHomePath(userRole)} replace />;
  }
  return children;
}

export default function App() {
  const location = useLocation();
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password', '/verify'].includes(location.pathname);

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isAuthPage ? 'luxury-stage-bg text-[#F8F7F4]' : 'bg-[#FAF8F5] text-[#1F2329]'
      }`}
    >
      {isAuthPage ? (
        <AuthHeader />
      ) : (
        <Navbar isStorefrontEnabled={isStorefrontEnabled} />
      )}

      <main
        className={`flex-1 w-full mx-auto ${
          isAuthPage
            ? 'max-w-7xl px-4 py-4 sm:py-6 flex items-center justify-center overflow-x-clip'
            : 'max-w-[1440px] w-[calc(100%-48px)] py-6'
        }`}
      >
        <React.Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            {isStorefrontEnabled ? (
            <>
              {/* Public Storefront Routes (Guests & Buyers only; Sellers/Admins redirect to their portals) */}
              <Route path="/" element={<StorefrontRoute><HomePage /></StorefrontRoute>} />
              <Route path="/categories" element={<StorefrontRoute><CategoriesPage /></StorefrontRoute>} />
              <Route path="/search" element={<StorefrontRoute><SearchResultsPage /></StorefrontRoute>} />
              <Route path="/product/:id" element={<StorefrontRoute><ProductDetailsPage /></StorefrontRoute>} />
              <Route path="/store/:sellerId" element={<StorefrontRoute><SellerStorePage /></StorefrontRoute>} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify" element={<VerifyPage />} />

              {/* Protected Buyer Routes */}
              <Route
                path="/cart"
                element={
                  <ProtectedRoute allowedRoles={['Buyer']} redirectTo="/register">
                    <CartPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/checkout"
                element={
                  <ProtectedRoute allowedRoles={['Buyer']}>
                    <CheckoutPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute allowedRoles={['Buyer']}>
                    <BuyerOrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/wishlist"
                element={
                  <ProtectedRoute allowedRoles={['Buyer']}>
                    <WishlistPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Seller Routes */}
              <Route
                path="/seller"
                element={
                  <ProtectedRoute allowedRoles={['Seller']}>
                    <SellerLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/seller/dashboard" replace />} />
                <Route path="dashboard" element={<SellerDashboardPage />} />
                <Route path="products" element={<SellerProductsPage />} />
                <Route path="shipments" element={<SellerShipmentsPage />} />
                <Route path="returns" element={<SellerReturnsPage />} />
                <Route path="coupons" element={<SellerCouponsPage />} />
                <Route path="wallet" element={<SellerWalletPage />} />
                <Route path="profile" element={<SellerProfilePage />} />
              </Route>
            </>
          ) : (
            <>
              {/* When storefront is disabled, public root and auth redirect directly to admin */}
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="/login" element={<LoginPage />} />
            </>
          )}

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AdminPortalPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to={isStorefrontEnabled ? "/" : "/admin"} replace />} />
        </Routes>
      </React.Suspense>
      </main>

      <Footer />

      {/* Dev-Mode Carrier Simulator Drawer (completely dropped in production) */}
      {import.meta.env.DEV && DevCarrierDrawer && !isAuthPage && (
        <React.Suspense fallback={null}>
          <DevCarrierDrawer />
        </React.Suspense>
      )}
    </div>
  );
}
