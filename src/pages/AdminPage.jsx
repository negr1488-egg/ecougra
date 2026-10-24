import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, logActivityAndAwardXp } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Badge, Skeleton, useToast } from '../components/ui/DesignSystem';
import { Shield, Users, Award, Lock, CheckCircle2, Circle, Newspaper, Plus, Pin, Trash2 } from 'lucide-react';

const ROLE_CONFIG = [
  { id: 1, name: 'student', label: 'Студент', activeClass: 'bg-[#00C853]/20 border-[#00C853] text-[#34D399]' },
  { id: 2, name: 'teacher', label: 'Наставник', activeClass: 'bg-[#22D3EE]/20 border-[#22D3EE] text-[#22D3EE]' },
  { id: 3, name: 'jury', label: 'Эксперт Жюри', activeClass: 'bg-[#FFAA00]/20 border-[#FFAA00] text-[#FFAA00]' },
  { id: 4, name: 'admin', label: 'Админ', activeClass: 'bg-red-500/20 border-red-500 text-red-300' },
  { id: 5, name: 'dev', label: 'Разработчик', activeClass: 'bg-purple-500/20 border-purple-500 text-purple-300' }
];

export default function AdminPage() {
  const { user, profile, hasRole, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('users'); // 'users' | 'security' | 'news'
  const isDev = hasRole('dev');

  // Форма для написания новости прямо в админке
  const [newsForm, setNewsForm] = useState({
    title: '',
    category: 'Главный выпуск',
    summary: '',
    content: '',
    is_pinned: false
  });

  const { data: adminData, isLoading } = useQuery({
    queryKey: ['admin_panel_v3'],
    queryFn: async () => {
      const [profRes, orgsRes, urRes, logsRes, newsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('xp', { ascending: false }),
        supabase.from('organizations').select('id, name'),
        supabase.from('user_roles').select('user_id, role_id'),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(25),
        supabase.from('news').select('*').order('created_at', { ascending: false })
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

      return {
        users: enrichedUsers,
        securityLogs,
        newsList: newsRes.data || []
      };
    }
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ targetUserId, roleId, isCurrentlyOn }) => {
      if (isCurrentlyOn) {
        if (roleId === 1) {
          throw new Error('Базовая роль Студента (student) должна оставаться включённой');
        }
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

      await logActivityAndAwardXp(user.id, {
        action: isCurrentlyOn ? 'revoke_role' : 'grant_role',
        entity: 'rbac',
        entityId: targetUserId,
        meta: { roleId }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v3'] });
      refreshProfile();
      toast('Права доступа обновлены!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  // Публикация новости из вкладки админки
  const publishNewsMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      if (!newsForm.title.trim() || !newsForm.summary.trim()) {
        throw new Error('Заполните заголовок и краткий анонс');
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
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v3'], queryKey2: ['home_dashboard_v2'] });
      setNewsForm({ title: '', category: 'Главный выпуск', summary: '', content: '', is_pinned: false });
      toast('Новость успешно опубликована на главной странице!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  const deleteNewsMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('news').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_panel_v3'] });
      toast('Статья удалена из газеты', 'info');
    },
    onError: (err) => toast(err.message, 'error')
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const usersList = adminData?.users || [];
  const securityLogs = adminData?.securityLogs || [];
  const newsList = adminData?.newsList || [];

  const filteredUsers = usersList.filter(
    (u) =>
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalXp = usersList.reduce((acc, u) => acc + (u.xp || 0), 0);
  const juryCount = usersList.filter((u) => u.activeRoleIds.includes(3)).length;

  return (
    <div className="space-y-8">
      {/* ШАПКА АДМИН-ПАНЕЛИ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="eyebrow mb-1">Центр управления платформой</div>
          <h1 className="text-3xl font-extralight text-white">
            Терминал <strong className="font-semibold text-[#FFAA00]">Администратора {isDev ? '& Dev' : ''}</strong>
          </h1>
        </div>

        {/* НАВИГАЦИОННЫЕ ВКЛАДКИ */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all ${
              tab === 'users'
                ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399]'
                : 'border-white/10 text-[#8A93A6]'
            }`}
          >
            01 / Участники ({usersList.length})
          </button>
          <button
            onClick={() => setTab('news')}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all ${
              tab === 'news'
                ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00]'
                : 'border-white/10 text-[#8A93A6]'
            }`}
          >
            03 / Редакция газеты ({newsList.length})
          </button>
          <button
            onClick={() => setTab('security')}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all ${
              tab === 'security'
                ? 'border-red-400 bg-red-500/15 text-red-300'
                : 'border-white/10 text-[#8A93A6]'
            }`}
          >
            02 / Лог безопасности
          </button>
        </div>
      </div>

      {/* КАРТОЧКИ KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase text-[#8A93A6]">Участников в базе</div>
            <div className="text-2xl font-mono font-bold text-white mt-1">{usersList.length} чел.</div>
          </div>
          <Users size={26} className="text-[#00C853]" />
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase text-[#8A93A6]">Экспертов жюри</div>
            <div className="text-2xl font-mono font-bold text-[#FFAA00] mt-1">{juryCount} экспертов</div>
          </div>
          <Shield size={26} className="text-[#FFAA00]" />
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase text-[#8A93A6]">Опубликовано статей</div>
            <div className="text-2xl font-mono font-bold text-[#22D3EE] mt-1">{newsList.length} вып.</div>
          </div>
          <Newspaper size={26} className="text-[#22D3EE]" />
        </Card>
      </div>

      {/* ВКЛАДКА 1: УЧАСТНИКИ И РОЛИ */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Input
              placeholder="Поиск участника по @username или ФИО..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <div className="font-mono text-[11px] text-[#8A93A6]">
              Зелёная кнопка с галочкой = роль активна.
            </div>
          </div>

          <div className="space-y-3">
            {filteredUsers.map((u) => (
              <Card key={u.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <Avatar src={u.avatar_url} username={u.username} status={u.status} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#FFAA00]">{u.username}</span>
                      <span className="font-mono text-xs text-[#34D399]">{u.xp || 100} XP</span>
                    </div>
                    <div className="text-sm font-medium text-white">{u.full_name}</div>
                    <div className="text-xs text-[#8A93A6]">{u.orgName}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[#8A93A6]">
                    Управление ролями:
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                          className={`px-3 py-2 border font-mono text-[11px] uppercase tracking-wider flex items-center gap-2 transition-all ${
                            isOn
                              ? `${r.activeClass} font-bold shadow-[0_0_15px_rgba(0,200,83,0.15)]`
                              : 'bg-[#050810] border-white/10 text-[#4A5464] hover:border-white/30 hover:text-zinc-300'
                          }`}
                        >
                          {isOn ? <CheckCircle2 size={14} className="shrink-0" /> : <Circle size={14} className="shrink-0 opacity-40" />}
                          <span>{r.label}</span>
                          <span className={`ml-1 px-1.5 py-0.5 text-[9px] ${isOn ? 'bg-black/40 text-white' : 'bg-white/5 text-[#4A5464]'}`}>
                            {isOn ? 'ВКЛ' : 'ВЫКЛ'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ВКЛАДКА 3: РЕДАКЦИЯ ГАЗЕТЫ (НАПИСАНИЕ И ПУБЛИКАЦИЯ НОВОСТЕЙ) */}
      {tab === 'news' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ФОРМА СОЗДАНИЯ НОВОСТИ */}
          <Card className="lg:col-span-5 space-y-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00] flex items-center gap-2">
              <Newspaper size={14} /> Написать новый выпуск газеты
            </div>
            <form onSubmit={(e) => publishNewsMutation.mutate(e)} className="space-y-4">
              <Input
                label="Заголовок статьи"
                placeholder="Например: Итоги эко-марафона в Пойковском"
                value={newsForm.title}
                onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                required
              />

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1">
                  Рубрика
                </label>
                <select
                  value={newsForm.category}
                  onChange={(e) => setNewsForm({ ...newsForm, category: e.target.value })}
                  className="w-full bg-[#050810] border border-white/15 px-3 py-2 text-xs text-white"
                >
                  <option value="Главный выпуск">Главный выпуск</option>
                  <option value="Конкурс проектов">Конкурс проектов</option>
                  <option value="Технологии ПНГ">Технологии ПНГ</option>
                  <option value="Объявление жюри">Объявление жюри</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1">
                  Краткий анонс (для главной страницы)
                </label>
                <textarea
                  rows={2}
                  value={newsForm.summary}
                  onChange={(e) => setNewsForm({ ...newsForm, summary: e.target.value })}
                  className="w-full bg-[#050810] border border-white/10 p-3 text-xs text-white focus:outline-none focus:border-[#FFAA00]"
                  placeholder="Суть новости в двух предложениях..."
                  required
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1">
                  Полный текст статьи
                </label>
                <textarea
                  rows={4}
                  value={newsForm.content}
                  onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
                  className="w-full bg-[#050810] border border-white/10 p-3 text-xs text-white focus:outline-none focus:border-[#00C853]"
                  placeholder="Подробный текст выпуска..."
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newsForm.is_pinned}
                  onChange={(e) => setNewsForm({ ...newsForm, is_pinned: e.target.checked })}
                  className="accent-[#FFAA00]"
                />
                <span>📌 Закрепить на первой полосе газеты</span>
              </label>

              <Button type="submit" variant="gold" disabled={publishNewsMutation.isPending} className="w-full">
                <Plus size={14} /> {publishNewsMutation.isPending ? 'Публикация...' : 'Опубликовать выпуск'}
              </Button>
            </form>
          </Card>

          {/* СПИСОК УЖЕ ОПУБЛИКОВАННЫХ СТАТЕЙ С ВОЗМОЖНОСТЬЮ УДАЛЕНИЯ */}
          <Card className="lg:col-span-7 space-y-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#34D399]">
              Архив выпусков газеты ({newsList.length})
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {newsList.length === 0 ? (
                <div className="text-xs text-[#8A93A6] font-mono py-8 text-center">
                  Газета пока пуста. Напишите первую статью с помощью формы слева.
                </div>
              ) : (
                newsList.map((art) => (
                  <div key={art.id} className="p-4 border border-white/10 bg-[#050810] flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {art.is_pinned && <Badge color="gold">📌 Главная полоса</Badge>}
                        <Badge color="emerald">{art.category}</Badge>
                        <span className="font-mono text-[10px] text-[#4A5464]">
                          {new Date(art.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-white">{art.title}</h3>
                      <p className="text-xs text-[#8A93A6] line-clamp-2">{art.summary}</p>
                    </div>

                    <button
                      onClick={() => deleteNewsMutation.mutate(art.id)}
                      className="p-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                      title="Удалить статью"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ВКЛАДКА 2: ЖУРНАЛ БЕЗОПАСНОСТИ */}
      {tab === 'security' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="font-mono text-xs uppercase tracking-widest text-red-400 flex items-center gap-2">
              <Lock size={14} /> Закрытый журнал системных действий
            </div>
            <Badge color="red">Приватный контур</Badge>
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