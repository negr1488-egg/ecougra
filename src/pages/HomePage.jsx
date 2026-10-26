// src/pages/HomePage.jsx
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
  Calculator,
  Compass,
  Trophy,
  ExternalLink,
  MessageSquare,
  Trash2
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
  const [postLink, setPostLink] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);

  // Состояния для комментариев в ленте
  const [openCommentsPostId, setOpenCommentsPostId] = useState(null);
  const [commentInput, setCommentInput] = useState('');

  // 1. Загрузка выпусков газеты
  const { data: newsArticles = FALLBACK_NEWS, isLoading: newsLoading } = useQuery({
    queryKey: ['home_newspaper_v15'],
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

  // 2. ЗАГРУЗКА wall_posts ВМЕСТЕ С КОММЕНТАРИЯМИ И ЛАЙКАМИ ИЗ ТАБЛИЦЫ wall_likes
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['home_wall_posts_feed_v15', user?.id],
    queryFn: async () => {
      try {
        const [postsRes, commentsRes, profsRes, urRes, myLikesRes] = await Promise.all([
          supabase.from('wall_posts').select('*').limit(30),
          supabase.from('wall_comments').select('*').order('created_at', { ascending: true }),
          supabase.from('profiles').select('id, username, full_name, avatar_url, status'),
          supabase.from('user_roles').select('user_id, role_id'),
          user?.id
            ? supabase.from('wall_likes').select('post_id').eq('user_id', user.id)
            : Promise.resolve({ data: [] })
        ]);

        if (postsRes.error || !postsRes.data) return [];

        const profMap = Object.fromEntries((profsRes.data || []).map((p) => [p.id, p]));
        const myLikedSet = new Set((myLikesRes.data || []).map((l) => l.post_id));

        const roleMap = {};
        (urRes.data || []).forEach((ur) => {
          if (!roleMap[ur.user_id]) roleMap[ur.user_id] = [];
          roleMap[ur.user_id].push(ROLE_ID_MAP[ur.role_id] || 'student');
        });

        // Группируем комментарии по постам
        const commentsByPost = {};
        (commentsRes.data || []).forEach((c) => {
          if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
          commentsByPost[c.post_id].push({
            ...c,
            author: profMap[c.author_id] || { username: '@участник' }
          });
        });

        const sorted = postsRes.data.sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );

        return sorted.map((p) => {
          const author = profMap[p.author_id] || { username: '@исследователь', full_name: 'Участник платформы' };
          const highestRole = getHighestRole(roleMap[p.author_id] || ['student'], author.username);
          return {
            ...p,
            author,
            highestRole,
            isLiked: myLikedSet.has(p.id),
            comments: commentsByPost[p.id] || []
          };
        });
      } catch (err) {
        console.error('Ошибка загрузки ленты:', err);
        return [];
      }
    }
  });

  // 3. Публикация нового поста в wall_posts
  const createPostMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      if (!postText.trim() || !user?.id) return;
      if (profile?.is_banned) throw new Error('Ваш аккаунт ограничен модератором');
      checkRateLimit('home_post_create', 1500);

      const payload = {
        author_id: user.id,
        content: postText.trim(),
        link_url: postLink.trim() || null,
        images: [],
        visibility: 'public'
      };

      const { error } = await supabase.from('wall_posts').insert([payload]);
      if (error) throw error;

      await supabase.rpc('award_xp_secure', {
        p_action: 'community_post_created',
        p_entity: 'wall_post',
        p_xp_delta: 20,
        p_badge: 'Голос Югры'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home_wall_posts_feed_v15'] });
      queryClient.invalidateQueries({ queryKey: ['profile_wall_posts_v16'] });
      setPostText('');
      setPostLink('');
      toast('Запись опубликована в ленте сообщества! (+20 XP)', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // 4. Добавление комментария к посту на главной
  const addCommentMutation = useMutation({
    mutationFn: async ({ postId, text }) => {
      if (!text.trim() || !user?.id) return;
      if (profile?.is_banned) throw new Error('Ваш аккаунт заблокирован');

      const { error } = await supabase.from('wall_comments').insert([
        {
          post_id: postId,
          author_id: user.id,
          content: text.trim()
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home_wall_posts_feed_v15'] });
      queryClient.invalidateQueries({ queryKey: ['profile_wall_posts_v16'] });
      setCommentInput('');
      toast('Комментарий добавлен', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // 5. Удаление комментария
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId) => {
      const { error } = await supabase.from('wall_comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home_wall_posts_feed_v15'] });
      queryClient.invalidateQueries({ queryKey: ['profile_wall_posts_v16'] });
      toast('Комментарий удалён', 'info');
    }
  });

  // 6. ПОСТОЯННЫЕ УНИКАЛЬНЫЕ ЛАЙКИ ЧЕРЕЗ ТАБЛИЦУ wall_likes
  const toggleLikeMutation = useMutation({
    mutationFn: async (post) => {
      if (!user?.id) throw new Error('Войдите, чтобы поставить отметку «Нравится»');
      checkRateLimit('home_like_toggle', 300);

      if (post.isLiked) {
        // Снимаем лайк
        const { error } = await supabase
          .from('wall_likes')
          .delete()
          .match({ post_id: post.id, user_id: user.id });
        if (error) throw error;
      } else {
        // Ставим постоянный лайк
        const { error } = await supabase
          .from('wall_likes')
          .insert([{ post_id: post.id, user_id: user.id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home_wall_posts_feed_v15'] });
      queryClient.invalidateQueries({ queryKey: ['profile_wall_posts_v16'] });
    },
    onError: (err) => toast(err.message, 'error')
  });

  const leadArticle = newsArticles[0] || FALLBACK_NEWS[0];
  const sideArticles = newsArticles.slice(1, 5);

  return (
    <div className="space-y-10">
      {/* 1. ГЛАВНЫЙ ВЫПУСК ГАЗЕТЫ «НЕФТЯНОЙ ВЕСТНИК ЮГРЫ» */}
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
                  <Badge color="purple">Официальный вестник</Badge>
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

      {/* 2. БЫСТРЫЕ МОДУЛИ */}
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

      {/* 3. ЛЕНТА СООБЩЕСТВА С КОММЕНТАРИЯМИ И ПОСТОЯННЫМИ ЛАЙКАМИ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Открытая трибуна исследователей, наставников и жюри</div>
            <h2 className="text-2xl font-light text-white">
              Лента сообщества <strong className="font-semibold text-[#00C853]">Зелёная Югра</strong>
            </h2>
          </div>
        </div>

        {/* Форма публикации поста */}
        <Card className="p-5 bg-[#060a14]">
          <form onSubmit={(e) => createPostMutation.mutate(e)} className="space-y-3">
            <textarea
              rows={2}
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="Поделитесь результатами исследования, новостью школы или отчётом с промысла..."
              className="w-full bg-[#050810] border border-white/15 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-[#00C853]"
              required
            />
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
              <input
                type="text"
                placeholder="Прикрепить ссылку (https://...)"
                value={postLink}
                onChange={(e) => setPostLink(e.target.value)}
                className="bg-[#050810] border border-white/15 rounded px-3 py-1.5 text-xs text-white flex-1 focus:outline-none focus:border-[#FFAA00]"
              />
              <Button type="submit" size="sm" disabled={createPostMutation.isPending} className="shrink-0">
                <Send size={14} /> Опубликовать (+20 XP)
              </Button>
            </div>
          </form>
        </Card>

        {/* Карточки постов */}
        {postsLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : posts.length === 0 ? (
          <Card className="p-8 text-center font-mono text-xs text-[#8A93A6] bg-[#060a14]">
            В ленте пока нет записей. Опубликуйте первую запись выше!
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map((p) => {
              const uname = p.author?.username || '@исследователь';
              const isLiked = Boolean(p.isLiked);
              const roleBadge = p.highestRole || { label: 'Исследователь', color: 'emerald' };
              const comments = p.comments || [];
              const isCommentsOpen = openCommentsPostId === p.id;

              return (
                <Card key={p.id} className="p-5 flex flex-col justify-between space-y-4 bg-[#060a14]/90 border-white/10">
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
                            <Badge color={roleBadge.color}>{roleBadge.label}</Badge>
                          </div>
                          <div className="text-[11px] text-[#8A93A6]">{p.author?.full_name}</div>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-[#4A5464]">
                        {new Date(p.created_at || Date.now()).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                      {p.content}
                    </p>

                    {p.link_url && (
                      <a
                        href={p.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 p-2 bg-white/5 border border-white/10 rounded text-xs text-[#22D3EE] hover:underline"
                      >
                        <ExternalLink size={12} /> {p.link_url}
                      </a>
                    )}
                  </div>

                  {/* Панель лайков и кнопки комментариев */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* КНОПКА ЛАЙКА: сохраняется в wall_likes в Supabase, не сбрасывается по дням, повторный клик снимает */}
                      <button
                        onClick={() => toggleLikeMutation.mutate(p)}
                        disabled={toggleLikeMutation.isPending}
                        className={`px-3 py-1 rounded border font-mono text-xs flex items-center gap-1.5 transition-all ${
                          isLiked
                            ? 'border-[#00C853] bg-[#00C853]/20 text-[#34D399] shadow-[0_0_12px_rgba(0,200,83,0.3)]'
                            : 'border-white/10 text-[#8A93A6] hover:text-white hover:border-white/30'
                        }`}
                        title={isLiked ? 'Снять отметку «Нравится»' : 'Поставить отметку «Нравится»'}
                      >
                        <Heart size={13} className={isLiked ? 'fill-[#34D399] text-[#34D399]' : ''} />
                        <span>{p.likes_count || 0}</span>
                      </button>

                      <button
                        onClick={() => setOpenCommentsPostId(isCommentsOpen ? null : p.id)}
                        className="flex items-center gap-1.5 text-xs font-mono text-zinc-300 hover:text-white transition-colors"
                      >
                        <MessageSquare size={13} /> {comments.length}
                      </button>
                    </div>

                    <span className="font-mono text-[10px] text-[#8A93A6]">Стена Югры</span>
                  </div>

                  {/* ВЕТКА РАСКРЫВАЮЩИХСЯ КОММЕНТАРИЕВ (wall_comments) */}
                  {isCommentsOpen && (
                    <div className="pt-3 border-t border-white/10 space-y-3">
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {comments.length === 0 ? (
                          <div className="text-[11px] text-[#8A93A6] font-mono py-1">
                            Комментариев пока нет. Будьте первым!
                          </div>
                        ) : (
                          comments.map((c) => (
                            <div
                              key={c.id}
                              className="p-2.5 rounded bg-[#050810] border border-white/5 flex items-start justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-[#FFAA00] font-bold">
                                    {c.author?.username}
                                  </span>
                                  <span className="text-[10px] text-[#8A93A6]">
                                    {new Date(c.created_at).toLocaleTimeString().slice(0, 5)}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-200 mt-1">{c.content}</p>
                              </div>
                              {c.author_id === user?.id && (
                                <button
                                  onClick={() => deleteCommentMutation.mutate(c.id)}
                                  className="text-[#8A93A6] hover:text-red-400 p-1"
                                  title="Удалить"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          addCommentMutation.mutate({ postId: p.id, text: commentInput });
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={commentInput}
                          onChange={(e) => setCommentInput(e.target.value)}
                          placeholder="Ваш комментарий..."
                          className="flex-1 bg-[#050810] border border-white/15 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#00C853]"
                        />
                        <Button type="submit" size="sm">
                          <Send size={12} />
                        </Button>
                      </form>
                    </div>
                  )}
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