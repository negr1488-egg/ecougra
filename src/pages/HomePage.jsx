import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, checkRateLimit } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Avatar, Badge, Modal, Skeleton, useToast } from '../components/ui/DesignSystem';
import { getHighestRole, ROLE_ID_MAP } from '../utils/roleUtils';
import {
  Newspaper,
  BookOpen,
  Heart,
  Send,
  ArrowRight,
  Calculator,
  Compass,
  Trophy,
  Sparkles,
  Flame,
  Flag
} from 'lucide-react';

const FALLBACK_NEWS = [
  {
    id: 'news-default-1',
    title: 'На Приобском месторождении внедрён ИИ-мониторинг целостности нефтепроводов',
    category: 'Главный выпуск',
    summary:
      'Цифровые двойники и беспилотный экологический контроль позволили сократить риски разливов и повысить полезное использование ПНГ до 98,4%.',
    content:
      'Инженерные команды ХМАО-Югры представили обновлённую систему предиктивной телеметрии промыслов. Датчики давления в связке с алгоритмами машинного обучения фиксируют отклонения за миллисекунды, обеспечивая сохранность экосистемы тайги и рек Обь-Иртышского бассейна.',
    author_name: 'Редакция «Югра.Нефть» (@pestrikov_kv)',
    is_pinned: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'news-default-2',
    title: 'Школы Пойковского, Сургута и Нефтеюганска открыли проектные смены «Зелёный след»',
    category: 'Образование ХМАО',
    summary:
      'Участники разрабатывают проекты биоремедиации земель и улавливания парниковых газов под руководством наставников и экспертов жюри.',
    content:
      'Лучшие инженерные проекты школьников ХМАО-Югры проходят слепую экспертизу жюри и получают поддержку для практического внедрения.',
    author_name: 'Оргкомитет «Зелёная Югра»',
    is_pinned: false,
    created_at: new Date().toISOString()
  }
];

export default function HomePage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [postText, setPostText] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [likedPostIds, setLikedPostIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ugra_liked_posts') || '[]');
    } catch {
      return [];
    }
  });

  // 1. Загрузка выпусков газеты
  const { data: newsArticles = FALLBACK_NEWS, isLoading: newsLoading } = useQuery({
    queryKey: ['home_newspaper_v8'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('news')
          .select('*')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(6);
        if (error || !data || data.length === 0) return FALLBACK_NEWS;
        return data;
      } catch {
        return FALLBACK_NEWS;
      }
    }
  });

  // 2. Загрузка постов сообщества вместе со старшей ролью каждого автора
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['home_posts_with_roles_v8'],
    queryFn: async () => {
      try {
        const [postsRes, profsRes, urRes] = await Promise.all([
          supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(20),
          supabase.from('profiles').select('id, username, full_name, avatar_url, status'),
          supabase.from('user_roles').select('user_id, role_id')
        ]);

        const profMap = Object.fromEntries((profsRes.data || []).map((p) => [p.id, p]));
        const roleMap = {};
        (urRes.data || []).forEach((ur) => {
          if (!roleMap[ur.user_id]) roleMap[ur.user_id] = [];
          roleMap[ur.user_id].push(ROLE_ID_MAP[ur.role_id] || 'student');
        });

        return (postsRes.data || [])
          .filter((p) => !p.deleted_at)
          .map((p) => {
            const author = profMap[p.author_id] || { username: '@исследователь', full_name: 'Участник' };
            const highestRole = getHighestRole(roleMap[p.author_id] || ['student'], author.username);
            return {
              ...p,
              author,
              highestRole
            };
          });
      } catch {
        return [];
      }
    }
  });

  // Публикация поста в ленту
  const createPostMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      if (!postText.trim() || !user?.id) return;
      if (profile?.is_banned) throw new Error('Ваш аккаунт ограничен модератором');
      checkRateLimit('create_post', 2000);

      const { error } = await supabase.from('posts').insert([
        {
          author_id: user.id,
          content: postText.trim(),
          tags: ['ЮграНефть', 'ЗелёнаяЮгра']
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home_posts_with_roles_v8'] });
      setPostText('');
      toast('Запись опубликована в ленте! (+20 XP)', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  const handleToggleLike = async (post) => {
    const alreadyLiked = likedPostIds.includes(post.id);
    const nextLikes = alreadyLiked ? Math.max(0, (post.likes_count || 0) - 1) : (post.likes_count || 0) + 1;
    const updatedIds = alreadyLiked
      ? likedPostIds.filter((id) => id !== post.id)
      : [...likedPostIds, post.id];

    setLikedPostIds(updatedIds);
    localStorage.setItem('ugra_liked_posts', JSON.stringify(updatedIds));

    await supabase.from('posts').update({ likes_count: nextLikes }).eq('id', post.id);
    queryClient.invalidateQueries({ queryKey: ['home_posts_with_roles_v8'] });
  };

  const leadArticle = newsArticles[0] || FALLBACK_NEWS[0];
  const sideArticles = newsArticles.slice(1, 5);

  return (
    <div className="space-y-10">
      {/* 1. ГЛАВНЫЙ РАЗВОРОТ ГАЗЕТЫ «НЕФТЯНОЙ ВЕСТНИК ЮГРЫ» */}
      <section className="space-y-4">
        <div className="border-y-2 border-white/20 py-3 flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-widest text-[#8A93A6]">
          <div className="flex items-center gap-2 text-[#FFAA00]">
            <Newspaper size={15} />
            <span>Официальное издание платформы «ЮГРА.НЕФТЬ — Зелёная Югра»</span>
          </div>
          <div>ХМАО-Югра • Инженерно-экологический вестник</div>
        </div>

        {newsLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-between border-[#FFAA00]/30 bg-gradient-to-br from-[#070b14] via-[#050810] to-[#041810] shadow-2xl">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color="gold">{leadArticle.category || 'Главный выпуск'}</Badge>
                  <Badge color="purple">Старшая роль редакции</Badge>
                </div>

                <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight">
                  {leadArticle.title}
                </h1>

                <p className="text-sm text-zinc-200 leading-relaxed">{leadArticle.summary}</p>
              </div>

              <div className="pt-6 mt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                <span className="font-mono text-xs text-[#FFAA00]">{leadArticle.author_name}</span>
                <Button variant="gold" size="sm" onClick={() => setSelectedArticle(leadArticle)}>
                  <BookOpen size={14} /> Читать статью полностью
                </Button>
              </div>
            </Card>

            <div className="lg:col-span-4 flex flex-col justify-between gap-4">
              {sideArticles.map((art) => (
                <Card
                  key={art.id}
                  onClick={() => setSelectedArticle(art)}
                  className="p-5 flex-1 flex flex-col justify-between cursor-pointer hover:border-[#00C853]/60 transition-all bg-[#060a14]"
                >
                  <div className="space-y-2">
                    <Badge color="cyan">{art.category || 'Хроника'}</Badge>
                    <h3 className="text-base font-medium text-white">{art.title}</h3>
                    <p className="text-xs text-[#8A93A6] line-clamp-2">{art.summary}</p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between font-mono text-[10px] text-[#34D399]">
                    <span>{art.author_name}</span>
                    <span>Читать →</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 2. БЫСТРЫЕ ПЕРЕХОДЫ В ИНЖЕНЕРНЫЕ МОДУЛИ */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          onClick={() => navigate('/learn')}
          className="p-5 cursor-pointer hover:border-[#00C853] transition-all flex items-center justify-between bg-[#060a14]"
        >
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase text-[#34D399]">Модуль 01</div>
            <div className="text-base font-medium text-white">Калькулятор CO₂ и 3D-Буровая</div>
          </div>
          <Calculator size={24} className="text-[#00C853]" />
        </Card>

        <Card
          onClick={() => navigate('/activities')}
          className="p-5 cursor-pointer hover:border-[#FFAA00] transition-all flex items-center justify-between bg-[#060a14]"
        >
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase text-[#FFAA00]">Модуль 02</div>
            <div className="text-base font-medium text-white">Проекты, Наставники и Жюри</div>
          </div>
          <Compass size={24} className="text-[#FFAA00]" />
        </Card>

        <Card
          onClick={() => navigate('/gamification')}
          className="p-5 cursor-pointer hover:border-[#22D3EE] transition-all flex items-center justify-between bg-[#060a14]"
        >
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase text-[#22D3EE]">Модуль 03</div>
            <div className="text-base font-medium text-white">Рейтинг Топ-100 школ Югры</div>
          </div>
          <Trophy size={24} className="text-[#22D3EE]" />
        </Card>
      </section>

      {/* 3. ЖИВАЯ ЛЕНТА СООБЩЕСТВА С ОТОБРАЖЕНИЕМ СТАРШЕЙ РОЛИ АВТОРА */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Открытая трибуна исследователей, наставников и жюри</div>
            <h2 className="text-2xl font-light text-white">
              Лента сообщества <strong className="font-semibold text-[#00C853]">Зелёная Югра</strong>
            </h2>
          </div>
        </div>

        <Card className="p-5 bg-[#060a14]">
          <form onSubmit={(e) => createPostMutation.mutate(e)} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="Поделитесь результатами исследования, новостью школы или вопросом к наставникам..."
              className="flex-1 bg-[#050810] border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00C853]"
            />
            <Button type="submit" size="sm" disabled={createPostMutation.isPending}>
              <Send size={14} /> Опубликовать (+20 XP)
            </Button>
          </form>
        </Card>

        {postsLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map((p) => {
              const uname = p.author?.username || '@исследователь';
              const isLiked = likedPostIds.includes(p.id);
              const roleBadge = p.highestRole || { label: 'Исследователь', color: 'emerald' };

              return (
                <Card key={p.id} className="p-5 flex flex-col justify-between space-y-4 bg-[#060a14]/90">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div
                        onClick={() => navigate(`/profile/${uname.replace('@', '')}`)}
                        className="flex items-center gap-2.5 cursor-pointer group"
                      >
                        <Avatar src={p.author?.avatar_url} username={uname} status={p.author?.status} size="sm" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-[#FFAA00] font-bold group-hover:underline">
                              {uname}
                            </span>
                            {/* СТАРШАЯ РОЛЬ АВТОРА ПОСТА */}
                            <Badge color={roleBadge.color}>{roleBadge.label}</Badge>
                          </div>
                          <div className="text-[11px] text-[#8A93A6]">{p.author?.full_name}</div>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-[#4A5464]">
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{p.content}</p>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <button
                      onClick={() => handleToggleLike(p)}
                      className={`px-3 py-1 rounded border font-mono text-xs flex items-center gap-1.5 transition-all ${
                        isLiked
                          ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399]'
                          : 'border-white/10 text-[#8A93A6] hover:text-white'
                      }`}
                    >
                      <Heart size={13} className={isLiked ? 'fill-[#34D399]' : ''} />
                      <span>{p.likes_count || 0}</span>
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* МОДАЛКА ЧТЕНИЯ СТАТЬИ */}
      <Modal
        isOpen={Boolean(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
        title={selectedArticle?.category || 'Выпуск газеты'}
      >
        {selectedArticle && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">{selectedArticle.title}</h2>
            <div className="font-mono text-[11px] text-[#FFAA00] border-b border-white/10 pb-2">
              Автор: {selectedArticle.author_name}
            </div>
            <div className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {selectedArticle.content || selectedArticle.summary}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}