import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Защита от неавторизованных пользователей (редирект на страницу входа)
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-screen bg-[#050810]" />; // экран загрузки

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

// Защита админ-панели (проверка ролей)
export function RoleRoute({ allowedRoles }) {
  const { hasRole, loading } = useAuth();

  if (loading) return <div className="min-h-screen bg-[#050810]" />; // экран загрузки

  // Если у пользователя нет нужной роли (например, admin или dev), отправляем его на главную
  if (!hasRole(allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}