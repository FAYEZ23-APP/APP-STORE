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

// Buyer Pages
import HomePage from './pages/HomePage';
import CategoriesPage from './pages/CategoriesPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import SellerStorePage from './pages/SellerStorePage';
import SearchResultsPage from './pages/SearchResultsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import BuyerOrdersPage from './pages/BuyerOrdersPage';
import WishlistPage from './pages/WishlistPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyPage from './pages/VerifyPage';

// Seller Pages
import SellerLayout from './pages/seller/SellerLayout';
import SellerDashboardPage from './pages/seller/SellerDashboardPage';
import SellerProductsPage from './pages/seller/SellerProductsPage';
import SellerShipmentsPage from './pages/seller/SellerShipmentsPage';
import SellerReturnsPage from './pages/seller/SellerReturnsPage';
import SellerCouponsPage from './pages/seller/SellerCouponsPage';
import SellerWalletPage from './pages/seller/SellerWalletPage';
import SellerProfilePage from './pages/seller/SellerProfilePage';

// Admin Pages
import AdminPortalPage from './pages/admin/AdminPortalPage';

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
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1F2329]">
      {isAuthPage ? (
        <AuthHeader />
      ) : (
        <Navbar isStorefrontEnabled={isStorefrontEnabled} />
      )}

      <main className="flex-1 max-w-[1440px] w-[calc(100%-48px)] mx-auto py-6">
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
