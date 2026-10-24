import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, uploadFileToStorage } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getLevelInfo } from '../data/levelsData';
import UserWall from '../components/Wall/UserWall';
import { Card, Button, Input, Avatar, Badge, Skeleton, useToast } from '../components/ui/DesignSystem';
import {
  FileDown,
  UserCheck,
  MessageSquare,
  Lock,
  Clock,
  LogOut,
  MapPin,
  Briefcase,
  Camera,
  FolderPlus,
  Award,
  Flame
} from 'lucide-react';

export default function ProfilePage() {
  const { username: routeUsername } = useParams();
  const { user, profile: myProfile, roles: myRoles, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('wall'); // wall | projects | achievements | activity | settings
  const cleanRoute = (routeUsername || '').replace('@', '').trim().toLowerCase();
  const cleanMy = (myProfile?.username || '').replace('@', '').trim().toLowerCase();
  const isOwnProfile = !routeUsername || (cleanMy && cleanRoute === cleanMy);

  const { data: profileData, isLoading, refetch } = useQuery({
    queryKey: ['profile_full_v3', routeUsername, user?.id, myProfile?.id],
    enabled: Boolean(user?.id || routeUsername || myProfile?.id),
    queryFn: async () => {
      let prof = null;
      if (isOwnProfile && user?.id) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        prof = data || myProfile;
      } else if (cleanRoute) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.@${cleanRoute},username.ilike.${cleanRoute}`)
          .maybeSingle();
        prof = data;
      }

      if (!prof && isOwnProfile && myProfile) prof = myProfile;
      if (!prof) return null;

      const [orgRes, roleRes, logsRes, projRes] = await Promise.all([
        prof.org_id
          ? supabase.from('organizations').select('name, type, city').eq('id', prof.org_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('user_roles').select('role_id').eq('user_id', prof.id),
        supabase
          .from('activity_log')
          .select('*')
          .eq('user_id', prof.id)
          .not('action', 'in', '("login","logout","registered")')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('projects').select('*').eq('author_id', prof.id).order('created_at', { ascending: false })
      ]);

      const roleMap = { 1: 'student', 2: 'teacher', 3: 'jury', 4: 'admin', 5: 'dev' };
      const loadedRoles =
        roleRes.data?.length > 0
          ? roleRes.data.map((r) => roleMap[r.role_id] || 'student')
          : isOwnProfile && myRoles?.length
          ? myRoles
          : ['student'];

      return {
        prof: { ...prof, organizations: orgRes.data || prof.organizations },
        roles: loadedRoles,
        logs: logsRes.data || [],
        projects: projRes.data || []
      };
    }
  });

  const activeProf = profileData?.prof || (isOwnProfile ? myProfile : null);
  const activeRoles = profileData?.roles || (isOwnProfile ? myRoles : ['student']);
  const logs = profileData?.logs || [];
  const userProjects = profileData?.projects || [];

  const [settingsForm, setSettingsForm] = useState(null);

  const updateProfileMutation = useMutation({
    mutationFn: async (patch) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_full_v3'] });
      refreshProfile();
      toast('Настройки профиля сохранены!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  const handleUploadFile = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast('Загрузка изображения...', 'info');
      const url = await uploadFileToStorage('avatars', user.id, file);
      updateProfileMutation.mutate({ [field]: url });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleStartDirectMessage = async () => {
    if (!activeProf?.id) return;
    try {
      const { data: chatId, error } = await supabase.rpc('get_or_create_direct_chat', {
        target_user_id: activeProf.id
      });
      if (error) throw error;
      navigate(`/chat?room=${chatId}`);
    } catch {
      navigate('/chat');
    }
  };

  const handleInviteToProject = async () => {
    if (!activeProf?.id) return;
    await supabase.from('notifications').insert([
      {
        user_id: activeProf.id,
        type: 'project_invite',
        payload: { preview: `${myProfile?.username || '@user'} приглашает вас в проектную команду!` }
      }
    ]);
    toast(`Приглашение в проект отправлено ${activeProf.username}!`, 'success');
  };

  const handleMakeMentor = async () => {
    if (!activeProf?.id) return;
    await supabase.from('mentor_links').insert([
      {
        student_id: user.id,
        mentor_id: activeProf.id,
        status: 'pending'
      }
    ]);
    await supabase.from('notifications').insert([
      {
        user_id: activeProf.id,
        type: 'mentor_request',
        payload: { preview: `${myProfile?.username || '@user'} приглашает вас стать наставником` }
      }
    ]);
    toast('Запрос на наставничество отправлен!', 'success');
  };

  if (isLoading && !myProfile) return <Skeleton className="h-96 w-full" />;

  if (!activeProf) {
    return (
      <Card className="p-8 text-center space-y-4 font-mono text-xs text-[#8A93A6]">
        <div className="text-white text-base">Профиль пользователя не найден</div>
        <div className="flex justify-center gap-3">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Повторить
          </Button>
          <Button size="sm" variant="danger" onClick={() => signOut()}>
            <LogOut size={13} /> Выйти
          </Button>
        </div>
      </Card>
    );
  }

  const meta = activeProf.privacy || {};
  const isPrivateAndHidden = !isOwnProfile && meta.show_profile === 'private';

  if (isPrivateAndHidden) {
    return (
      <Card className="p-12 text-center space-y-4">
        <Lock size={36} className="mx-auto text-[#FFAA00]" />
        <h2 className="text-xl font-light text-white">Приватный профиль ({activeProf.username})</h2>
        <Button size="sm" onClick={handleStartDirectMessage}>
          <MessageSquare size={14} /> Написать лично
        </Button>
      </Card>
    );
  }

  const lvlInfo = getLevelInfo(activeProf.xp || 100);
  const badgesList =
    Array.isArray(activeProf.badges) && activeProf.badges.length > 0
      ? activeProf.badges
      : ['Пионер Экосистемы', 'Защитник Югры'];

  return (
    <div className="space-y-6 print:bg-white print:text-black">
      {/* ОБЛОЖКА ПРОФИЛЯ (COVER UPLOAD) + АВАТАР С РАМКОЙ УРОВНЯ */}
      <div className="border border-white/10 bg-[#070b14] overflow-hidden relative">
        <div
          className="h-44 bg-cover bg-center relative border-b border-white/10 bg-gradient-to-r from-[#06281e] via-[#0c223b] to-[#291c06]"
          style={activeProf.cover_url ? { backgroundImage: `url(${activeProf.cover_url})` } : {}}
        >
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute top-4 left-5 flex flex-wrap gap-2">
            <Badge color="gold">
              Уровень {lvlInfo.level} / 50 · {lvlInfo.title}
            </Badge>
            <Badge color="emerald">Рамка: {lvlInfo.frameName}</Badge>
          </div>

          {isOwnProfile && (
            <label className="absolute top-4 right-5 px-3 py-1.5 bg-black/70 border border-white/20 hover:border-[#FFAA00] font-mono text-[10px] uppercase text-white cursor-pointer flex items-center gap-1.5">
              <Camera size={13} /> Загрузить обложку
              <input type="file" accept="image/*" onChange={(e) => handleUploadFile(e, 'cover_url')} className="hidden" />
            </label>
          )}
        </div>

        <div className="px-6 sm:px-8 pb-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 -mt-12 mb-5 relative z-10">
            <div className="flex items-end gap-5">
              <div className="relative">
                <div className={`rounded-full p-1 bg-[#050810] ${lvlInfo.frameClass}`}>
                  <Avatar
                    src={activeProf.avatar_url}
                    username={activeProf.username}
                    status={meta.show_online === 'private' && !isOwnProfile ? undefined : activeProf.status}
                    size="lg"
                  />
                </div>
                {isOwnProfile && (
                  <label className="absolute -bottom-1 -right-1 px-2 py-0.5 bg-[#FFAA00] text-[#050810] font-mono text-[9px] font-bold cursor-pointer">
                    ФОТО
                    <input type="file" accept="image/*" onChange={(e) => handleUploadFile(e, 'avatar_url')} className="hidden" />
                  </label>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-light text-white">{activeProf.full_name}</h1>
                  <span className="font-mono text-sm text-[#FFAA00] font-bold">{activeProf.username}</span>
                </div>
                <div className="text-xs text-[#8A93A6] mt-1 flex flex-wrap items-center gap-3">
                  <span className="text-[#34D399] inline-flex items-center gap-1">
                    <Briefcase size={12} /> {meta.specialization || 'Исследователь экосистемы'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} className="text-[#FFAA00]" />
                    {activeProf.organizations?.name || 'МБОУ «СОШ № 1» (пгт. Пойковский)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Быстрые действия */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {isOwnProfile ? (
                <>
                  <select
                    value={activeProf.status || 'online'}
                    onChange={(e) => updateProfileMutation.mutate({ status: e.target.value })}
                    className="bg-[#050810] border border-white/15 px-3 py-2 font-mono text-xs text-white"
                  >
                    <option value="online">🟢 Онлайн</option>
                    <option value="away">🟡 Отошёл</option>
                    <option value="dnd">🔴 Не беспокоить</option>
                  </select>
                  <Button variant="gold" size="sm" onClick={() => window.print()}>
                    <FileDown size={14} /> Экспорт в PDF
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={handleStartDirectMessage}>
                    <MessageSquare size={14} /> Написать
                  </Button>
                  <Button size="sm" variant="gold" onClick={handleInviteToProject}>
                    <FolderPlus size={14} /> Пригласить в проект
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleMakeMentor}>
                    <UserCheck size={14} /> Сделать наставником
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Прогресс-бар 50 уровней + Роли */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4 border-t border-white/10 items-center">
            <div className="lg:col-span-6 space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[#34D399]">
                  Ранг {lvlInfo.level}/50: {lvlInfo.title}
                </span>
                <span className="text-[#FFAA00] font-bold">
                  {lvlInfo.xp} / {lvlInfo.nextLevelXp} XP ({lvlInfo.progressPct}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-[#050810] border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-[#00C853] to-[#FFAA00]"
                  style={{ width: `${lvlInfo.progressPct}%` }}
                />
              </div>
            </div>

            <div className="lg:col-span-6 flex flex-wrap items-center justify-end gap-2">
              <Badge color="gold">
                <Flame size={12} /> Streak: {activeProf.streak_days || 1} дн.
              </Badge>
              {activeRoles.map((r) => (
                <Badge key={r} color={r === 'admin' || r === 'dev' ? 'red' : r === 'jury' ? 'gold' : 'emerald'}>
                  Роль: {r.toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5 ТАБОВ ПРОФИЛЯ: ПОСТЫ | ПРОЕКТЫ | ДОСТИЖЕНИЯ | АКТИВНОСТЬ | НАСТРОЙКИ */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3 print:hidden">
        {[
          { id: 'wall', label: '01 / Посты (Стена)' },
          { id: 'projects', label: `02 / Проекты (${userProjects.length})` },
          { id: 'achievements', label: `03 / Достижения и XP-календарь` },
          { id: 'activity', label: `04 / Активность (${logs.length})` },
          ...(isOwnProfile ? [{ id: 'settings', label: '05 / Настройки и Приватность' }] : [])
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all ${
              activeTab === t.id
                ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ТАБ 1: ЛИЧНАЯ СТЕНА ПОЛЬЗОВАТЕЛЯ */}
      {activeTab === 'wall' && (
        <div>
          {!isOwnProfile && meta.show_wall === 'private' ? (
            <Card className="p-8 text-center font-mono text-xs text-[#8A93A6]">
              Пользователь скрыл свою стену в настройках приватности.
            </Card>
          ) : (
            <UserWall targetUserId={activeProf.id} isOwnWall={isOwnProfile} />
          )}
        </div>
      )}

      {/* ТАБ 2: ПРОЕКТЫ */}
      {activeTab === 'projects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {userProjects.length === 0 ? (
            <Card className="md:col-span-2 p-8 text-center font-mono text-xs text-[#8A93A6]">
              У пользователя пока нет опубликованных проектов.
            </Card>
          ) : (
            userProjects.map((p) => (
              <Card key={p.id} className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge color="emerald">{p.impact_metric}</Badge>
                  <Badge color="gold">Статус: {p.status}</Badge>
                </div>
                <h3 className="text-base font-medium text-white">{p.title}</h3>
                <p className="text-xs text-[#8A93A6]">{p.description}</p>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ТАБ 3: ДОСТИЖЕНИЯ + XP-КАЛЕНДАРЬ */}
      {activeTab === 'achievements' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-6 space-y-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00] flex items-center gap-2">
              <Award size={15} /> Коллекция бейджей и наград
            </div>
            <div className="flex flex-wrap gap-2">
              {badgesList.map((b, i) => (
                <div key={i} className="p-3 border border-[#FFAA00]/40 bg-[#FFAA00]/10 font-mono text-xs text-[#FFAA00]">
                  🏆 {b}
                </div>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-6 space-y-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#34D399]">
              XP-Календарь активности (Последние 14 дней)
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 14 }).map((_, idx) => {
                const d = new Date(Date.now() - (13 - idx) * 86400000);
                const dateStr = d.toISOString().slice(0, 10);
                const hasAct =
                  logs.some((l) => l.created_at?.slice(0, 10) === dateStr) || idx === 13;
                return (
                  <div
                    key={idx}
                    className={`p-2.5 border text-center font-mono text-[10px] ${
                      hasAct
                        ? 'border-[#00C853] bg-[#00C853]/20 text-[#34D399] font-bold'
                        : 'border-white/10 bg-[#050810] text-[#4A5464]'
                    }`}
                  >
                    <div>{d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</div>
                    <div className="mt-1">{hasAct ? '+XP' : '—'}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ТАБ 4: АКТИВНОСТЬ */}
      {activeTab === 'activity' && (
        <Card className="space-y-3">
          {!isOwnProfile && meta.show_activity === 'private' ? (
            <div className="text-xs font-mono text-[#8A93A6] py-6 text-center">
              История активности скрыта настройками приватности.
            </div>
          ) : logs.length === 0 ? (
            <div className="text-xs font-mono text-[#8A93A6] py-6 text-center">Записей активности пока нет.</div>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="p-3 border-l-2 border-[#00C853] bg-[#050810] flex justify-between text-xs">
                <span className="font-mono text-white">
                  {l.action} <span className="text-[#8A93A6]">({l.entity})</span>
                </span>
                <span className="font-mono text-[10px] text-[#4A5464]">
                  {new Date(l.created_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </Card>
      )}

      {/* ТАБ 5: НАСТРОЙКИ И ПРИВАТНОСТЬ */}
      {activeTab === 'settings' && isOwnProfile && (
        <Card className="p-6 max-w-2xl space-y-4">
          <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00]">
            Настройки анкеты и приватности (Кто видит профиль, стену, активность, онлайн)
          </div>
          <Input
            label="ФИО"
            defaultValue={activeProf.full_name}
            onChange={(e) => setSettingsForm((s) => ({ ...s, full_name: e.target.value }))}
          />
          <Input
            label="Краткий Bio / Специализация"
            defaultValue={activeProf.bio}
            onChange={(e) => setSettingsForm((s) => ({ ...s, bio: e.target.value }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">Кто видит профиль</label>
              <select
                defaultValue={meta.show_profile || 'public'}
                onChange={(e) => setSettingsForm((s) => ({ ...s, show_profile: e.target.value }))}
                className="w-full bg-[#050810] border border-white/15 px-3 py-2 text-xs text-white"
              >
                <option value="public">Все участники</option>
                <option value="private">Только я</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">Кто видит стену</label>
              <select
                defaultValue={meta.show_wall || 'public'}
                onChange={(e) => setSettingsForm((s) => ({ ...s, show_wall: e.target.value }))}
                className="w-full bg-[#050810] border border-white/15 px-3 py-2 text-xs text-white"
              >
                <option value="public">Все участники</option>
                <option value="private">Только я</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">Кто видит активность</label>
              <select
                defaultValue={meta.show_activity || 'public'}
                onChange={(e) => setSettingsForm((s) => ({ ...s, show_activity: e.target.value }))}
                className="w-full bg-[#050810] border border-white/15 px-3 py-2 text-xs text-white"
              >
                <option value="public">Все участники</option>
                <option value="private">Скрыто</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">Статус онлайн</label>
              <select
                defaultValue={meta.show_online || 'public'}
                onChange={(e) => setSettingsForm((s) => ({ ...s, show_online: e.target.value }))}
                className="w-full bg-[#050810] border border-white/15 px-3 py-2 text-xs text-white"
              >
                <option value="public">Показывать всем</option>
                <option value="private">Скрывать онлайн</option>
              </select>
            </div>
          </div>

          <Button
            onClick={() =>
              updateProfileMutation.mutate({
                full_name: settingsForm?.full_name ?? activeProf.full_name,
                bio: settingsForm?.bio ?? activeProf.bio,
                privacy: {
                  ...meta,
                  show_profile: settingsForm?.show_profile ?? meta.show_profile ?? 'public',
                  show_wall: settingsForm?.show_wall ?? meta.show_wall ?? 'public',
                  show_activity: settingsForm?.show_activity ?? meta.show_activity ?? 'public',
                  show_online: settingsForm?.show_online ?? meta.show_online ?? 'public'
                }
              })
            }
          >
            Сохранить настройки
          </Button>
        </Card>
      )}
    </div>
  );
}