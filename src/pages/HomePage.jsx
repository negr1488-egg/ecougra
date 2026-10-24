import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import UserWall from '../components/Wall/UserWall';
import { Card, Button, Badge, Modal, Skeleton, useToast } from '../components/ui/DesignSystem';
import {
  Sparkles,
  Flame,
  ArrowUpRight,
  Newspaper,
  Plus,
  Pin,
  Trash2,
  BookOpen,
  Rss,
  FolderKanban
} from 'lucide-react';

export default function HomePage() {
  const { user, profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = hasRole(['admin', 'dev']);

  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [activeFeedTab, setActiveFeedTab] = useState('wall'); // 'wall' | 'newspaper'
  const [newsForm, setNewsForm] = useState({
    title: '',
    category: 'Главный выпуск',
    summary: '',
    content: '',
    is_pinned: false
  });

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['home_dashboard_v4', profile?.id],
    staleTime: 20000,
    queryFn: async () => {
      const [newsRes, projRes] = await Promise.all([
        supabase
          .from('news')
          .select('*')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('projects')
          .select('id, title, impact_metric, status, created_at')
          .order('created_at', { ascending: false })
          .limit(4)
      ]);
      return {
        news: newsRes.data || [],
        projects: projRes.data || []
      };
    }
  });

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
      queryClient.invalidateQueries({ queryKey: ['home_dashboard_v4'] });
      setNewsModalOpen(false);
      setNewsForm({ title: '', category: 'Главный выпуск', summary: '', content: '', is_pinned: false });
      toast('Выпуск опубликован!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const newsList = dashboardData?.news || [];
  const projects = dashboardData?.projects || [];

  return (
    <div className="space-y-8">
      {/* ПРИВЕТСТВЕННЫЙ БАННЕР */}
      <Card className="p-8 border-white/10 bg-gradient-to-r from-[#070b14] via-[#091524] to-[#050810]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="emerald">ЦОС «ЮГРА.НЕФТЬ» · 2026</Badge>
              <Badge color="gold">
                <Flame size={12} className="fill-[#FFAA00]" /> Серия: {profile?.streak_days || 1} дн.
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extralight text-white">
              Добро пожаловать, <strong className="font-semibold text-[#34D399]">{profile?.full_name || profile?.username}</strong>
            </h1>
            <p className="text-xs sm:text-sm text-[#8A93A6]">
              Организация: <span className="text-white">{profile?.organizations?.name || 'МБОУ «СОШ № 1» пгт. Пойковский'}</span> · Баланс: <strong className="text-[#FFAA00] font-mono">{profile?.xp || 100} XP</strong>
            </p>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-2">
            <Button onClick={() => navigate('/learn')} className="w-full justify-between">
              <span>Калькулятор и Симуляторы</span>
              <ArrowUpRight size={15} />
            </Button>
            <Button variant="outline" onClick={() => navigate('/activities')} className="w-full justify-between">
              <span>Защита проектов и Карта</span>
              <ArrowUpRight size={15} />
            </Button>
          </div>
        </div>
      </Card>

      {/* ПЕРЕКЛЮЧАТЕЛЬ ЛЕНТЫ: СТЕНА СООБЩЕСТВА ИЛИ ГАЗЕТА */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveFeedTab('wall')}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all flex items-center gap-2 ${
              activeFeedTab === 'wall'
                ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            <Rss size={14} /> Лента постов сообщества
          </button>
          <button
            onClick={() => setActiveFeedTab('newspaper')}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all flex items-center gap-2 ${
              activeFeedTab === 'newspaper'
                ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00] font-bold'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            <Newspaper size={14} /> Вестник «Зелёная Югра» ({newsList.length})
          </button>
        </div>

        {activeFeedTab === 'newspaper' && isAdmin && (
          <Button size="sm" variant="gold" onClick={() => setNewsModalOpen(true)}>
            <Plus size={14} /> Добавить статью
          </Button>
        )}
      </div>

      {/* 1. ПОДБОРКА ПОСТОВ ПОЛЬЗОВАТЕЛЕЙ НА ГЛАВНОЙ */}
      {activeFeedTab === 'wall' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <div className="eyebrow mb-3">Публикации исследователей и наставников Югры</div>
            <UserWall targetUserId={null} isOwnWall={true} />
          </div>

          <div className="lg:col-span-4 space-y-4">
            <Card className="p-5 space-y-3">
              <div className="font-mono text-xs uppercase text-[#FFAA00] flex items-center gap-1.5">
                <FolderKanban size={14} /> Свежие проекты на защите
              </div>
              <div className="space-y-2">
                {projects.map((p) => (
                  <div key={p.id} className="p-3 border border-white/5 bg-[#050810] space-y-1">
                    <div className="text-xs font-medium text-white truncate">{p.title}</div>
                    <div className="flex justify-between font-mono text-[10px] text-[#8A93A6]">
                      <span>{p.impact_metric}</span>
                      <span className="text-[#34D399]">{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/activities')} className="w-full">
                Все проекты →
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* 2. ГАЗЕТА ВЕСТНИК ЗЕЛЁНАЯ ЮГРА */}
      {activeFeedTab === 'newspaper' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {newsList.map((art) => (
            <Card
              key={art.id}
              onClick={() => setSelectedArticle(art)}
              className="p-5 cursor-pointer hover:border-[#FFAA00] transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Badge color={art.is_pinned ? 'gold' : 'emerald'}>{art.category}</Badge>
                  <span className="font-mono text-[10px] text-[#8A93A6]">
                    {new Date(art.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-base font-medium text-white">{art.title}</h3>
                <p className="text-xs text-[#8A93A6] line-clamp-3">{art.summary}</p>
              </div>

              <div className="pt-3 border-t border-white/10 font-mono text-[10px] text-[#FFAA00] flex items-center justify-between">
                <span>{art.author_name}</span>
                <span>Читать →</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Модалка чтения статьи */}
      <Modal
        isOpen={Boolean(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
        title={selectedArticle?.title || ''}
      >
        <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
          {selectedArticle?.content || selectedArticle?.summary}
        </p>
      </Modal>

      {/* Модалка публикации новости */}
      <Modal isOpen={newsModalOpen} onClose={() => setNewsModalOpen(false)} title="Новая статья в газету">
        <form onSubmit={(e) => publishNewsMutation.mutate(e)} className="space-y-4">
          <input
            type="text"
            placeholder="Заголовок..."
            value={newsForm.title}
            onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
            className="w-full bg-[#050810] border border-white/10 p-2.5 text-xs text-white"
            required
          />
          <textarea
            rows={2}
            placeholder="Краткий анонс..."
            value={newsForm.summary}
            onChange={(e) => setNewsForm({ ...newsForm, summary: e.target.value })}
            className="w-full bg-[#050810] border border-white/10 p-2.5 text-xs text-white"
            required
          />
          <textarea
            rows={4}
            placeholder="Полный текст..."
            value={newsForm.content}
            onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
            className="w-full bg-[#050810] border border-white/10 p-2.5 text-xs text-white"
          />
          <Button type="submit" variant="gold" className="w-full">Опубликовать</Button>
        </form>
      </Modal>
    </div>
  );
}