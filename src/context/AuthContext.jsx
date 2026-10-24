import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, logActivityAndAwardXp } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUserProfileAndRoles = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      setRoles([]);
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      // 1. Извлекаем профиль вместе с организацией
      let { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('*, organizations(id, name, type, city)')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!prof || profError) {
        const rawUsername =
          authUser.user_metadata?.username ||
          `@user_${authUser.id.replace(/-/g, '').slice(0, 6)}`;
        const formattedUsername = rawUsername.startsWith('@')
          ? rawUsername
          : `@${rawUsername}`;
        const rawFullName =
          authUser.user_metadata?.full_name ||
          authUser.email?.split('@')[0] ||
          'Исследователь';

        const { data: createdProf } = await supabase
          .from('profiles')
          .upsert([
            {
              id: authUser.id,
              username: formattedUsername,
              full_name: rawFullName,
              xp: 100,
              streak_days: 1
            }
          ])
          .select('*, organizations(id, name, type, city)')
          .maybeSingle();

        prof = createdProf || {
          id: authUser.id,
          username: formattedUsername,
          full_name: rawFullName,
          xp: 100,
          streak_days: 1
        };
      }

      // 2. Расчёт ежедневной серии входов (Streak)
      if (prof) {
        const today = new Date().toISOString().slice(0, 10);
        if (prof.last_active_date !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          const newStreak = prof.last_active_date === yesterday ? (prof.streak_days || 1) + 1 : 1;
          const { data: updatedProf } = await supabase
            .from('profiles')
            .update({
              streak_days: newStreak,
              last_active_date: today,
              xp: (prof.xp || 100) + 15
            })
            .eq('id', authUser.id)
            .select('*, organizations(id, name, type, city)')
            .maybeSingle();

          if (updatedProf) prof = updatedProf;
        }
      }

      setProfile(prof);

      // 3. НАДЁЖНАЯ ЗАГРУЗКА РОЛЕЙ БЕЗ ЛОМАЮЩИХСЯ JOIN-ОВ
      const { data: userRoleRows } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', authUser.id);

      let roleList = [];
      if (userRoleRows && userRoleRows.length > 0) {
        const roleMap = { 1: 'student', 2: 'teacher', 3: 'jury', 4: 'admin', 5: 'dev' };
        roleList = userRoleRows.map((r) => roleMap[r.role_id]).filter(Boolean);
      }

      // Страховка: если это твой аккаунт, всегда добавляем admin и dev права
      if (prof?.username?.toLowerCase().includes('pestrikov_kv')) {
        if (!roleList.includes('admin')) roleList.push('admin');
        if (!roleList.includes('dev')) roleList.push('dev');
      }

      setRoles(roleList.length ? roleList : ['student']);

      // 4. Загружаем список уведомлений
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const loadedNotifs = notifs || [];
      setNotifications(loadedNotifs);
      setUnreadChatCount(loadedNotifs.filter((n) => n.type === 'new_message' && !n.read_at).length);
    } catch (e) {
      console.error('Ошибка инициализации профиля:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      fetchUserProfileAndRoles(s?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      fetchUserProfileAndRoles(s?.user);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfileAndRoles]);

  // Realtime-подписка на новые уведомления
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`notifs_${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
          if (payload.new.type === 'new_message') {
            setUnreadChatCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session?.user?.id]);

  const markNotificationsRead = async () => {
    if (!session?.user?.id) return;
    const now = new Date().toISOString();
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', session.user.id)
      .is('read_at', null);

    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
    setUnreadChatCount(0);
  };

  const hasRole = (checkRoles) => {
    // Жесткая страховка для твоего аккаунта
    if (profile?.username?.toLowerCase().includes('pestrikov_kv')) return true;

    const arr = Array.isArray(checkRoles) ? checkRoles : [checkRoles];
    return arr.some((r) => roles.includes(r));
  };

  const signOut = async () => {
    if (session?.user?.id) {
      await logActivityAndAwardXp(session.user.id, { action: 'logout', entity: 'auth' });
    }
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        profile,
        roles,
        hasRole,
        loading,
        notifications,
        unreadChatCount,
        setUnreadChatCount,
        markNotificationsRead,
        refreshProfile: () => fetchUserProfileAndRoles(session?.user),
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);