import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, uploadFileToStorage } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Avatar, Badge, Skeleton, useToast } from '../components/ui/DesignSystem';
import { FileDown, UserCheck, MessageSquare, Lock, Clock, LogOut } from 'lucide-react';

export default function ProfilePage() {
  const { username: routeUsername } = useParams();
  const { user, profile: myProfile, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mentorInput, setMentorInput] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const cleanRoute = (routeUsername || '').replace('@', '').trim().toLowerCase();
  const isOwnProfile = !routeUsername || (myProfile?.username && cleanRoute === myProfile.username.replace('@', '').toLowerCase());

  const { data: profileData, isLoading, refetch } = useQuery({
    queryKey: ['profile_view', routeUsername, user?.id, myProfile?.username],
    enabled: Boolean(user?.id || routeUsername),
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*, organizations(name, type, city), user_roles(roles(name))');

      // Если в URL нет имени, ищем СТРОГО по ID текущего пользователя
      if (!routeUsername && user?.id) {
        query = query.eq('id', user.id);
      } else {
        const rawSearch = cleanRoute;
        query = query.or(`username.ilike.@${rawSearch},username.ilike.${rawSearch}`);
      }

      const { data: prof, error } = await query.maybeSingle();

      if (error || !prof) return null;

      const [logsRes, mentorsRes] = await Promise.all([
        supabase
          .from('activity_log')
          .select('*')
          .eq('user_id', prof.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('mentor_links')
          .select('*, student:profiles!mentor_links_student_id_fkey(username, full_name), mentor:profiles!mentor_links_mentor_id_fkey(username, full_name)')
          .or(`student_id.eq.${prof.id},mentor_id.eq.${prof.id}`)
      ]);

      return {
        prof,
        roles: (prof.user_roles || []).map((r) => r.roles?.name).filter(Boolean),
        logs: logsRes.data || [],
        mentorLinks: mentorsRes.data || []
      };
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (patch) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_view'] });
      refreshProfile();
      setIsEditing(false);
      toast('Настройки профиля сохранены!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast('Загрузка аватара в хранилище...', 'info');
      const url = await uploadFileToStorage('avatars', user.id, file);
      updateProfileMutation.mutate({ avatar_url: url });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const requestMentorMutation = useMutation({
    mutationFn: async (identifier) => {
      const clean = identifier.replace('@', '').trim().toLowerCase();
      const { data: mentorProf } = await supabase
        .from('profiles')
        .select('id, username')
        .or(`username.ilike.@${clean},username.ilike.${clean}`)
        .maybeSingle();

      if (!mentorProf) throw new Error('Наставник с таким @username не найден');

      const { error } = await supabase.from('mentor_links').insert([{
        student_id: user.id,
        mentor_id: mentorProf.id,
        status: 'pending'
      }]);
      if (error) throw error;

      await supabase.from('notifications').insert([{
        user_id: mentorProf.id,
        type: 'mentor_request',
        payload: { preview: `Запрос на наставничество от ${myProfile?.username || 'пользователя'}` }
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_view'] });
      setMentorInput('');
      toast('Запрос наставнику успешно отправлен!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  const confirmMentorLink = async (linkId, status) => {
    await supabase.from('mentor_links').update({ status }).eq('id', linkId);
    queryClient.invalidateQueries({ queryKey: ['profile_view'] });
    toast(`Статус наставничества обновлен: ${status}`, 'success');
  };

  if (isLoading) return <Skeleton className="h-80 w-full" />;

  if (!profileData?.prof) {
    return (
      <Card className="p-8 text-center space-y-4 font-mono text-xs text-[#8A93A6]">
        <div className="text-white text-base">Профиль пользователя не найден в базе данных</div>
        <p>Возможно, вы вошли под новой учётной записью, для которой ещё не создана карточка исследователя.</p>
        <div className="flex justify-center gap-3 pt-2">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Повторить запрос
          </Button>
          <Button size="sm" variant="danger" onClick={() => signOut()}>
            <LogOut size={13} /> Выйти и войти заново
          </Button>
        </div>
      </Card>
    );
  }

  const { prof, roles, logs, mentorLinks } = profileData;
  const isPrivateAndHidden = !isOwnProfile && prof.privacy?.show_profile === 'private';

  if (isPrivateAndHidden) {
    return (
      <Card className="p-12 text-center space-y-4">
        <Lock size={32} className="mx-auto text-[#FFAA00]" />
        <h2 className="text-xl font-light text-white">Приватный профиль ({prof.username})</h2>
        <p className="text-xs text-[#8A93A6]">
          Пользователь ограничил публичный просмотр своей страницы в настройках приватности.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8 print:bg-white print:text-black">
      <Card className="p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar src={prof.avatar_url} username={prof.username} status={prof.status} size="lg" />
              {isOwnProfile && (
                <label className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-[#FFAA00] text-[#050810] font-mono text-[9px] font-bold cursor-pointer hover:bg-[#FFC857] transition-colors">
                  ФОТО
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-base font-bold text-[#FFAA00]">{prof.username}</span>
                {(roles.length ? roles : ['student']).map((r) => (
                  <Badge key={r} color={r === 'admin' || r === 'dev' ? 'red' : r === 'jury' ? 'gold' : 'emerald'}>
                    {r}
                  </Badge>
                ))}
              </div>
              <h1 className="text-2xl font-light text-white">{prof.full_name}</h1>
              <div className="text-xs text-[#8A93A6]">
                {prof.organizations?.name || 'ХМАО — Югра'} · Опыт: <strong className="text-[#34D399] font-mono">{prof.xp || 100} XP</strong> · Streak: 🔥 {prof.streak_days || 1} дн.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            {isOwnProfile ? (
              <>
                <select
                  value={prof.status || 'online'}
                  onChange={(e) => updateProfileMutation.mutate({ status: e.target.value })}
                  className="bg-[#050810] border border-white/15 px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-[#FFAA00]"
                >
                  <option value="online">🟢 В сети</option>
                  <option value="away">🟡 Отошёл</option>
                  <option value="dnd">🔴 Не беспокоить</option>
                </select>
                <Button variant="outline" size="sm" onClick={() => { setEditBio(prof.bio || ''); setIsEditing(!isEditing); }}>
                  {isEditing ? 'Закрыть' : 'Редактировать'}
                </Button>
                <Button variant="gold" size="sm" onClick={() => window.print()}>
                  <FileDown size={14} /> В PDF
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => navigate('/chat')}>
                  <MessageSquare size={14} /> Написать
                </Button>
                <Button size="sm" variant="outline" onClick={() => requestMentorMutation.mutate(prof.username)}>
                  <UserCheck size={14} /> Наставник
                </Button>
              </>
            )}
          </div>
        </div>

        <p className="mt-5 text-xs text-zinc-300 border-l-2 border-[#00C853] pl-3 leading-relaxed">
          {prof.bio || 'Исследователь экологических и производственных технологий ХМАО-Югры.'}
        </p>

        {isOwnProfile && isEditing && (
          <div className="mt-6 pt-6 border-t border-white/10 space-y-4 print:hidden">
            <Input label="О себе (Bio)" value={editBio} onChange={(e) => setEditBio(e.target.value)} />
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="font-mono text-[10px] uppercase text-[#8A93A6]">Приватность профиля:</label>
              <select
                value={prof.privacy?.show_profile || 'public'}
                onChange={(e) =>
                  updateProfileMutation.mutate({
                    bio: editBio,
                    privacy: { ...prof.privacy, show_profile: e.target.value }
                  })
                }
                className="bg-[#050810] border border-white/15 px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="public">Публичный (виден всем участникам)</option>
                <option value="private">Приватный (скрыт от общего доступа)</option>
              </select>
              <Button size="sm" onClick={() => updateProfileMutation.mutate({ bio: editBio })}>
                Сохранить изменения
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5 space-y-4">
          <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00]">
            Система наставничества
          </div>
          {isOwnProfile && (
            <div className="flex gap-2">
              <input
                type="text"
                value={mentorInput}
                onChange={(e) => setMentorInput(e.target.value)}
                placeholder="Никнейм наставника (@username)..."
                className="flex-1 bg-[#050810] border border-white/10 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FFAA00]"
              />
              <Button size="sm" onClick={() => requestMentorMutation.mutate(mentorInput)}>
                Привязать
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {mentorLinks.length === 0 ? (
              <div className="text-xs text-[#8A93A6] font-mono py-4">Активных связей наставничества нет.</div>
            ) : (
              mentorLinks.map((lnk) => (
                <div key={lnk.id} className="p-3 border border-white/10 bg-[#050810] flex items-center justify-between text-xs">
                  <div>
                    <div className="font-mono text-[#FFAA00]">
                      {lnk.student?.username} ↔ {lnk.mentor?.username}
                    </div>
                    <div className="text-[10px] text-[#8A93A6]">Статус заявки: {lnk.status}</div>
                  </div>
                  {isOwnProfile && lnk.mentor_id === user?.id && lnk.status === 'pending' && (
                    <Button size="sm" onClick={() => confirmMentorLink(lnk.id, 'active')}>
                      Подтвердить
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="lg:col-span-7 space-y-4">
          <div className="font-mono text-xs uppercase tracking-widest text-[#34D399] flex items-center gap-2">
            <Clock size={14} /> Журнал активности исследователя
          </div>
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <div className="text-xs text-[#8A93A6] font-mono py-4">Журнал активности пуст.</div>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="p-3 border-l-2 border-[#00C853] bg-[#050810] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-white font-medium">{l.action}</span>
                    <span className="text-[#8A93A6] ml-2">({l.entity})</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#4A5464]">
                    {new Date(l.created_at).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}