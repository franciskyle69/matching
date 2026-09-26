import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * ProtectedRoute component:
 * - Checks authentication state from AuthContext
 * - If user is unauthenticated, redirects to `/login` (NEVER `/signup`)
 * - Preserves requested destination in location.state for post-login redirect
 */
export default function ProtectedRoute({ children, fallbackRoute = "/login" }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className="session-loading"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <div className="spinner">Loading session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // CRITICAL: Unauthenticated users are redirected strictly to /login, NEVER /signup
    return <Navigate to={fallbackRoute} state={{ from: location }} replace />;
  }

  return children;
}
