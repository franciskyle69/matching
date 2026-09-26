import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize and check current authentication on mount
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("access_token") ||
            window.localStorage.getItem("accessToken") ||
            window.localStorage.getItem("token")
          : null;

      try {
        const headers = { "Content-Type": "application/json" };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch("/api/me/", {
          credentials: "include",
          headers,
        });

        if (res.ok) {
          const userData = await res.json();
          if (isMounted) {
            setUser(userData);
          }
        } else {
          if (isMounted) {
            setUser(null);
          }
        }
      } catch (err) {
        console.warn("Auth check failed:", err);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (identifier, password) => {
    try {
      const response = await fetch("/api/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          error:
            data.error ||
            (data.errors && Object.values(data.errors).flat().join(" ")) ||
            "Login failed. Please check your credentials.",
          data,
        };
      }

      // Persist access_token and refresh_token in localStorage
      if (data.access_token) {
        window.localStorage.setItem("access_token", data.access_token);
        window.localStorage.setItem("accessToken", data.access_token);
        window.localStorage.setItem("token", data.access_token);
      }
      if (data.refresh_token) {
        window.localStorage.setItem("refresh_token", data.refresh_token);
        window.localStorage.setItem("refreshToken", data.refresh_token);
      }

      // Update user state
      if (data.user) {
        setUser(data.user);
      } else {
        try {
          const meRes = await fetch("/api/me/", {
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.access_token}`,
            },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            setUser(meData);
          }
        } catch (_) {}
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: "Network error connecting to login service. Please try again.",
      };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
      await fetch("/api/logout/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    } finally {
      // Clear all tokens from storage
      try {
        window.localStorage.removeItem("access_token");
        window.localStorage.removeItem("accessToken");
        window.localStorage.removeItem("token");
        window.localStorage.removeItem("refresh_token");
        window.localStorage.removeItem("refreshToken");
        window.localStorage.removeItem("auth_access_token");
        window.localStorage.removeItem("auth_refresh_token");
        window.sessionStorage.clear();
      } catch (_) {}

      setUser(null);

      // Redirect immediately to /login
      if (typeof window !== "undefined") {
        if (window.location.hash) {
          window.location.hash = "#signin";
        } else {
          window.location.href = "/accounts/login/";
        }
      }
    }
  }, []);

  const isAuthenticated = Boolean(
    user ||
      (typeof window !== "undefined" &&
        (window.localStorage.getItem("access_token") ||
          window.localStorage.getItem("accessToken") ||
          window.localStorage.getItem("token")))
  );

  const value = {
    user,
    setUser,
    loading,
    isAuthenticated,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // If not inside an AuthProvider, fall back to global DashboardApp.AppContext if present
    const globalCtx =
      typeof window !== "undefined" &&
      window.DashboardApp &&
      window.DashboardApp.AppContext
        ? useContext(window.DashboardApp.AppContext)
        : null;
    if (globalCtx) {
      return {
        user: globalCtx.user,
        setUser: globalCtx.setUser,
        loading: !globalCtx.authCheckDone,
        isAuthenticated: globalCtx.isAuthenticated,
        login: globalCtx.handleSignIn,
        logout: globalCtx.handleLogout,
      };
    }
    return {
      user: null,
      setUser: () => {},
      loading: false,
      isAuthenticated: false,
      login: async () => ({ success: false }),
      logout: () => {},
    };
  }
  return context;
}

export default AuthContext;
