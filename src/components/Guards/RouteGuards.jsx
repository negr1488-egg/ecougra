import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Skeleton, Button } from '../ui/DesignSystem';
import { ShieldAlert, Compass } from 'lucide-react';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8 space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children;
}

export function RoleGuard({ allowedRoles = ['admin', 'dev'], children }) {
  const { hasRole, loading } = useAuth();

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!hasRole(allowedRoles)) {
    return <Navigate to="/403" replace />;
  }
  return children;
}

export function ForbiddenPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/40 flex items-center justify-center text-red-400">
        <ShieldAlert size={30} />
      </div>
      <div className="eyebrow">Ошибка доступа · 403 Forbidden</div>
      <h1 className="text-3xl font-extralight text-white">Недостаточно полномочий для этого раздела</h1>
      <p className="text-xs text-[#8A93A6] max-w-md leading-relaxed">
        Этот модуль доступен только участникам с соответствующей ролью (например, Наставник, Эксперт жюри или Администратор платформы).
      </p>
      <Link to="/">
        <Button variant="gold">Вернуться на Главную</Button>
      </Link>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-16 h-16 rounded-full bg-[#FFAA00]/10 border border-[#FFAA00]/40 flex items-center justify-center text-[#FFAA00]">
        <Compass size={30} />
      </div>
      <div className="eyebrow">Координаты не найдены · 404</div>
      <h1 className="text-3xl font-extralight text-white">Такой страницы нет на карте Югры</h1>
      <p className="text-xs text-[#8A93A6] max-w-md leading-relaxed">
        Проверьте правильность ссылки или вернитесь в главный навигационный центр экосистемы «ЮГРА.НЕФТЬ».
      </p>
      <Link to="/">
        <Button variant="primary">Перейти на Главную</Button>
      </Link>
    </div>
  );
}