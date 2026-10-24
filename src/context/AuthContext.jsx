import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, logActivityAndAwardXp } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]); // ['student', 'jury', 'admin', ...]
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
      // 1. Загружаем профиль с организацией
      let { data: prof } = await supabase
        .from('profiles')
        .select('*, organizations(id, name, type, city)')
        .eq('id', authUser.id)
        .single();

      // Если профиль ещё не создан триггером — создаём
      if (!prof) {
        const fallbackUsername = authUser.user_metadata?.username || `@user_${authUser.id.slice(0, 6)}`;
        const { data: inserted } = await supabase
          .from('profiles')
          .insert([{
            id: authUser.id,
            username: fallbackUsername.startsWith('@') ? fallbackUsername : `@${fallbackUsername}`,
            full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0]
          }])
          .select('*, organizations(id, name, type, city)')
          .single();
        prof = inserted;
      }

      // 2. Проверка ежедневного Streak (огонёк входов)
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
            .single();
          if (updatedProf) prof = updatedProf;
        }
      }

      setProfile(prof);

      // 3. Загружаем роли многие-ко-многим
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', authUser.id);

      const roleList = (roleRows || []).map((r) => r.roles?.name).filter(Boolean);
      setRoles(roleList.length ? roleList : ['student']);

      // 4. Загружаем уведомления
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifications(notifs || []);
      setUnreadChatCount((notifs || []).filter((n) => n.type === 'new_message' && !n.read_at).length);
    } catch (e) {
      console.error('Auth load error:', e);
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

  // Realtime подписка на уведомления
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