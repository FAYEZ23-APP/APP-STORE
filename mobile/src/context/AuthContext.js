import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getToken, setToken, removeToken } from '../utils/storage';
import { login as loginApi, register as registerApi, googleAuth as googleAuthApi } from '../api/authApi';
import { setOnUnauthorized } from '../api/client';
import { syncPushToken } from '../utils/notifications';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(null); // 'Buyer' or 'Seller'
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // The role claim key in .NET is typically this long URL
  const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

  const loadUserFromToken = async () => {
    try {
      const token = await getToken();
      if (token) {
        const decoded = jwtDecode(token);
        const role = decoded[ROLE_CLAIM] || decoded.role;
        const id = decoded.sub || decoded.nameid || decoded.id;
        const name = decoded.name || decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];
        const email = decoded.email || decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];

        setUserRole(role);
        setUserId(id ? String(id) : null);
        setUserName(name || null);
        setUserEmail(email || null);
        syncPushToken();
      } else {
        setUserRole(null);
        setUserId(null);
        setUserName(null);
        setUserEmail(null);
      }
    } catch (error) {
      console.error("Invalid token", error);
      setUserRole(null);
      setUserId(null);
      setUserName(null);
      setUserEmail(null);
      await removeToken();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setOnUnauthorized(() => {
      setUserRole(null);
      setUserId(null);
      setUserName(null);
      setUserEmail(null);
    });
    loadUserFromToken();
  }, []);

  const login = async (email, password) => {
    const response = await loginApi({ email, password });
    const { token } = response.data;
    await setToken(token);
    await loadUserFromToken();
  };

  const register = async (name, email, password, role, acceptedTermsAndPrivacy = true, marketingConsent = false) => {
    const response = await registerApi({
      name,
      email,
      password,
      role,
      acceptedTermsAndPrivacy,
      marketingConsent,
      policyVersion: '1.0',
    });
    const { token } = response.data;
    await setToken(token);
    await loadUserFromToken();
  };

  const loginWithGoogle = async (idToken, role = 'Buyer', acceptedTermsAndPrivacy = true, marketingConsent = false) => {
    const response = await googleAuthApi({
      idToken,
      role,
      acceptedTermsAndPrivacy,
      marketingConsent,
      policyVersion: '1.0',
    });
    const { token } = response.data;
    await setToken(token);
    await loadUserFromToken();
    return response.data;
  };

  const logout = async () => {
    await removeToken();
    setUserRole(null);
    setUserId(null);
    setUserName(null);
    setUserEmail(null);
  };

  return (
    <AuthContext.Provider
      value={{
        userRole,
        userId,
        userName,
        userEmail,
        isLoading,
        login,
        register,
        loginWithGoogle,
        logout,
        reloadUser: loadUserFromToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
