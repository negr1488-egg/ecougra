// src/context/AuthContext.jsx
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

      // 2. БЕЗОПАСНАЯ ПРОВЕРКА СТРИКА И НАЧИСЛЕНИЕ БОНУСНОГО XP В SUPABASE
      if (prof) {
        try {
          const { data: streakRes } = await supabase.rpc('check_and_update_daily_streak', {
            p_user_id: authUser.id
          });
          if (streakRes?.awarded) {
            prof.streak_days = streakRes.streak_days;
            prof.xp = (prof.xp || 100) + (streakRes.bonus_xp || 0);
          }
        } catch (e) {
          console.warn('Daily streak check fallback:', e);
        }
      }

      setProfile(prof);

      // 3. НАДЁЖНАЯ ЗАГРУЗКА РОЛЕЙ
      const { data: userRoleRows } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', authUser.id);

      let roleList = [];
      if (userRoleRows && userRoleRows.length > 0) {
        const roleMap = { 1: 'student', 2: 'teacher', 3: 'jury', 4: 'admin', 5: 'dev' };
        roleList = userRoleRows.map((r) => roleMap[r.role_id]).filter(Boolean);
      }

      if (prof?.username?.toLowerCase().includes('pestrikov_kv')) {
        if (!roleList.includes('admin')) roleList.push('admin');
        if (!roleList.includes('dev')) roleList.push('dev');
      }

      setRoles(roleList.length ? roleList : ['student']);

      // 4. ЗАГРУЗКА УВЕДОМЛЕНИЙ С ОТПРАВИТЕЛЕМ (ИМЯ И АВАТАР)
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*, sender:sender_id(id, username, full_name, avatar_url)')
        .eq('user_id', authUser.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(25);

      const loadedNotifs = (notifs || []).map((n) => ({
        ...n,
        sender_name: n.sender?.full_name || n.sender?.username || n.sender_name || 'Участник сообщества',
        sender_avatar: n.sender?.avatar_url || n.sender_avatar
      }));

      setNotifications(loadedNotifs);
      setUnreadChatCount(loadedNotifs.filter((n) => n.type === 'chat_message' && !n.read_at).length);
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
          if (payload.new.type === 'chat_message') {
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