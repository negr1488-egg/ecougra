import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider, Skeleton } from './components/ui/DesignSystem';
import { ProtectedRoute, RoleGuard, ForbiddenPage, NotFoundPage } from './components/Guards/RouteGuards';
import Header from './components/Layout/Header';

// Lazy-load всех маршрутов со скелетонами при загрузке
const AuthPage = lazy(() => import('./pages/AuthPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LearnPage = lazy(() => import('./pages/LearnPage'));
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const GamificationPage = lazy(() => import('./pages/GamificationPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false
    }
  }
});

function AppShell() {
  return (
    <ProtectedRoute>
      <Header>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <Outlet />
        </Suspense>
      </Header>
    </ProtectedRoute>
  );
}

const router = createBrowserRouter([
  {
    path: '/auth',
    element: (
      <Suspense fallback={<Skeleton className="h-screen w-full" />}>
        <AuthPage />
      </Suspense>
    )
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'learn', element: <LearnPage /> },
      { path: 'activities', element: <ActivitiesPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'gamification', element: <GamificationPage /> },
      { path: 'profile/:username?', element: <ProfilePage /> },
      {
        path: 'admin',
        element: (
          <RoleGuard allowedRoles={['admin', 'dev']}>
            <AdminPage />
          </RoleGuard>
        )
      },
      { path: '403', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> }
    ]
  }
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}