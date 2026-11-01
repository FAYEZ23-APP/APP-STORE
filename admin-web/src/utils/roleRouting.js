/**
 * Role-aware routing & shopping visibility helpers for admin-web.
 *
 * Strictly isolates Seller and Admin sessions from buyer shopping / storefront surfaces,
 * matching the mobile AppNavigator and backend [Authorize(Roles = "Buyer")] boundaries.
 */

export function getRoleHomePath(role) {
  if (role === 'Seller') return '/seller/dashboard';
  if (role === 'Admin') return '/admin';
  return '/';
}

export function isShoppingAllowedForRole(isAuthenticated, role) {
  if (!isAuthenticated) return true;
  return role === 'Buyer';
}

export function getPostAuthRedirect(role, rawFrom) {
  const fromPath = rawFrom?.pathname
    ? `${rawFrom.pathname}${rawFrom.search || ''}`
    : (typeof rawFrom === 'string' ? rawFrom : null);

  if (role === 'Seller') {
    if (fromPath && (fromPath.startsWith('/seller') || fromPath.startsWith('/profile'))) {
      return fromPath;
    }
    return '/seller/dashboard';
  }

  if (role === 'Admin') {
    if (fromPath && (fromPath.startsWith('/admin') || fromPath.startsWith('/profile'))) {
      return fromPath;
    }
    return '/admin';
  }

  if (fromPath && !fromPath.startsWith('/seller') && !fromPath.startsWith('/admin')) {
    return fromPath;
  }

  return '/';
}

