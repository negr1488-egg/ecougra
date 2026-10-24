import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, uploadFileToStorage } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Avatar, Badge, Skeleton, Modal, useToast } from '../components/ui/DesignSystem';
import {
  FileDown,
  UserCheck,
  MessageSquare,
  Lock,
  Clock,
  LogOut,
  MapPin,
  Briefcase,
  Send,
  Globe,
  Flame,
  Award,
  Sparkles,
  Edit3
} from 'lucide-react';

const ROLE_LABELS = {
  student: { label: 'Исследователь', color: 'emerald' },
  teacher: { label: 'Наставник', color: 'cyan' },
  jury: { label: 'Эксперт жюри', color: 'gold' },
  admin: { label: 'Администратор', color: 'red' },
  dev: { label: 'Разработчик', color: 'purple' }
};

export default function ProfilePage() {
  const { username: routeUsername } = useParams();
  const { user, profile: myProfile, roles: myRoles, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mentorInput, setMentorInput] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Поля расширенного редактирования профиля
  const [formState, setFormState] = useState({
    full_name: '',
    bio: '',
    city: '',
    specialization: '',
    telegram: '',
    github: '',
    show_profile: 'public'
  });

  const cleanRoute = (routeUsername || '').replace('@', '').trim().toLowerCase();
  const cleanMy = (myProfile?.username || '').replace('@', '').trim().toLowerCase();
  const isOwnProfile = !routeUsername || (cleanMy && cleanRoute === cleanMy);

  const { data: profileData, isLoading, refetch } = useQuery({
    queryKey: ['profile_view_v2', routeUsername, user?.id, myProfile?.id],
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

      let orgObj = prof.organizations || null;
      if (!orgObj && prof.org_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name, type, city')
          .eq('id', prof.org_id)
          .maybeSingle();
        orgObj = orgData;
      }

      let loadedRoles = isOwnProfile && myRoles?.length ? myRoles : ['student'];
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', prof.id);

      if (roleRows && roleRows.length > 0) {
        const roleMap = { 1: 'student', 2: 'teacher', 3: 'jury', 4: 'admin', 5: 'dev' };
        loadedRoles = roleRows.map((r) => roleMap[r.role_id] || 'student');
      }

      // Не загружаем технические логи входов/выходов в публичный таймлайн
      const { data: logsData } = await supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', prof.id)
        .not('action', 'in', '("login","logout","registered")')
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: mentorsData } = await supabase
        .from('mentor_links')
        .select('*')
        .or(`student_id.eq.${prof.id},mentor_id.eq.${prof.id}`);

      return {
        prof: { ...prof, organizations: orgObj },
        roles: loadedRoles,
        logs: logsData || [],
        mentorLinks: mentorsData || []
      };
    }
  });

  const activeProf = profileData?.prof || (isOwnProfile ? myProfile : null);
  const activeRoles = profileData?.roles || (isOwnProfile ? myRoles : ['student']);
  const logs = profileData?.logs || [];
  const mentorLinks = profileData?.mentorLinks || [];

  const openEditModal = () => {
    if (!activeProf) return;
    const meta = activeProf.privacy || {};
    setFormState({
      full_name: activeProf.full_name || '',
      bio: activeProf.bio || '',
      city: meta.city || activeProf.organizations?.city || 'пгт. Пойковский',
      specialization: meta.specialization || 'Экологический инжиниринг и декарбонизация',
      telegram: meta.telegram || '',
      github: meta.github || '',
      show_profile: meta.show_profile || 'public'
    });
    setEditModalOpen(true);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (patch) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_view_v2'] });
      refreshProfile();
      setEditModalOpen(false);
      toast('Профиль успешно обновлён!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  const handleSaveExtendedProfile = (e) => {
    e.preventDefault();
    const currentPrivacy = activeProf?.privacy || {};
    updateProfileMutation.mutate({
      full_name: formState.full_name.trim(),
      bio: formState.bio.trim(),
      privacy: {
        ...currentPrivacy,
        show_profile: formState.show_profile,
        city: formState.city.trim(),
        specialization: formState.specialization.trim(),
        telegram: formState.telegram.trim(),
        github: formState.github.trim()
      }
    });
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast('Загрузка нового аватара...', 'info');
      const url = await uploadFileToStorage('avatars', user.id, file);
      updateProfileMutation.mutate({ avatar_url: url });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // Открытие личного чата (Direct Message) с этим пользователем в 1 клик
  const handleStartDirectMessage = async () => {
    if (!activeProf?.id) return;
    try {
      const { data: chatId, error } = await supabase.rpc('get_or_create_direct_chat', {
        target_user_id: activeProf.id
      });
      if (error) throw error;
      navigate(`/chat?room=${chatId}`);
    } catch (err) {
      toast('Переход в личный диалог...', 'info');
      navigate(`/chat?dm=${activeProf.username.replace('@', '')}`);
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

      if (!mentorProf) throw new Error('Пользователь с таким @username не найден');

      const { error } = await supabase.from('mentor_links').insert([{
        student_id: user.id,
        mentor_id: mentorProf.id,
        status: 'pending'
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_view_v2'] });
      setMentorInput('');
      toast('Заявка на наставничество отправлена!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  if (isLoading && !myProfile) return <Skeleton className="h-96 w-full" />;

  if (!activeProf) {
    return (
      <Card className="p-8 text-center space-y-4 font-mono text-xs text-[#8A93A6]">
        <div className="text-white text-base">Профиль пользователя не найден</div>
        <div className="flex justify-center gap-3 pt-2">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Обновить
          </Button>
          <Button size="sm" variant="danger" onClick={() => signOut()}>
            <LogOut size={13} /> Перезайти
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
        <h2 className="text-xl font-light text-white">Закрытый профиль ({activeProf.username})</h2>
        <p className="text-xs text-[#8A93A6] max-w-md mx-auto">
          Исследователь ограничил публичный доступ к своему портфолио. Вы можете написать ему личное сообщение.
        </p>
        <Button size="sm" onClick={handleStartDirectMessage}>
          <MessageSquare size={14} /> Написать лично
        </Button>
      </Card>
    );
  }

  const xp = activeProf.xp || 100;
  const level = Math.min(10, 1 + Math.floor(xp / 150));
  const nextLevelXp = level * 150;
  const progressPct = Math.min(100, Math.round(((xp % 150) / 150) * 100));
  const badgesList = Array.isArray(activeProf.badges) && activeProf.badges.length > 0
    ? activeProf.badges
    : ['Пионер Экосистемы'];

  return (
    <div className="space-y-8 print:bg-white print:text-black">
      {/* ПРЕМИАЛЬНЫЙ HERO-ПРОФИЛЬ С БАННЕРОМ */}
      <div className="border border-white/10 bg-[#070b14] overflow-hidden relative">
        {/* Градиентная обложка */}
        <div className="h-36 bg-gradient-to-r from-[#06281e] via-[#0c223b] to-[#291c06] relative border-b border-white/10">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#00C853_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute top-4 right-5 flex items-center gap-2">
            <Badge color="gold">Уровень 0{level} · Инженер-эколог</Badge>
            <Badge color="emerald">ID: {activeProf.id?.slice(0, 8)}</Badge>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-8">
          {/* Аватар + Кнопки управления */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-6 relative z-10">
            <div className="flex items-end gap-5">
              <div className="relative group">
                <div className="p-1 rounded-full bg-[#050810] border-2 border-[#00C853]">
                  <Avatar src={activeProf.avatar_url} username={activeProf.username} status={activeProf.status} size="lg" />
                </div>
                {isOwnProfile && (
                  <label className="absolute -bottom-1 -right-1 px-2 py-0.5 bg-[#FFAA00] text-[#050810] font-mono text-[9px] font-bold cursor-pointer hover:bg-[#FFC857] shadow-lg">
                    ИЗМЕНИТЬ
                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  </label>
                )}
              </div>

              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
                    {activeProf.full_name}
                  </h1>
                  <span className="font-mono text-sm text-[#FFAA00] font-semibold">
                    {activeProf.username}
                  </span>
                </div>
                <div className="text-xs text-[#8A93A6] mt-1 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-[#34D399]">
                    <Briefcase size={12} />
                    {meta.specialization || 'Экологический инжиниринг и декарбонизация'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} className="text-[#FFAA00]" />
                    {meta.city || activeProf.organizations?.city || 'ХМАО — Югра'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {isOwnProfile ? (
                <>
                  <select
                    value={activeProf.status || 'online'}
                    onChange={(e) => updateProfileMutation.mutate({ status: e.target.value })}
                    className="bg-[#050810] border border-white/15 px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-[#00C853]"
                  >
                    <option value="online">🟢 В сети</option>
                    <option value="away">🟡 Отошёл</option>
                    <option value="dnd">🔴 Не беспокоить</option>
                  </select>
                  <Button variant="primary" size="sm" onClick={openEditModal}>
                    <Edit3 size={13} /> Заполнить профиль
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <FileDown size={13} /> PDF-Портфолио
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" size="sm" onClick={handleStartDirectMessage}>
                    <MessageSquare size={14} /> Написать лично
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => requestMentorMutation.mutate(activeProf.username)}>
                    <UserCheck size={14} /> Пригласить в наставники
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Бейджи ролей и контакты */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mr-1">
                Активные роли:
              </span>
              {(activeRoles?.length ? activeRoles : ['student']).map((r) => {
                const cfg = ROLE_LABELS[r] || { label: r, color: 'emerald' };
                return (
                  <Badge key={r} color={cfg.color}>
                    ✦ {cfg.label} ({r.toUpperCase()})
                  </Badge>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
              {meta.telegram && (
                <a
                  href={`https://t.me/${meta.telegram.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#22D3EE] hover:underline flex items-center gap-1"
                >
                  <Send size={12} /> Telegram: {meta.telegram}
                </a>
              )}
              {meta.github && (
                <a
                  href={meta.github.startsWith('http') ? meta.github : `https://github.com/${meta.github}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#FFAA00] hover:underline flex items-center gap-1"
                >
                  <Globe size={12} /> Портфолио / GitHub
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* МЕТРИКИ И ПРОГРЕСС-БАР УРОВНЯ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#34D399]">
              Прогресс ранга исследователя
            </span>
            <span className="font-mono text-xs text-white font-bold">
              {xp} / {nextLevelXp} XP
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#050810] border border-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00C853] to-[#FFAA00] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 font-mono text-[10px] text-[#8A93A6] flex justify-between">
            <span>Текущий уровень: 0{level}</span>
            <span>До следующего ранга: {nextLevelXp - xp} XP</span>
          </div>
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase text-[#8A93A6]">Ударная серия</div>
            <div className="text-2xl font-mono font-bold text-[#FFAA00] mt-1">
              {activeProf.streak_days || 1} дн.
            </div>
            <div className="text-[11px] text-[#8A93A6]">Ежедневная активность</div>
          </div>
          <Flame size={28} className="text-[#FFAA00] fill-[#FFAA00]/20" />
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase text-[#8A93A6]">Организация</div>
            <div className="text-xs font-medium text-white mt-1 line-clamp-2">
              {activeProf.organizations?.name || 'МБОУ «СОШ № 1» (Роснефть-класс)'}
            </div>
          </div>
          <Sparkles size={24} className="text-[#00C853] shrink-0" />
        </Card>
      </div>

      {/* О СЕБЕ И НАГРАДЫ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 space-y-4">
          <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00]">
            О специалисте / Научные интересы
          </div>
          <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {activeProf.bio ||
              'Разработка решений по снижению углеродного следа (Scope 1 & 2), биорекультивации нефтезагрязнённых земель ХМАО-Югры и промышленному IoT-мониторингу.'}
          </p>

          <div className="pt-4 border-t border-white/10">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#34D399] mb-3 flex items-center gap-1.5">
              <Award size={14} /> Открытые достижения и сертификаты
            </div>
            <div className="flex flex-wrap gap-2">
              {badgesList.map((b, i) => (
                <Badge key={i} color="gold">
                  🏆 {b}
                </Badge>
              ))}
            </div>
          </div>
        </Card>

        {/* НАСТАВНИЧЕСТВО */}
        <Card className="lg:col-span-5 space-y-4">
          <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00]">
            Команда и Наставничество
          </div>
          {isOwnProfile && (
            <div className="flex gap-2">
              <input
                type="text"
                value={mentorInput}
                onChange={(e) => setMentorInput(e.target.value)}
                placeholder="Введите @username наставника..."
                className="flex-1 bg-[#050810] border border-white/10 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#00C853]"
              />
              <Button size="sm" onClick={() => requestMentorMutation.mutate(mentorInput)}>
                Привязать
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {mentorLinks.length === 0 ? (
              <div className="text-xs text-[#8A93A6] font-mono py-4">
                Связи с научными руководителями пока не добавлены.
              </div>
            ) : (
              mentorLinks.map((lnk) => (
                <div key={lnk.id} className="p-3 border border-white/10 bg-[#050810] flex items-center justify-between text-xs">
                  <div>
                    <div className="font-mono text-[#FFAA00]">Наставничество #{lnk.id.slice(0, 6)}</div>
                    <div className="text-[10px] text-[#8A93A6]">Статус: {lnk.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* ПОРТФОЛИО ИНЖЕНЕРНЫХ ДОСТИЖЕНИЙ (БЕЗ ТЕХНИЧЕСКИХ ВХОДОВ/ВЫХОДОВ) */}
      <Card className="space-y-4">
        <div className="font-mono text-xs uppercase tracking-widest text-[#34D399] flex items-center gap-2">
          <Clock size={14} /> Хронология выполненных работ и расчётов
        </div>
        {logs.length === 0 ? (
          <div className="text-xs text-[#8A93A6] font-mono py-4">
            Здесь отображаются только значимые достижения (расчёты CO₂, этапы рекультивации, опубликованные проекты).
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {logs.map((l) => (
              <div key={l.id} className="p-3.5 border-l-2 border-[#00C853] bg-[#050810] flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono text-white font-medium">{l.action}</span>
                  <span className="text-[#8A93A6] ml-2">Модуль: {l.entity}</span>
                </div>
                <span className="font-mono text-[10px] text-[#4A5464]">
                  {new Date(l.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* МОДАЛЬНОЕ ОКНО РАСШИРЕННОГО РЕДАКТИРОВАНИЯ ПРОФИЛЯ */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        eyebrow="Персональная карточка исследователя"
        title="Редактирование цифрового портфолио"
      >
        <form onSubmit={handleSaveExtendedProfile} className="space-y-4">
          <Input
            label="ФИО полностью"
            value={formState.full_name}
            onChange={(e) => setFormState({ ...formState, full_name: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Город / Месторождение"
              value={formState.city}
              onChange={(e) => setFormState({ ...formState, city: e.target.value })}
              placeholder="пгт. Пойковский / Нефтеюганск"
            />
            <Input
              label="Специализация / Роль в команде"
              value={formState.specialization}
              onChange={(e) => setFormState({ ...formState, specialization: e.target.value })}
              placeholder="Инженер-эколог / IoT-разработчик"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Telegram для связи"
              value={formState.telegram}
              onChange={(e) => setFormState({ ...formState, telegram: e.target.value })}
              placeholder="@username"
            />
            <Input
              label="Ссылка на GitHub / Презентацию"
              value={formState.github}
              onChange={(e) => setFormState({ ...formState, github: e.target.value })}
              placeholder="https://github.com/..."
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1">
              О себе, проектах и научных достижениях
            </label>
            <textarea
              rows={3}
              value={formState.bio}
              onChange={(e) => setFormState({ ...formState, bio: e.target.value })}
              className="w-full bg-[#050810] border border-white/10 p-3 text-xs text-white focus:outline-none focus:border-[#00C853]"
              placeholder="Расскажите о ваших исследованиях и проектах..."
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1">
              Режим приватности профиля
            </label>
            <select
              value={formState.show_profile}
              onChange={(e) => setFormState({ ...formState, show_profile: e.target.value })}
              className="w-full bg-[#050810] border border-white/15 px-3 py-2 text-xs text-white"
            >
              <option value="public">Публичный — портфолио открыто для жюри и участников</option>
              <option value="private">Приватный — скрыть анкету от общего просмотра</option>
            </select>
          </div>

          <Button type="submit" disabled={updateProfileMutation.isPending} className="w-full">
            {updateProfileMutation.isPending ? 'Сохранение...' : 'Сохранить портфолио'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}