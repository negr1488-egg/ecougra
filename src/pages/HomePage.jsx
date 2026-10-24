import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Input, Modal, Skeleton, useToast } from '../components/ui/DesignSystem';
import {
  Sparkles,
  Flame,
  ArrowUpRight,
  Activity,
  FolderKanban,
  Newspaper,
  Plus,
  Pin,
  Trash2,
  BookOpen
} from 'lucide-react';

export default function HomePage() {
  const { user, profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = hasRole(['admin', 'dev']);

  // Состояние модального окна для публикации новости админом
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [newsForm, setNewsForm] = useState({
    title: '',
    category: 'Главный выпуск',
    summary: '',
    content: '',
    is_pinned: false
  });

  // Загружаем газету (news), проекты и живую ленту (без входов/выходов)
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['home_dashboard_v2', profile?.id],
    staleTime: 20000,
    queryFn: async () => {
      const [newsRes, projRes, testsRes, logsRes] = await Promise.all([
        supabase
          .from('news')
          .select('*')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('projects')
          .select('id, title, impact_metric, status, created_at')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase.from('test_results').select('*').eq('user_id', profile?.id),
        supabase
          .from('activity_log')
          .select('*, profiles(username, full_name)')
          .not('action', 'in', '("login","logout","registered","grant_role","revoke_role")')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);
      return {
        news: newsRes.data || [],
        projects: projRes.data || [],
        myTests: testsRes.data || [],
        feed: logsRes.data || []
      };
    }
  });

  // Мутация публикации новости (для Админа)
  const publishNewsMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      if (!newsForm.title.trim() || !newsForm.summary.trim()) {
        throw new Error('Заполните заголовок и краткий анонс выпуска');
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
      queryClient.invalidateQueries({ queryKey: ['home_dashboard_v2'] });
      setNewsModalOpen(false);
      setNewsForm({ title: '', category: 'Главный выпуск', summary: '', content: '', is_pinned: false });
      toast('Свежий выпуск опубликован на первой полосе!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  const deleteNewsMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('news').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home_dashboard_v2'] });
      toast('Статья удалена из газеты', 'info');
    },
    onError: (err) => toast(err.message, 'error')
  });

  const getAiRecommendations = () => {
    const completedIds = (dashboardData?.myTests || []).map((t) => t.test_id);
    const recs = [];
    if (!completedIds.includes('co2_audit')) {
      recs.push({
        title: 'Выполнить инженерный аудит выбросов CO₂ (Scope 1 & 2)',
        reason: 'ИИ-наставник рекомендует рассчитать декарбонизацию кустовой площадки.',
        xp: '+50 XP',
        to: '/learn'
      });
    }
    if (!completedIds.includes('reclamation_sim')) {
      recs.push({
        title: 'Пройти 5-этапный симулятор биорекультивации тайги',
        reason: 'Позволит вырастить Дерево достижений и получить бейдж «Инженер рекультивации».',
        xp: '+100 XP',
        to: '/learn'
      });
    }
    recs.push({
      title: 'Подать инициативу в мастерскую «Зелёный след»',
      reason: 'Экспертное жюри оценивает проекты участников до 50 баллов.',
        xp: '+75 XP',
      to: '/activities'
    });
    return recs.slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const aiRecs = getAiRecommendations();
  const newsList = dashboardData?.news || [];
  const headlineArticle = newsList[0] || null;
  const secondaryArticles = newsList.slice(1);

  return (
    <div className="space-y-9">
      {/* 1. HERO & БЫСТРЫЕ ДЕЙСТВИЯ */}
      <Card className="p-8 border-white/10 bg-gradient-to-r from-[#070b14] via-[#091524] to-[#050810]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="emerald">ЦОС «ЮГРА.НЕФТЬ» · 2026</Badge>
              <Badge color="gold">
                <Flame size={12} className="fill-[#FFAA00]" /> Серия входов: {profile?.streak_days || 1} дн.
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extralight text-white tracking-tight">
              Добро пожаловать, <strong className="font-semibold text-[#34D399]">{profile?.full_name || profile?.username}</strong>
            </h1>
            <p className="text-xs sm:text-sm text-[#8A93A6] max-w-2xl leading-relaxed">
              Организация: <span className="text-white">{profile?.organizations?.name || 'МБОУ «СОШ № 1» пгт. Пойковский'}</span>.
              Ваш текущий баланс: <strong className="text-[#FFAA00] font-mono">{profile?.xp || 100} XP</strong>.
            </p>
          </div>

          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-2.5">
            <Button onClick={() => navigate('/learn')} className="w-full justify-between">
              <span>Калькулятор и Симуляторы</span>
              <ArrowUpRight size={15} />
            </Button>
            <Button variant="outline" onClick={() => navigate('/activities')} className="w-full justify-between">
              <span>Проекты и Карта ХМАО</span>
              <ArrowUpRight size={15} />
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. РЕДАКЦИОННАЯ ГАЗЕТА «ВЕСТНИК ЗЕЛЁНОЙ ЮГРЫ» */}
      <div className="border border-white/15 bg-[#060a12] p-6 sm:p-8 space-y-6 relative">
        {/* Шапка газеты в стиле индустриального издания */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-2 border-double border-white/20 pb-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#FFAA00]">
              <Newspaper size={14} /> Официальная цифровая газета экосистемы · Издание ХМАО-Югры
            </div>
            <h2 className="text-2xl sm:text-3xl font-light tracking-wide text-white uppercase mt-1">
              ВЕСТНИК <strong className="font-semibold text-[#00C853]">«ЗЕЛЁНАЯ ЮГРА»</strong>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] text-[#8A93A6]">
              {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            {isAdmin && (
              <Button size="sm" variant="gold" onClick={() => setNewsModalOpen(true)}>
                <Plus size={14} /> Опубликовать выпуск (Админ)
              </Button>
            )}
          </div>
        </div>

        {/* Контент газеты: Главная передовица + колонки */}
        {newsList.length === 0 ? (
          <div className="py-10 text-center font-mono text-xs text-[#8A93A6]">
            Выпусков пока нет. Администратор может опубликовать первую статью с помощью кнопки выше.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ГЛАВНАЯ ПОЛОСА (ПЕРЕДОВИЦА) */}
            {headlineArticle && (
              <div
                onClick={() => setSelectedArticle(headlineArticle)}
                className="lg:col-span-7 p-6 border border-[#FFAA00]/30 bg-gradient-to-br from-[#091220] to-[#050810] flex flex-col justify-between cursor-pointer group hover:border-[#FFAA00] transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge color="gold">
                        <Pin size={11} /> Первая полоса · {headlineArticle.category}
                      </Badge>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNewsMutation.mutate(headlineArticle.id);
                        }}
                        className="text-[#8A93A6] hover:text-red-400 p-1"
                        title="Удалить выпуск"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <h3 className="text-xl sm:text-2xl font-light text-white group-hover:text-[#FFAA00] transition-colors leading-snug">
                    {headlineArticle.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    {headlineArticle.summary}
                  </p>
                </div>

                <div className="pt-5 mt-6 border-t border-white/10 flex items-center justify-between font-mono text-[10px] text-[#8A93A6]">
                  <span>Автор: <strong className="text-[#34D399]">{headlineArticle.author_name}</strong></span>
                  <span className="text-[#FFAA00] inline-flex items-center gap-1">
                    <BookOpen size={12} /> Читать статью полностью →
                  </span>
                </div>
              </div>
            )}

            {/* КОЛОНКА СВЕЖИХ НОВОСТЕЙ СПРАВА */}
            <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
              {secondaryArticles.length === 0 ? (
                <div className="p-6 border border-white/5 bg-[#050810] text-xs text-[#8A93A6] font-mono h-full flex items-center justify-center text-center">
                  Дополнительные колонки появятся после публикации новых заметок администратором.
                </div>
              ) : (
                secondaryArticles.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => setSelectedArticle(art)}
                    className="p-4 border border-white/10 bg-[#050810] hover:border-[#00C853]/50 cursor-pointer transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <Badge color="emerald">{art.category}</Badge>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[#4A5464]">
                          {new Date(art.created_at).toLocaleDateString()}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNewsMutation.mutate(art.id);
                            }}
                            className="text-[#8A93A6] hover:text-red-400"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <h4 className="text-sm font-medium text-white">{art.title}</h4>
                    <p className="text-xs text-[#8A93A6] line-clamp-2">{art.summary}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. ИИ-РЕКОМЕНДАЦИИ АКТИВНОСТЕЙ */}
      <div className="space-y-3">
        <div className="eyebrow flex items-center gap-2">
          <Sparkles size={13} /> Персональные ИИ-рекомендации «Роман Иванович»
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aiRecs.map((rec, i) => (
            <Card key={i} glow onClick={() => navigate(rec.to)} className="cursor-pointer flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge color="cyan">AI Рекомендация</Badge>
                  <span className="font-mono text-xs text-[#34D399] font-bold">{rec.xp}</span>
                </div>
                <h3 className="text-base font-medium text-white mb-1">{rec.title}</h3>
                <p className="text-xs text-[#8A93A6] leading-relaxed">{rec.reason}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 font-mono text-[10px] uppercase text-[#FFAA00] flex items-center justify-between">
                <span>Начать выполнение</span>
                <span>→</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 4. ДОСТИЖЕНИЯ УЧАСТНИКОВ И ПРОЕКТЫ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00] flex items-center gap-2">
              <Activity size={14} /> Инженерные достижения участников ХМАО
            </div>
            <Badge color="emerald">Realtime</Badge>
          </div>

          <div className="space-y-2.5">
            {dashboardData?.feed?.length === 0 ? (
              <div className="text-xs text-[#8A93A6] font-mono py-6 text-center">
                Здесь отображаются выполненные расчёты CO₂, симуляции и опубликованные проекты.
              </div>
            ) : (
              dashboardData.feed.map((item) => (
                <div key={item.id} className="p-3.5 border border-white/5 bg-[#050810] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-[#FFAA00] font-semibold mr-2">
                      {item.profiles?.username || '@researcher'}
                    </span>
                    <span className="text-zinc-300">
                      выполнил <strong className="text-white">{item.action}</strong> ({item.entity})
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[#4A5464]">
                    {new Date(item.created_at).toLocaleTimeString().slice(0, 5)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="font-mono text-xs uppercase tracking-widest text-[#34D399] flex items-center gap-2">
              <FolderKanban size={14} /> Новые проекты «Зелёный след»
            </div>
            <button onClick={() => navigate('/activities')} className="font-mono text-[10px] text-[#FFAA00] hover:underline">
              Все →
            </button>
          </div>

          <div className="space-y-3">
            {dashboardData?.projects?.length === 0 ? (
              <div className="text-xs text-[#8A93A6] font-mono py-6 text-center">
                Проектов пока нет. Создайте первый в разделе «Активности»!
              </div>
            ) : (
              dashboardData.projects.map((p) => (
                <div key={p.id} className="p-3.5 border border-white/5 bg-[#050810] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white truncate">{p.title}</span>
                    <Badge color="emerald">{p.impact_metric}</Badge>
                  </div>
                  <div className="font-mono text-[10px] text-[#8A93A6]">Статус: {p.status}</div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* МОДАЛКА ЧТЕНИЯ ВЫПУСКА ГАЗЕТЫ */}
      <Modal
        isOpen={Boolean(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
        eyebrow={selectedArticle?.category || 'Вестник Зелёной Югры'}
        title={selectedArticle?.title || ''}
      >
        <div className="space-y-4">
          <div className="font-mono text-[11px] text-[#FFAA00] border-b border-white/10 pb-2 flex justify-between">
            <span>{selectedArticle?.author_name}</span>
            <span>{selectedArticle && new Date(selectedArticle.created_at).toLocaleString()}</span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {selectedArticle?.content || selectedArticle?.summary}
          </p>
        </div>
      </Modal>

      {/* МОДАЛКА ПУБЛИКАЦИИ НОВОСТИ ДЛЯ АДМИНА */}
      <Modal
        isOpen={newsModalOpen}
        onClose={() => setNewsModalOpen(false)}
        eyebrow="Редакция «Вестник Зелёной Югры»"
        title="Опубликовать свежий выпуск в газету"
      >
        <form onSubmit={(e) => publishNewsMutation.mutate(e)} className="space-y-4">
          <Input
            label="Заголовок выпуска"
            placeholder="Например: Итоги регионального этапа по рекультивации земель ХМАО"
            value={newsForm.title}
            onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1">
                Рубрика газеты
              </label>
              <select
                value={newsForm.category}
                onChange={(e) => setNewsForm({ ...newsForm, category: e.target.value })}
                className="w-full bg-[#050810] border border-white/15 px-3 py-2.5 text-xs text-white"
              >
                <option value="Главный выпуск">Главный выпуск</option>
                <option value="Конкурс проектов">Конкурс проектов</option>
                <option value="Технологии ПНГ">Технологии ПНГ</option>
                <option value="Объявление жюри">Объявление жюри</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-4">
              <input
                type="checkbox"
                checked={newsForm.is_pinned}
                onChange={(e) => setNewsForm({ ...newsForm, is_pinned: e.target.checked })}
                className="accent-[#FFAA00]"
              />
              <span>📌 Закрепить на первой полосе</span>
            </label>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1">
              Краткая сводка (отображается на карточке газеты)
            </label>
            <textarea
              rows={2}
              value={newsForm.summary}
              onChange={(e) => setNewsForm({ ...newsForm, summary: e.target.value })}
              className="w-full bg-[#050810] border border-white/10 p-3 text-xs text-white focus:outline-none focus:border-[#FFAA00]"
              placeholder="Краткая суть новости в 1-2 предложениях..."
              required
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1">
              Полный текст статьи (открывается при клике)
            </label>
            <textarea
              rows={4}
              value={newsForm.content}
              onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
              className="w-full bg-[#050810] border border-white/10 p-3 text-xs text-white focus:outline-none focus:border-[#00C853]"
              placeholder="Подробности, регламент, имена победителей или ссылки..."
            />
          </div>

          <Button type="submit" variant="gold" disabled={publishNewsMutation.isPending} className="w-full">
            {publishNewsMutation.isPending ? 'Публикация в номер...' : 'Опубликовать в газету'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}