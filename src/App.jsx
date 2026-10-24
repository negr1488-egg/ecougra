import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/DesignSystem';
import { ProtectedRoute, RoleRoute } from './components/Guards/RouteGuards';
import AppShell from './components/Layout/AppShell';

import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import LearnPage from './pages/LearnPage';
import ActivitiesPage from './pages/ActivitiesPage';
import ChatPage from './pages/ChatPage';
import GamificationPage from './pages/GamificationPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import LegalPage from './pages/LegalPage';

// Настройка кэширования запросов
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false }
  }
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Публичные роуты */}
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/legal" element={<LegalPage />} />

              {/* Защищённые роуты (нужна авторизация) */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/learn" element={<LearnPage />} />
                  <Route path="/activities" element={<ActivitiesPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/gamification" element={<GamificationPage />} />
                  
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/profile/:username" element={<ProfilePage />} />

                  {/* Роуты только для Администраторов и Разработчиков */}
                  <Route element={<RoleRoute allowedRoles={['admin', 'dev']} />}>
                    <Route path="/admin" element={<AdminPage />} />
                  </Route>
                </Route>
              </Route>

              {/* Редирект неизвестных адресов на главную */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}