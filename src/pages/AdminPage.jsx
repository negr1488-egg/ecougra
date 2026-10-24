import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, logActivityAndAwardXp } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Badge, Skeleton, useToast } from '../components/ui/DesignSystem';
import {
  Shield,
  Users,
  Award,
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
  Video
} from 'lucide-react';

const ROLE_CONFIG = [
  { id: 1, name: 'student', label: 'Студент', activeClass: 'bg-[#00C853]/20 border-[#00C853] text-[#34D399]' },
  { id: 2, name: 'teacher', label: 'Наставник', activeClass: 'bg-[#22D3EE]/20 border-[#22D3EE] text-[#22D3EE]' },
  { id: 3, name: 'jury', label: 'Эксперт Жюри', activeClass: 'bg-[#FFAA00]/20 border-[#FFAA00] text-[#FFAA00]' },
  { id: 4, name: 'admin', label: 'Админ', activeClass: 'bg-red-500/20 border-red-500 text-red-300' },
  { id: 5, name: 'dev', label: 'Разработчик', activeClass: 'bg-purple-500/20 border-purple-500 text-purple-300' }
];

const STATUS_RU = {
  draft: 'Черновик',
  submitted: 'На рассмотрении',
  scheduled: 'Назначена защита',
  defended: 'Защищён',
  approved: 'Одобрен',
  revision: 'На доработке',
  rejected: 'Отклонён'
};

export default function AdminPage() {
  const { user, profile, hasRole, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('users'); // 'users' | 'projects' | 'news' | 'security'
  const isDev = hasRole('dev');

  // Форма новости
  const [newsForm, setNewsForm] = useState({
    title: '',
    category: 'Главный выпуск',
    summary: '',
    content: '',
    is_pinned: false
  });

  const { data: adminData, isLoading } = useQuery({
    queryKey: ['admin_panel_v5'],
    queryFn: async () => {
      const [profRes, orgsRes, urRes, logsRes, newsRes, projRes] = await Promise.all([
        supabase.from('profiles').select('*').order('xp', { ascending: false }),
        supabase.from('organizations').select('id, name'),
        supabase.from('user_roles').select('user_id, role_id'),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(25),
        supabase.from('news').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('created_at', { ascending: false })
      ]);

      const profiles = profRes.data || [];
      const orgs = orgsRes.data || [];
      const userRoles = urRes.data || [];
      const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
      const userMap = Object.fromEntries(profiles.map((p) => [p.id, p.username]));

      const enrichedUsers = profiles.map((p) => {
        const ids = userRoles.filter((ur) => ur.user_id === p.id).map((ur) => ur.role_id);
        return {
          ...p,
          orgName: orgMap[p.org_id] || 'МБОУ «СОШ № 1»',
          activeRoleIds: ids.length > 0 ? ids : [1]
        };
      });

      const securityLogs = (logsRes.data || []).map((l) => ({
        ...l,
        username: userMap[l.user_id] || '@user'
      }));

      const enrichedProjects = (projRes.data || []).map((pr) => ({
        ...pr,
        authorName: userMap[pr.author_id] || '@исследователь'
      }));

      return {
        users: enrichedUsers,
        securityLogs,
        newsList: newsRes.data || [],
        projects: enrichedProjects
      };
    }
  });

  // Управление ролями
  const toggleRoleMutation = useMutation({
    mutationFn: async ({ targetUserId, roleId, isCurrentlyOn }) => {
      if (isCurrentlyOn) {
        if (roleId === 1) throw new Error('Базовая роль студента обязательна');
        await supabase.from('user_roles').delete().eq('user_id', targetUserId).eq('role_id', roleId);
      } else {
        await supabase.from('user_roles').upsert([{ user_id: targetUserId, role_id: roleId }]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v5'] });
      refreshProfile();
      toast('Права доступа обновлены!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  // Управление статусом проекта (Одобрить, назначить защиту, отправить на доработку)
  const updateProjectStatusMutation = useMutation({
    mutationFn: async ({ projectId, newStatus, pitchAt, callLink }) => {
      const updateData = { status: newStatus };
      if (pitchAt) updateData.pitch_at = pitchAt;
      if (callLink) updateData.call_link = callLink;

      const { error } = await supabase.from('projects').update(updateData).eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v5'], queryKey2: ['projects_defense_v5'] });
      toast('Статус проекта успешно обновлён!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId) => {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v5'], queryKey2: ['projects_defense_v5'] });
      toast('Проект удалён из системы', 'info');
    },
    onError: (e) => toast(e.message, 'error')
  });

  // Публикация новости
  const publishNewsMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      if (!newsForm.title.trim() || !newsForm.summary.trim()) throw new Error('Заполните поля');
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
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v5'] });
      setNewsForm({ title: '', category: 'Главный выпуск', summary: '', content: '', is_pinned: false });
      toast('Статья опубликована на главной!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  const deleteNewsMutation = useMutation({
    mutationFn: async (id) => {
      await supabase.from('news').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v5'] });
      toast('Статья удалена', 'info');
    }
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const usersList = adminData?.users || [];
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
      {/* Шапка админки */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="eyebrow mb-1">Центр управления платформой и экспертный надзор</div>
          <h1 className="text-3xl font-light text-white">
            Терминал <strong className="font-semibold text-[#FFAA00]">Администратора {isDev ? '& Разработчика' : ''}</strong>
          </h1>
        </div>

        {/* Навигационные вкладки */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all ${
              tab === 'users'
                ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold shadow-[0_0_10px_rgba(0,200,83,0.2)]'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            01 / Участники ({usersList.length})
          </button>
          <button
            onClick={() => setTab('projects')}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all ${
              tab === 'projects'
                ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE] font-bold shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            04 / Модератор проектов ({projectsList.length})
          </button>
          <button
            onClick={() => setTab('news')}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all ${
              tab === 'news'
                ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00] font-bold'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            03 / Газета ({newsList.length})
          </button>
          <button
            onClick={() => setTab('security')}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all ${
              tab === 'security'
                ? 'border-red-400 bg-red-500/15 text-red-300 font-bold'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            02 / Аудит безопасности
          </button>
        </div>
      </div>

      {/* ВКЛАДКА 4: УПРАВЛЕНИЕ ПРОЕКТАМИ (НОВОЕ) */}
      {tab === 'projects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-light text-white flex items-center gap-2">
              <FolderKanban size={18} className="text-[#22D3EE]" />
              Модерация проектов и назначение защит перед жюри
            </h2>
            <Badge color="cyan">Всего заявок: {projectsList.length}</Badge>
          </div>

          <div className="space-y-3">
            {projectsList.map((pr) => (
              <Card key={pr.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-white/10 bg-[#060a14]/90">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">{pr.title}</span>
                    <Badge color={pr.status === 'approved' ? 'emerald' : pr.status === 'submitted' ? 'gold' : 'cyan'}>
                      {STATUS_RU[pr.status] || pr.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-[#8A93A6] line-clamp-2">{pr.description}</div>
                  <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-3">
                    <span>Автор: <strong className="text-[#FFAA00]">{pr.authorName}</strong></span>
                    <span>Эффект: {pr.impact_metric}</span>
                    {pr.pitch_at && <span>Защита: {new Date(pr.pitch_at).toLocaleDateString()}</span>}
                  </div>
                </div>

                {/* Действия администратора */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => updateProjectStatusMutation.mutate({ projectId: pr.id, newStatus: 'approved' })}
                    title="Утвердить проект"
                  >
                    <Check size={13} /> Одобрить
                  </Button>

                  <Button
                    size="sm"
                    variant="gold"
                    onClick={() => {
                      const dt = prompt('Укажите дату и время защиты (в формате YYYY-MM-DDTHH:MM):', '2026-11-20T14:00');
                      const link = prompt('Ссылка на видеозвонок:', 'https://telemost.yandex.ru/j/ecougra-defense');
                      if (dt) updateProjectStatusMutation.mutate({ projectId: pr.id, newStatus: 'scheduled', pitchAt: dt, callLink: link });
                    }}
                    title="Назначить созвон защиты"
                  >
                    <Calendar size={13} /> Назначить защиту
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateProjectStatusMutation.mutate({ projectId: pr.id, newStatus: 'revision' })}
                    title="Отправить на доработку"
                  >
                    <RotateCcw size={13} /> На доработку
                  </Button>

                  <button
                    onClick={() => {
                      if (confirm(`Удалить проект «${pr.title}»?`)) deleteProjectMutation.mutate(pr.id);
                    }}
                    className="p-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Удалить проект"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ВКЛАДКА 1: УЧАСТНИКИ И РОЛИ */}
      {tab === 'users' && (
        <div className="space-y-4">
          <Input
            placeholder="Быстрый поиск участника по @username или ФИО..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />

          <div className="space-y-3">
            {filteredUsers.map((u) => (
              <Card key={u.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-white/10 bg-[#060a14]/90">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#FFAA00]">{u.username}</span>
                    <span className="font-mono text-xs text-[#34D399]">{u.xp || 100} XP</span>
                  </div>
                  <div className="text-sm font-medium text-white">{u.full_name}</div>
                  <div className="text-xs text-[#8A93A6]">{u.orgName}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ROLE_CONFIG.map((r) => {
                    const isOn = u.activeRoleIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        onClick={() => toggleRoleMutation.mutate({ targetUserId: u.id, roleId: r.id, isCurrentlyOn: isOn })}
                        className={`px-3 py-2 border font-mono text-[11px] uppercase tracking-wider flex items-center gap-2 transition-all ${
                          isOn
                            ? `${r.activeClass} font-bold shadow-[0_0_12px_rgba(0,200,83,0.15)]`
                            : 'bg-[#050810] border-white/10 text-[#4A5464] hover:text-white'
                        }`}
                      >
                        {isOn ? <CheckCircle2 size={14} /> : <Circle size={14} className="opacity-40" />}
                        <span>{r.label}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] ${isOn ? 'bg-black/40 text-white' : 'bg-white/5 text-[#4A5464]'}`}>
                          {isOn ? 'ВКЛ' : 'ВЫКЛ'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ВКЛАДКА 3: РЕДАКЦИЯ ГАЗЕТЫ */}
      {tab === 'news' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-5 space-y-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00] flex items-center gap-2">
              <Newspaper size={14} /> Опубликовать выпуск газеты
            </div>
            <form onSubmit={(e) => publishNewsMutation.mutate(e)} className="space-y-4">
              <Input
                label="Заголовок выпуска"
                placeholder="Заголовок статьи..."
                value={newsForm.title}
                onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                required
              />
              <textarea
                rows={3}
                placeholder="Краткий анонс статьи..."
                value={newsForm.summary}
                onChange={(e) => setNewsForm({ ...newsForm, summary: e.target.value })}
                className="w-full bg-[#050810] border border-white/10 p-2.5 text-xs text-white"
                required
              />
              <textarea
                rows={5}
                placeholder="Полный текст публикации..."
                value={newsForm.content}
                onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
                className="w-full bg-[#050810] border border-white/10 p-2.5 text-xs text-white"
              />
              <Button type="submit" variant="gold" className="w-full">
                <Plus size={14} /> Опубликовать выпуск
              </Button>
            </form>
          </Card>

          <Card className="lg:col-span-7 space-y-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#34D399]">
              Выпуски газеты ({newsList.length})
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {newsList.map((art) => (
                <div key={art.id} className="p-4 border border-white/10 bg-[#050810] flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-white">{art.title}</h3>
                    <p className="text-xs text-[#8A93A6] mt-1 line-clamp-2">{art.summary}</p>
                  </div>
                  <button
                    onClick={() => deleteNewsMutation.mutate(art.id)}
                    className="p-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ВКЛАДКА 2: АУДИТ */}
      {tab === 'security' && (
        <Card className="space-y-4">
          <div className="font-mono text-xs uppercase tracking-widest text-red-400 flex items-center gap-2">
            <Lock size={14} /> Журнал системных действий
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {securityLogs.map((l) => (
              <div key={l.id} className="p-3 border border-white/5 bg-[#050810] flex items-center justify-between text-xs font-mono">
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