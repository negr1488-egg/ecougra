import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Badge, Skeleton, useToast } from '../components/ui/DesignSystem';
import { getHighestRole, ROLE_ID_MAP } from '../utils/roleUtils';
import {
  Shield,
  Users,
  Lock,
  CheckCircle2,
  Circle,
  Newspaper,
  Plus,
  Trash2,
  FolderKanban,
  Check,
  RotateCcw,
  Calendar,
  Flag,
  Ban,
  AlertTriangle,
  UserCheck,
  Sparkles
} from 'lucide-react';

const ROLE_CONFIG = [
  { id: 1, name: 'student', label: 'Исследователь', activeClass: 'bg-[#00C853]/20 border-[#00C853] text-[#34D399]' },
  { id: 2, name: 'teacher', label: 'Наставник', activeClass: 'bg-[#22D3EE]/20 border-[#22D3EE] text-[#22D3EE]' },
  { id: 3, name: 'jury', label: 'Эксперт Жюри', activeClass: 'bg-[#FFAA00]/20 border-[#FFAA00] text-[#FFAA00]' },
  { id: 4, name: 'admin', label: 'Админ', activeClass: 'bg-red-500/20 border-red-500 text-red-300' },
  { id: 5, name: 'dev', label: 'Разработчик', activeClass: 'bg-purple-500/20 border-purple-500 text-purple-300' }
];

const STATUS_RU = {
  draft: { label: 'Черновик', color: 'zinc' },
  submitted: { label: 'На рассмотрении', color: 'gold' },
  scheduled: { label: 'Допущен к защите', color: 'cyan' },
  defended: { label: 'Защищён', color: 'emerald' },
  approved: { label: 'Одобрен к внедрению', color: 'emerald' },
  revision: { label: 'На доработке', color: 'red' },
  rejected: { label: 'Отклонён', color: 'red' }
};

export default function AdminPage() {
  const { user, profile, hasRole, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('users'); // 'users' | 'reports' | 'projects' | 'news' | 'security'
  const isDev = hasRole('dev');

  // Форма для публикации выпуска газеты
  const [newsForm, setNewsForm] = useState({
    title: '',
    category: 'Главный выпуск',
    summary: '',
    content: '',
    is_pinned: false
  });

  // Единый запрос данных терминала администратора
  const { data: adminData, isLoading } = useQuery({
    queryKey: ['admin_panel_v8'],
    queryFn: async () => {
      const [profRes, orgsRes, urRes, logsRes, newsRes, projRes, repRes] = await Promise.all([
        supabase.from('profiles').select('*').order('xp', { ascending: false }),
        supabase.from('organizations').select('id, name'),
        supabase.from('user_roles').select('user_id, role_id'),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(40),
        supabase.from('news').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('reports').select('*').order('created_at', { ascending: false })
      ]);

      const profiles = profRes.data || [];
      const orgs = orgsRes.data || [];
      const userRoles = urRes.data || [];
      const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
      const profMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

      const enrichedUsers = profiles.map((p) => {
        const ids = userRoles.filter((ur) => ur.user_id === p.id).map((ur) => ur.role_id);
        const activeRoleIds = ids.length > 0 ? ids : [1];
        const roleNames = activeRoleIds.map((id) => ROLE_ID_MAP[id] || 'student');
        const highestRole = getHighestRole(roleNames, p.username);

        return {
          ...p,
          orgName: orgMap[p.org_id] || 'МБОУ «СОШ № 1» пгт. Пойковский',
          activeRoleIds,
          roleNames,
          highestRole,
          mentorProfile: p.mentor_id ? profMap[p.mentor_id] : null
        };
      });

      const securityLogs = (logsRes.data || []).map((l) => ({
        ...l,
        username: profMap[l.user_id]?.username || '@исследователь'
      }));

      const enrichedProjects = (projRes.data || []).map((pr) => ({
        ...pr,
        authorName: profMap[pr.author_id]?.username || '@исследователь',
        mentorName: pr.mentor_id ? profMap[pr.mentor_id]?.username : null
      }));

      const enrichedReports = (repRes.data || []).map((r) => ({
        ...r,
        reporterProfile: profMap[r.reporter_id] || { username: '@участник' },
        targetProfile: profMap[r.target_id] || { username: '@нарушитель' }
      }));

      return {
        users: enrichedUsers,
        securityLogs,
        newsList: newsRes.data || [],
        projects: enrichedProjects,
        reports: enrichedReports
      };
    }
  });

  // 1. Переключение ролей пользователя
  const toggleRoleMutation = useMutation({
    mutationFn: async ({ targetUserId, roleId, isCurrentlyOn }) => {
      if (isCurrentlyOn) {
        if (roleId === 1) throw new Error('Базовая роль исследователя (student) не может быть снята');
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', targetUserId)
          .eq('role_id', roleId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .upsert([{ user_id: targetUserId, role_id: roleId }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v8'] });
      if (refreshProfile) refreshProfile();
      toast('Роли участника успешно обновлены!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  // 2. Блокировка / разблокировка пользователя (is_banned)
  const toggleBanMutation = useMutation({
    mutationFn: async ({ targetUserId, currentBan }) => {
      const nextBan = !currentBan;
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: nextBan })
        .eq('id', targetUserId);
      if (error) throw error;
      return nextBan;
    },
    onSuccess: (nextBan) => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v8'] });
      toast(nextBan ? 'Аккаунт нарушителя заблокирован' : 'Блокировка с аккаунта снята', 'info');
    },
    onError: (e) => toast(e.message, 'error')
  });

  // 3. Полное удаление профиля нарушителя + очистка его сообщений
  const deleteUserMutation = useMutation({
    mutationFn: async (targetUserId) => {
      await supabase.from('chat_messages').delete().eq('author_id', targetUserId);
      await supabase.from('user_roles').delete().eq('user_id', targetUserId);
      const { error } = await supabase.from('profiles').delete().eq('id', targetUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v8'] });
      toast('Профиль и сообщения нарушителя удалены', 'info');
    },
    onError: (e) => toast(e.message, 'error')
  });

  // 4. Обработка жалобы (Пометить решённой / Отклонить / Забанить по жалобе)
  const handleReportActionMutation = useMutation({
    mutationFn: async ({ reportId, newStatus, banTargetId }) => {
      if (banTargetId) {
        await supabase.from('profiles').update({ is_banned: true }).eq('id', banTargetId);
      }
      const { error } = await supabase
        .from('reports')
        .update({ status: newStatus })
        .eq('id', reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v8'] });
      toast('Вердикт по жалобе применён!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId) => {
      const { error } = await supabase.from('reports').delete().eq('id', reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v8'] });
      toast('Жалоба удалена из реестра', 'info');
    }
  });

  // 5. Модерация проектов
  const updateProjectStatusMutation = useMutation({
    mutationFn: async ({ projectId, newStatus, pitchAt, callLink }) => {
      const updateData = { status: newStatus };
      if (pitchAt) updateData.pitch_at = pitchAt;
      if (callLink) updateData.call_link = callLink;

      const { error } = await supabase.from('projects').update(updateData).eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v8'] });
      toast('Статус проекта обновлён!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId) => {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v8'] });
      toast('Проект удалён из базы', 'info');
    },
    onError: (e) => toast(e.message, 'error')
  });

  // 6. Публикация и удаление статей газеты
  const publishNewsMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      if (!newsForm.title.trim() || !newsForm.summary.trim()) {
        throw new Error('Заполните заголовок и краткое описание');
      }
      const { error } = await supabase.from('news').insert([
        {
          title: newsForm.title.trim(),
          category: newsForm.category,
          summary: newsForm.summary.trim(),
          content: newsForm.content.trim() || newsForm.summary.trim(),
          is_pinned: newsForm.is_pinned,
          author_id: user?.id,
          author_name: `${profile?.full_name || 'Администратор'} (${profile?.username || '@admin'})`
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v8'] });
      setNewsForm({ title: '', category: 'Главный выпуск', summary: '', content: '', is_pinned: false });
      toast('Выпуск опубликован на главной странице!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  const deleteNewsMutation = useMutation({
    mutationFn: async (id) => {
      await supabase.from('news').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v8'] });
      toast('Статья удалена', 'info');
    }
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const usersList = adminData?.users || [];
  const reportsList = adminData?.reports || [];
  const pendingReportsCount = reportsList.filter((r) => r.status === 'pending').length;
  const projectsList = adminData?.projects || [];
  const newsList = adminData?.newsList || [];
  const securityLogs = adminData?.securityLogs || [];

  const filteredUsers = usersList.filter(
    (u) =>
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* ШАПКА АДМИН-ПАНЕЛИ */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="eyebrow mb-1">Центр управления платформой и модерации</div>
          <h1 className="text-3xl font-light text-white">
            Терминал <strong className="font-semibold text-[#FFAA00]">Администратора {isDev ? '& Разработчика' : ''}</strong>
          </h1>
        </div>

        {/* Навигационные вкладки */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all ${
              tab === 'users'
                ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold shadow-[0_0_12px_rgba(0,200,83,0.2)]'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            01 / Роли и Баны ({usersList.length})
          </button>

          <button
            onClick={() => setTab('reports')}
            className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all flex items-center gap-1.5 ${
              tab === 'reports'
                ? 'border-red-500 bg-red-500/15 text-red-300 font-bold shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            <Flag size={13} /> 02 / Жалобы ({pendingReportsCount})
          </button>

          <button
            onClick={() => setTab('projects')}
            className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all ${
              tab === 'projects'
                ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE] font-bold'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            03 / Проекты ({projectsList.length})
          </button>

          <button
            onClick={() => setTab('news')}
            className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all ${
              tab === 'news'
                ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00] font-bold'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            04 / Газета ({newsList.length})
          </button>

          <button
            onClick={() => setTab('security')}
            className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all ${
              tab === 'security'
                ? 'border-purple-400 bg-purple-500/15 text-purple-300 font-bold'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            05 / Журнал аудита
          </button>
        </div>
      </div>

      {/* ВКЛАДКА 1: УЧАСТНИКИ, ВЫДАЧА РОЛЕЙ, БАНЫ И УДАЛЕНИЕ */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Input
              placeholder="Поиск участника по @username или ФИО..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <div className="font-mono text-xs text-[#8A93A6]">
              Нажмите на чип роли для включения/отключения. Старшая роль отображается в чате и постах.
            </div>
          </div>

          <div className="space-y-3">
            {filteredUsers.map((u) => (
              <Card
                key={u.id}
                className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 border-white/10 bg-[#060a14]/90"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#FFAA00]">{u.username}</span>
                    <Badge color={u.highestRole.color}>Старшая: {u.highestRole.label}</Badge>
                    <span className="font-mono text-xs text-[#34D399]">{u.xp || 100} XP</span>
                    {u.is_banned && <Badge color="red">ЗАБЛОКИРОВАН</Badge>}
                  </div>
                  <div className="text-sm font-medium text-white">{u.full_name}</div>
                  <div className="text-xs text-[#8A93A6] flex flex-wrap items-center gap-3">
                    <span>{u.orgName}</span>
                    {u.mentorProfile && (
                      <span className="text-[#22D3EE] font-mono">
                        Куратор: {u.mentorProfile.username}
                      </span>
                    )}
                  </div>
                </div>

                {/* Кнопки переключения 5 ролей + Бан + Удаление */}
                <div className="flex flex-wrap items-center gap-2">
                  {ROLE_CONFIG.map((r) => {
                    const isOn = u.activeRoleIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        onClick={() =>
                          toggleRoleMutation.mutate({
                            targetUserId: u.id,
                            roleId: r.id,
                            isCurrentlyOn: isOn
                          })
                        }
                        className={`px-3 py-2 rounded border font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                          isOn
                            ? `${r.activeClass} font-bold shadow-[0_0_12px_rgba(0,200,83,0.15)]`
                            : 'bg-[#050810] border-white/10 text-[#4A5464] hover:text-white'
                        }`}
                      >
                        {isOn ? <CheckCircle2 size={13} /> : <Circle size={13} className="opacity-40" />}
                        <span>{r.label}</span>
                      </button>
                    );
                  })}

                  <Button
                    size="sm"
                    variant={u.is_banned ? 'outline' : 'gold'}
                    onClick={() => toggleBanMutation.mutate({ targetUserId: u.id, currentBan: u.is_banned })}
                    className="ml-2"
                  >
                    <Ban size={13} /> {u.is_banned ? 'Разбанить' : 'Бан'}
                  </Button>

                  <button
                    onClick={() => {
                      if (confirm(`Удалить аккаунт ${u.username} и очистить его сообщения?`)) {
                        deleteUserMutation.mutate(u.id);
                      }
                    }}
                    className="p-2 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Удалить профиль"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ВКЛАДКА 2: ЦЕНТР РАЗБОРА ЖАЛОБ (REPORTS) */}
      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-light text-white flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              Центр модерации пользовательских жалоб
            </h2>
            <Badge color="red">Новых обращений: {pendingReportsCount}</Badge>
          </div>

          {reportsList.length === 0 ? (
            <Card className="p-8 text-center font-mono text-xs text-[#8A93A6]">
              Жалоб от пользователей пока не поступало. В экосистеме порядок!
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportsList.map((rep) => {
                const isResolved = rep.status === 'resolved';
                return (
                  <Card
                    key={rep.id}
                    className={`p-5 space-y-3 border ${
                      isResolved ? 'border-white/10 bg-[#060a14]/60' : 'border-red-500/40 bg-[#14070a]/90'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <Badge color={isResolved ? 'emerald' : 'red'}>
                        {isResolved ? 'РАССМОТРЕНО И ИСПРАВЛЕНО' : 'ОЖИДАЕТ МЕР МОДЕРАТОРА'}
                      </Badge>
                      <span className="font-mono text-[10px] text-[#8A93A6]">
                        {new Date(rep.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="font-mono text-xs space-y-1">
                      <div>
                        Нарушитель:{' '}
                        <strong className="text-[#FFAA00]">
                          {rep.targetProfile?.username} ({rep.targetProfile?.full_name || 'Участник'})
                        </strong>
                        {rep.targetProfile?.is_banned && (
                          <span className="ml-2 text-red-400">[Уже забанен]</span>
                        )}
                      </div>
                      <div className="text-[#8A93A6]">
                        Отправитель жалобы: <span className="text-zinc-200">{rep.reporterProfile?.username}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded bg-black/50 border border-white/10 text-xs text-zinc-100 whitespace-pre-wrap">
                      {rep.reason}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {!isResolved && (
                        <>
                          <Button
                            size="sm"
                            variant="gold"
                            onClick={() =>
                              handleReportActionMutation.mutate({
                                reportId: rep.id,
                                newStatus: 'resolved',
                                banTargetId: rep.target_id
                              })
                            }
                          >
                            <Ban size={13} /> Забанить нарушителя и закрыть
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleReportActionMutation.mutate({
                                reportId: rep.id,
                                newStatus: 'resolved',
                                banTargetId: null
                              })
                            }
                          >
                            <Check size={13} /> Отметить исправленным
                          </Button>
                        </>
                      )}

                      <button
                        onClick={() => deleteReportMutation.mutate(rep.id)}
                        className="ml-auto p-2 rounded border border-white/10 text-[#8A93A6] hover:text-red-400"
                        title="Удалить запись жалобы"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ВКЛАДКА 3: МОДЕРАТОР ПРОЕКТОВ */}
      {tab === 'projects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-light text-white flex items-center gap-2">
              <FolderKanban size={18} className="text-[#22D3EE]" />
              Управление проектами и назначение защит
            </h2>
            <Badge color="cyan">Всего проектов: {projectsList.length}</Badge>
          </div>

          <div className="space-y-3">
            {projectsList.map((pr) => {
              const st = STATUS_RU[pr.status] || { label: pr.status, color: 'zinc' };
              return (
                <Card
                  key={pr.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-white/10 bg-[#060a14]/90"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-white">{pr.title}</span>
                      <Badge color={st.color}>{st.label}</Badge>
                    </div>
                    <p className="text-xs text-zinc-300 line-clamp-2">{pr.description}</p>
                    <div className="text-[11px] font-mono text-[#8A93A6] flex flex-wrap items-center gap-3">
                      <span>
                        Автор: <strong className="text-[#FFAA00]">{pr.authorName}</strong>
                      </span>
                      {pr.mentorName && (
                        <span>
                          Наставник: <strong className="text-[#22D3EE]">{pr.mentorName}</strong>
                        </span>
                      )}
                      <span>Эффект: {pr.impact_metric}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => updateProjectStatusMutation.mutate({ projectId: pr.id, newStatus: 'approved' })}
                    >
                      <Check size={13} /> Одобрить
                    </Button>

                    <Button
                      size="sm"
                      variant="gold"
                      onClick={() => {
                        const dt = prompt('Дата и время защиты (YYYY-MM-DDTHH:MM):', '2026-11-20T14:00');
                        const link = prompt('Ссылка на созвон:', 'https://telemost.yandex.ru/j/ugra-defense');
                        if (dt) {
                          updateProjectStatusMutation.mutate({
                            projectId: pr.id,
                            newStatus: 'scheduled',
                            pitchAt: dt,
                            callLink: link
                          });
                        }
                      }}
                    >
                      <Calendar size={13} /> Назначить защиту
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateProjectStatusMutation.mutate({ projectId: pr.id, newStatus: 'revision' })}
                    >
                      <RotateCcw size={13} /> На доработку
                    </Button>

                    <button
                      onClick={() => {
                        if (confirm(`Удалить проект «${pr.title}»?`)) deleteProjectMutation.mutate(pr.id);
                      }}
                      className="p-2 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ВКЛАДКА 4: РЕДАКЦИЯ ГАЗЕТЫ */}
      {tab === 'news' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-5 p-6 space-y-4 border-white/10 bg-[#060a14]">
            <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00] flex items-center gap-2">
              <Newspaper size={14} /> Выпустить номер газеты
            </div>
            <form onSubmit={(e) => publishNewsMutation.mutate(e)} className="space-y-4">
              <Input
                label="Заголовок выпуска"
                placeholder="Например: Итоги экологического мониторинга ХМАО"
                value={newsForm.title}
                onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                required
              />
              <textarea
                rows={3}
                placeholder="Краткий анонс для первой полосы..."
                value={newsForm.summary}
                onChange={(e) => setNewsForm({ ...newsForm, summary: e.target.value })}
                className="w-full bg-[#050810] border border-white/15 rounded p-2.5 text-xs text-white"
                required
              />
              <textarea
                rows={5}
                placeholder="Полный текст статьи..."
                value={newsForm.content}
                onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
                className="w-full bg-[#050810] border border-white/15 rounded p-2.5 text-xs text-white"
              />
              <Button type="submit" variant="gold" className="w-full justify-center">
                <Plus size={14} /> Опубликовать на главной
              </Button>
            </form>
          </Card>

          <Card className="lg:col-span-7 p-6 space-y-4 border-white/10 bg-[#060a14]">
            <div className="font-mono text-xs uppercase tracking-widest text-[#34D399]">
              Опубликованные выпуски ({newsList.length})
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {newsList.map((art) => (
                <div
                  key={art.id}
                  className="p-4 rounded border border-white/10 bg-[#050810] flex items-start justify-between gap-4"
                >
                  <div>
                    <h3 className="text-sm font-medium text-white">{art.title}</h3>
                    <p className="text-xs text-[#8A93A6] mt-1 line-clamp-2">{art.summary}</p>
                  </div>
                  <button
                    onClick={() => deleteNewsMutation.mutate(art.id)}
                    className="p-2 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ВКЛАДКА 5: АУДИТ БЕЗОПАСНОСТИ */}
      {tab === 'security' && (
        <Card className="p-6 space-y-4 border-white/10 bg-[#060a14]">
          <div className="font-mono text-xs uppercase tracking-widest text-purple-300 flex items-center gap-2">
            <Lock size={14} /> Журнал системных событий платформы
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {securityLogs.map((l) => (
              <div
                key={l.id}
                className="p-3 rounded border border-white/5 bg-[#050810] flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <span className="text-[#FFAA00] font-bold mr-2">{l.username}</span>
                  <span className="text-white">{l.action}</span>
                  <span className="text-[#8A93A6] ml-2">[{l.entity}]</span>
                </div>
                <span className="text-[10px] text-[#4A5464]">
                  {new Date(l.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}