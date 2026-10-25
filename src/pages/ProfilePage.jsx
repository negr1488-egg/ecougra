import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, uploadFileToStorage } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Avatar, Badge, Modal, Skeleton, useToast } from '../components/ui/DesignSystem';
import { getHighestRole, ROLE_ID_MAP } from '../utils/roleUtils';
import {
  Award,
  Flame,
  Upload,
  Printer,
  Edit3,
  MessageSquare,
  ShieldCheck,
  Users,
  UserCheck,
  Flag,
  FolderKanban,
  ArrowRight
} from 'lucide-react';

export default function ProfilePage() {
  const { username } = useParams();
  const { user, profile: myProfile, roles: myRoles, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [mentorInput, setMentorInput] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    bio: '',
    status: 'online'
  });

  // Загружаем целевой профиль + список наставников + роли + подопечных + проекты
  const { data: profileBundle, isLoading } = useQuery({
    queryKey: ['profile_bundle_v8', username || myProfile?.id],
    enabled: Boolean(username || myProfile?.id),
    queryFn: async () => {
      let target = myProfile;
      if (username) {
        const clean = username.startsWith('@') ? username : `@${username}`;
        const { data } = await supabase
          .from('profiles')
          .select('*, organizations(name, city)')
          .ilike('username', clean)
          .maybeSingle();
        if (data) target = data;
      }

      if (!target?.id) return null;

      const [urRes, allProfsRes, projsRes, logsRes] = await Promise.all([
        supabase.from('user_roles').select('user_id, role_id'),
        supabase.from('profiles').select('id, username, full_name, xp, avatar_url, mentor_id'),
        supabase.from('projects').select('*').eq('author_id', target.id).order('created_at', { ascending: false }),
        supabase
          .from('activity_log')
          .select('*')
          .eq('user_id', target.id)
          .not('action', 'in', '("login","logout","registered")')
          .order('created_at', { ascending: false })
          .limit(15)
      ]);

      const allProfs = allProfsRes.data || [];
      const profMap = Object.fromEntries(allProfs.map((p) => [p.id, p]));
      const allUr = urRes.data || [];

      const targetRoleIds = allUr.filter((r) => r.user_id === target.id).map((r) => r.role_id);
      const targetRoleNames = targetRoleIds.length
        ? targetRoleIds.map((id) => ROLE_ID_MAP[id] || 'student')
        : ['student'];
      const highestRole = getHighestRole(targetRoleNames, target.username);

      const teacherIds = new Set(allUr.filter((r) => r.role_id === 2 || r.role_id === 4).map((r) => r.user_id));
      const mentorsList = allProfs.filter((p) => teacherIds.has(p.id));
      const menteesList = allProfs.filter((p) => p.mentor_id === target.id);

      return {
        target,
        targetRoleNames,
        highestRole,
        mentorObj: target.mentor_id ? profMap[target.mentor_id] : null,
        mentorsList,
        menteesList,
        projects: projsRes.data || [],
        activities: logsRes.data || []
      };
    }
  });

  const targetProfile = profileBundle?.target;
  const isOwnProfile = !username || targetProfile?.id === user?.id;

  // Привязка к наставнику по ID или @username
  const bindMentorMutation = useMutation({
    mutationFn: async (mentorIdOrUsername) => {
      let targetMentorId = mentorIdOrUsername;
      if (typeof mentorIdOrUsername === 'string' && mentorIdOrUsername.startsWith('@')) {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', mentorIdOrUsername.trim())
          .maybeSingle();
        if (!data) throw new Error('Наставник с таким @username не найден');
        targetMentorId = data.id;
      }
      const { error } = await supabase
        .from('profiles')
        .update({ mentor_id: targetMentorId })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v8'] });
      if (refreshProfile) refreshProfile();
      setMentorInput('');
      toast('Научный наставник успешно привязан к вашему профилю!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Сохранение изменений профиля
  const updateProfileMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          bio: form.bio.trim(),
          status: form.status
        })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v8'] });
      if (refreshProfile) refreshProfile();
      setEditOpen(false);
      toast('Профиль успешно обновлён!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Отправка жалобы на профиль
  const reportUserMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      const { error } = await supabase.from('reports').insert([
        {
          reporter_id: user.id,
          target_id: targetProfile.id,
          reason: `[Жалоба на профиль] ${reportReason.trim()}`,
          status: 'pending'
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      setReportOpen(false);
      setReportReason('');
      toast('Жалоба отправлена администраторам!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast('Загрузка аватара...', 'info');
      const publicUrl = await uploadFileToStorage('avatars', user.id, file);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v8'] });
      if (refreshProfile) refreshProfile();
      toast('Аватар обновлён!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (isLoading || !profileBundle) return <Skeleton className="h-96 w-full" />;

  const { highestRole, targetRoleNames, mentorObj, mentorsList, menteesList, projects, activities } = profileBundle;
  const level = Math.floor((targetProfile.xp || 100) / 250) + 1;
  const badges = Array.isArray(targetProfile.badges) ? targetProfile.badges : ['Пионер Югры'];

  return (
    <div className="space-y-8">
      {/* ГЛАВНАЯ КАРТОЧКА ПРОФИЛЯ */}
      <Card className="p-6 sm:p-8 border-[#00C853]/30 bg-gradient-to-r from-[#060a14] via-[#071914] to-[#050810] shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative group">
              <Avatar
                src={targetProfile.avatar_url}
                username={targetProfile.username}
                status={targetProfile.status}
                size="lg"
              />
              {isOwnProfile && (
                <label className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <Upload size={18} className="text-[#FFAA00]" />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-[#FFAA00] font-bold">{targetProfile.username}</span>
                {/* СТАРШАЯ РОЛЬ ПОЛЬЗОВАТЕЛЯ */}
                <Badge color={highestRole.color}>{highestRole.label}</Badge>
                <Badge color="emerald">Уровень {level}</Badge>
                <Badge color="gold">
                  <Flame size={12} /> Серия {targetProfile.streak_days || 1} дн.
                </Badge>
                {targetProfile.is_banned && <Badge color="red">Аккаунт заблокирован</Badge>}
              </div>

              <h1 className="text-2xl sm:text-3xl font-semibold text-white">{targetProfile.full_name}</h1>
              <p className="text-xs text-[#8A93A6]">
                {targetProfile.organizations?.name || 'МБОУ «СОШ № 1» пгт. Пойковский (ХМАО-Югра)'}
              </p>
              {targetProfile.bio && <p className="text-xs text-zinc-200 max-w-xl pt-1">{targetProfile.bio}</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {isOwnProfile ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setForm({
                      full_name: targetProfile.full_name || '',
                      bio: targetProfile.bio || '',
                      status: targetProfile.status || 'online'
                    });
                    setEditOpen(true);
                  }}
                >
                  <Edit3 size={14} /> Редактировать
                </Button>
                <Button variant="gold" size="sm" onClick={() => setCertOpen(true)}>
                  <Printer size={14} /> Сертификат ХМАО
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    const { data } = await supabase.rpc('get_or_create_direct_chat', {
                      target_user_id: targetProfile.id
                    });
                    navigate(data ? `/chat?room=${data}` : '/chat');
                  }}
                >
                  <MessageSquare size={14} /> Написать в ЛС
                </Button>
                <Button variant="outline" size="sm" onClick={() => setReportOpen(true)} className="text-red-400">
                  <Flag size={14} /> Пожаловаться
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* СЕТКА: НАСТАВНИЧЕСТВО, РОЛЕВОЙ ПУЛЬТ И ДОСТИЖЕНИЯ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Левая колонка: Наставничество и Ролевая специализация */}
        <div className="lg:col-span-5 space-y-6">
          {/* Блок Наставника */}
          <Card className="p-6 space-y-4 border-[#22D3EE]/30 bg-[#060a14]">
            <div className="font-mono text-xs uppercase tracking-widest text-[#22D3EE] flex items-center gap-2">
              <UserCheck size={15} /> Научное наставничество
            </div>

            {mentorObj ? (
              <div className="p-4 rounded-lg border border-[#22D3EE]/30 bg-[#050810] flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-mono text-[#8A93A6]">Текущий научный куратор:</div>
                  <div className="text-sm font-medium text-white mt-0.5">{mentorObj.full_name}</div>
                  <div className="font-mono text-xs text-[#FFAA00]">{mentorObj.username}</div>
                </div>
                <Badge color="cyan">Привязан</Badge>
              </div>
            ) : (
              <p className="text-xs text-[#8A93A6]">
                Наставник ещё не выбран. Привяжите наставника для кураторства ваших инженерных проектов.
              </p>
            )}

            {isOwnProfile && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="text-xs text-zinc-300">Выбрать наставника из списка преподавателей:</div>
                <div className="flex flex-wrap gap-1.5">
                  {mentorsList.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => bindMentorMutation.mutate(m.id)}
                      className={`px-2.5 py-1.5 rounded border font-mono text-xs transition-all ${
                        targetProfile.mentor_id === m.id
                          ? 'border-[#22D3EE] bg-[#22D3EE]/20 text-white font-bold'
                          : 'border-white/10 bg-[#050810] text-zinc-300 hover:border-[#22D3EE]'
                      }`}
                    >
                      {m.username}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Или введите @ник_наставника"
                    value={mentorInput}
                    onChange={(e) => setMentorInput(e.target.value)}
                  />
                  <Button size="sm" variant="outline" onClick={() => bindMentorMutation.mutate(mentorInput)}>
                    Привязать
                  </Button>
                </div>
              </div>
            )}

            {/* Если сам пользователь является Наставником — показываем его учеников */}
            {targetRoleNames.includes('teacher') && (
              <div className="pt-4 border-t border-white/10 space-y-2">
                <div className="font-mono text-xs uppercase text-[#34D399]">
                  Подопечные ученики ({menteesList.length}):
                </div>
                {menteesList.length === 0 ? (
                  <div className="text-xs text-[#8A93A6]">Пока нет привязанных учеников</div>
                ) : (
                  menteesList.map((st) => (
                    <div
                      key={st.id}
                      className="p-2.5 rounded border border-white/5 bg-[#050810] flex items-center justify-between text-xs"
                    >
                      <span className="font-mono text-[#FFAA00]">{st.username}</span>
                      <span className="text-zinc-300">{st.full_name}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>

          {/* Бейджи и награды */}
          <Card className="p-6 space-y-4 border-white/10 bg-[#060a14]">
            <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00] flex items-center gap-2">
              <Award size={15} /> Заслуженные знаки отличия
            </div>
            <div className="flex flex-wrap gap-2">
              {badges.map((b, i) => (
                <Badge key={i} color="gold">
                  ★ {b}
                </Badge>
              ))}
            </div>
          </Card>
        </div>

        {/* Правая колонка: Проекты и портфолио результатов */}
        <Card className="lg:col-span-7 p-6 space-y-5 border-white/10 bg-[#060a14]">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="font-mono text-xs uppercase tracking-widest text-[#34D399] flex items-center gap-2">
              <FolderKanban size={15} /> Инженерные проекты и достижения ({projects.length})
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/activities')}>
              Перейти в Мастерскую <ArrowRight size={13} />
            </Button>
          </div>

          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="text-xs text-[#8A93A6] font-mono py-4">
                Пользователь ещё не подавал проектов на защиту.
              </div>
            ) : (
              projects.map((pr) => (
                <div
                  key={pr.id}
                  className="p-4 rounded-lg border border-white/10 bg-[#050810] flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{pr.title}</div>
                    <div className="text-xs text-[#34D399] font-mono mt-0.5">{pr.impact_metric}</div>
                  </div>
                  <Badge color="emerald">{pr.status}</Badge>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-white/10 space-y-2">
            <div className="font-mono text-xs uppercase tracking-widest text-[#8A93A6] flex items-center gap-2">
              <ShieldCheck size={14} /> Верифицированная история опыта (XP)
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded border border-white/5 bg-[#050810] flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-white uppercase">{act.action}</span>
                  <span className="font-mono text-[#34D399]">
                    {new Date(act.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* МОДАЛКА РЕДАКТИРОВАНИЯ */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Редактировать профиль">
        <form onSubmit={(e) => updateProfileMutation.mutate(e)} className="space-y-4">
          <Input
            label="ФИО / Имя исследователя"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
          <div>
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">О себе / научные интересы</label>
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="w-full bg-[#050810] border border-white/15 rounded p-3 text-xs text-white"
            />
          </div>
          <Button type="submit" className="w-full justify-center">
            Сохранить изменения
          </Button>
        </form>
      </Modal>

      {/* МОДАЛКА ЖАЛОБЫ НА ПРОФИЛЬ */}
      <Modal isOpen={reportOpen} onClose={() => setReportOpen(false)} title={`Жалоба на ${targetProfile.username}`}>
        <form onSubmit={(e) => reportUserMutation.mutate(e)} className="space-y-4">
          <textarea
            rows={4}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Опишите причину жалобы для модераторов..."
            className="w-full bg-[#050810] border border-white/15 rounded p-3 text-xs text-white"
            required
          />
          <Button type="submit" variant="gold" className="w-full justify-center">
            Отправить жалобу
          </Button>
        </form>
      </Modal>

      {/* МОДАЛКА СЕРТИФИКАТА */}
      <Modal isOpen={certOpen} onClose={() => setCertOpen(false)} title="Сертификат исследователя ХМАО">
        <div className="p-6 border-2 border-[#FFAA00] bg-[#050810] text-center space-y-4">
          <div className="font-mono text-xs uppercase tracking-widest text-[#34D399]">
            ЮГРА.НЕФТЬ • ЗЕЛЁНАЯ ЮГРА
          </div>
          <h2 className="text-xl font-bold text-white uppercase">Сертификат отличия</h2>
          <div className="text-lg font-semibold text-[#FFAA00]">{targetProfile.full_name}</div>
          <div className="font-mono text-xs text-zinc-300">
            Ранг: {highestRole.label} • Опыт: {targetProfile.xp || 100} XP
          </div>
          <Button variant="gold" onClick={() => window.print()} className="w-full justify-center">
            <Printer size={14} /> Распечатать / Сохранить в PDF
          </Button>
        </div>
      </Modal>
    </div>
  );
}