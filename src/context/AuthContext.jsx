// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, logActivityAndAwardXp } from '../lib/supabaseClient';

const AuthContext = createContext(null);

// Функция удаления дубликатов уведомлений
function deduplicateNotifications(list) {
  const seenIds = new Set();
  const seenMsgKeys = new Set();
  const result = [];

  for (const n of list) {
    if (!n || !n.id) continue;
    if (seenIds.has(n.id)) continue;

    // Если уведомление привязано к конкретному сообщению или событию за ту же секунду
    const msgId = n.payload?.message_id;
    const dedupKey = msgId
      ? `msg_${msgId}`
      : `${n.type}_${n.sender_id || ''}_${n.payload?.preview || ''}_${(n.created_at || '').slice(0, 19)}`;

    if (seenMsgKeys.has(dedupKey)) continue;

    seenIds.add(n.id);
    seenMsgKeys.add(dedupKey);
    result.push(n);
  }
  return result;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const enrichNotificationsWithSenders = useCallback(async (rawNotifs) => {
    if (!rawNotifs || rawNotifs.length === 0) return [];
    const { data: allProfs } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url');

    const profMap = Object.fromEntries((allProfs || []).map((p) => [p.id, p]));

    const enriched = rawNotifs.map((n) => {
      const senderId = n.sender_id || n.payload?.sender_id || n.payload?.author_id;
      const senderObj = senderId ? profMap[senderId] : null;
      const resolvedName =
        senderObj?.full_name ||
        senderObj?.username ||
        n.sender_name ||
        n.payload?.sender_name ||
        n.payload?.username ||
        'Система Югра.Нефть';
      const resolvedAvatar =
        senderObj?.avatar_url || n.sender_avatar || n.payload?.sender_avatar || null;

      return {
        ...n,
        sender_name: resolvedName,
        sender_username: senderObj?.username || null,
        sender_avatar: resolvedAvatar
      };
    });

    return deduplicateNotifications(enriched);
  }, []);

  const fetchUserProfileAndRoles = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      setRoles([]);
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      // 1. Извлекаем профиль
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

      // 2. Ежедневный стрик и бонусный XP
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
          console.warn('Daily streak fallback:', e);
        }
      }

      setProfile(prof);

      // 3. Роли
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

      // 4. Загружаем уведомления без дублей
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(30);

      const enriched = await enrichNotificationsWithSenders(notifs || []);
      setNotifications(enriched);
      setUnreadChatCount(
        enriched.filter((n) => (n.type === 'chat_message' || n.type === 'new_message') && !n.read_at).length
      );
    } catch (e) {
      console.error('Ошибка инициализации профиля:', e);
    } finally {
      setLoading(false);
    }
  }, [enrichNotificationsWithSenders]);

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

  // Realtime-подписка на новые уведомления со строгой защитой от дублирования
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`notifs_unique_${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
        async (payload) => {
          const [enrichedNew] = await enrichNotificationsWithSenders([payload.new]);
          const incoming = enrichedNew || payload.new;

          setNotifications((prev) => {
            if (prev.some((item) => item.id === incoming.id)) return prev;
            return deduplicateNotifications([incoming, ...prev]);
          });

          if (incoming.type === 'chat_message' || incoming.type === 'new_message') {
            setUnreadChatCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, enrichNotificationsWithSenders]);

  const markNotificationsRead = async () => {
    if (!session?.user?.id) return;
    const now = new Date().toISOString();
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', session.user.id)
      .is('read_at', null);

    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
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