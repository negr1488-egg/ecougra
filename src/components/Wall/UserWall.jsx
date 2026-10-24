import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, uploadFileToStorage } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Avatar, Badge, useToast } from '../ui/DesignSystem';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Flag,
  Trash2,
  Image as ImageIcon,
  Link as LinkIcon,
  Send,
  Globe,
  Building2,
  Users,
  Lock
} from 'lucide-react';

const VISIBILITY_MAP = {
  public: { label: 'Всем', icon: Globe, color: 'emerald' },
  org: { label: 'Организации', icon: Building2, color: 'cyan' },
  friends: { label: 'Друзьям', icon: Users, color: 'gold' },
  private: { label: 'Только мне', icon: Lock, color: 'red' }
};

export default function UserWall({ targetUserId, isOwnWall = true }) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [content, setContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [attachedImages, setAttachedImages] = useState([]);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['wall_posts', targetUserId],
    queryFn: async () => {
      let query = supabase
        .from('wall_posts')
        .select('*, profiles:author_id(username, full_name, avatar_url, status)')
        .is('deleted_at', null)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(30);

      if (targetUserId) {
        query = query.eq('author_id', targetUserId);
      }

      const { data: rawPosts } = await query;
      const list = rawPosts || [];

      if (list.length === 0) return [];

      const postIds = list.map((p) => p.id);
      const [likesRes, commentsRes] = await Promise.all([
        supabase.from('wall_likes').select('*').in('post_id', postIds),
        supabase
          .from('wall_comments')
          .select('*, profiles:author_id(username, full_name, avatar_url)')
          .in('post_id', postIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
      ]);

      const likes = likesRes.data || [];
      const comments = commentsRes.data || [];

      return list.map((p) => ({
        ...p,
        likes: likes.filter((l) => l.post_id === p.id),
        isLikedByMe: likes.some((l) => l.post_id === p.id && l.user_id === user?.id),
        comments: comments.filter((c) => c.post_id === p.id)
      }));
    }
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      toast('Загрузка изображения...', 'info');
      const url = await uploadFileToStorage('chat-attachments', user.id, file);
      setAttachedImages((prev) => [...prev, url]);
      toast('Изображение прикреплено', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const createPostMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      if (!content.trim()) throw new Error('Напишите текст записи');
      const { error } = await supabase.from('wall_posts').insert([
        {
          author_id: user.id,
          content: content.trim(),
          link_url: linkUrl.trim(),
          images: attachedImages,
          visibility
        }
      ]);
      if (error) throw error;

      await supabase.rpc('award_xp_secure', {
        p_action: 'wall_post',
        p_entity: 'wall',
        p_xp_delta: 20
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wall_posts'] });
      setContent('');
      setLinkUrl('');
      setAttachedImages([]);
      toast('Запись опубликована на стене! (+20 XP)', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async (post) => {
      if (!user) return;
      if (post.isLikedByMe) {
        await supabase.from('wall_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      } else {
        await supabase.from('wall_likes').insert([{ post_id: post.id, user_id: user.id }]);
        if (post.author_id !== user.id) {
          await supabase.from('notifications').insert([
            {
              user_id: post.author_id,
              type: 'wall_like',
              payload: { preview: `${profile?.username || '@user'} оценил вашу запись на стене` }
            }
          ]);
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wall_posts'] })
  });

  const addCommentMutation = useMutation({
    mutationFn: async (post) => {
      if (!commentText.trim() || !user) return;
      const { error } = await supabase.from('wall_comments').insert([
        {
          post_id: post.id,
          author_id: user.id,
          content: commentText.trim()
        }
      ]);
      if (error) throw error;

      if (post.author_id !== user.id) {
        await supabase.from('notifications').insert([
          {
            user_id: post.author_id,
            type: 'wall_comment',
            payload: { preview: `${profile?.username || '@user'} прокомментировал ваш пост` }
          }
        ]);
      }

      await supabase.rpc('award_xp_secure', {
        p_action: 'wall_comment',
        p_entity: 'wall',
        p_xp_delta: 10
      });
    },
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['wall_posts'] });
      toast('Комментарий добавлен (+10 XP)', 'success');
    }
  });

  const repostMutation = useMutation({
    mutationFn: async (originalPost) => {
      const { error } = await supabase.from('wall_posts').insert([
        {
          author_id: user.id,
          content: `🔄 Репост записи ${originalPost.profiles?.username || '@author'}:\n\n${originalPost.content}`,
          images: originalPost.images || [],
          link_url: originalPost.link_url || '',
          repost_of_id: originalPost.id,
          visibility: 'public'
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wall_posts'] });
      toast('Запись репостнута на вашу стену!', 'success');
    }
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId) => {
      await supabase
        .from('wall_posts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wall_posts'] });
      toast('Запись удалена (Soft Delete)', 'info');
    }
  });

  const reportPostMutation = useMutation({
    mutationFn: async (post) => {
      await supabase.from('wall_reports').insert([
        {
          post_id: post.id,
          reporter_id: user.id,
          reason: 'Нарушение правил сообщества / спам'
        }
      ]);
    },
    onSuccess: () => toast('Жалоба отправлена модераторам', 'info')
  });

  return (
    <div className="space-y-6">
      {/* Форма создания записи */}
      {isOwnWall && user && (
        <Card className="p-5 space-y-4 border-[#00C853]/30">
          <form onSubmit={(e) => createPostMutation.mutate(e)} className="space-y-3">
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Поделитесь исследованием, фото с месторождения или идеей проекта..."
              className="w-full bg-[#050810] border border-white/10 p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00C853]"
            />

            {attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachedImages.map((img, i) => (
                  <img key={i} src={img} alt="preview" className="h-20 w-28 object-cover border border-white/15" />
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <label className="px-3 py-1.5 bg-[#050810] border border-white/10 hover:border-[#FFAA00] text-xs text-[#8A93A6] hover:text-white cursor-pointer flex items-center gap-1.5">
                  <ImageIcon size={14} /> Фото
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>

                <div className="relative">
                  <LinkIcon size={13} className="absolute left-2.5 top-2 text-[#8A93A6]" />
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="Ссылка (опционально)..."
                    className="bg-[#050810] border border-white/10 pl-7 pr-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#00C853] w-44"
                  />
                </div>

                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="bg-[#050810] border border-white/15 px-2.5 py-1 text-xs font-mono text-white"
                >
                  <option value="public">🌍 Публично</option>
                  <option value="org">🏫 Только для организации</option>
                  <option value="friends">👥 Только для друзей</option>
                  <option value="private">🔒 Только мне</option>
                </select>
              </div>

              <Button type="submit" size="sm" disabled={createPostMutation.isPending}>
                <Send size={13} /> Опубликовать (+20 XP)
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Список постов на стене */}
      {isLoading ? (
        <div className="text-xs font-mono text-[#8A93A6] py-6 text-center">Загрузка публикаций стены...</div>
      ) : posts.length === 0 ? (
        <Card className="p-8 text-center font-mono text-xs text-[#8A93A6]">
          На стене пока нет записей. Опубликуйте первый пост!
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const visCfg = VISIBILITY_MAP[post.visibility] || VISIBILITY_MAP.public;
            const isMyPost = post.author_id === user?.id;

            return (
              <Card key={post.id} className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={post.profiles?.avatar_url}
                      username={post.profiles?.username}
                      status={post.profiles?.status}
                      size="sm"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#FFAA00]">
                          {post.profiles?.username || '@researcher'}
                        </span>
                        <Badge color={visCfg.color}>{visCfg.label}</Badge>
                      </div>
                      <div className="text-[11px] text-[#8A93A6]">
                        {post.profiles?.full_name} · {new Date(post.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isMyPost ? (
                      <button
                        onClick={() => deletePostMutation.mutate(post.id)}
                        className="p-1.5 text-[#8A93A6] hover:text-red-400"
                        title="Удалить запись"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => reportPostMutation.mutate(post)}
                        className="p-1.5 text-[#8A93A6] hover:text-[#FFAA00]"
                        title="Пожаловаться на запись"
                      >
                        <Flag size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {post.content}
                </p>

                {Array.isArray(post.images) && post.images.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {post.images.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt="attachment"
                        className="w-full max-h-64 object-cover border border-white/10"
                      />
                    ))}
                  </div>
                )}

                {post.link_url && (
                  <a
                    href={post.link_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#050810] border border-[#22D3EE]/30 font-mono text-xs text-[#22D3EE] hover:underline"
                  >
                    <LinkIcon size={12} /> {post.link_url}
                  </a>
                )}

                {/* Панель действий: Лайк, Комментарии, Репост */}
                <div className="pt-3 border-t border-white/10 flex items-center gap-6 font-mono text-xs">
                  <button
                    onClick={() => toggleLikeMutation.mutate(post)}
                    className={`flex items-center gap-1.5 transition-colors ${
                      post.isLikedByMe ? 'text-red-400 font-bold' : 'text-[#8A93A6] hover:text-white'
                    }`}
                  >
                    <Heart size={15} className={post.isLikedByMe ? 'fill-red-400' : ''} />
                    <span>{post.likes?.length || 0}</span>
                  </button>

                  <button
                    onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                    className="flex items-center gap-1.5 text-[#8A93A6] hover:text-white"
                  >
                    <MessageCircle size={15} />
                    <span>{post.comments?.length || 0}</span>
                  </button>

                  <button
                    onClick={() => repostMutation.mutate(post)}
                    className="flex items-center gap-1.5 text-[#8A93A6] hover:text-[#34D399]"
                  >
                    <Repeat2 size={15} />
                    <span>Поделиться</span>
                  </button>
                </div>

                {/* Блок комментариев */}
                {activeCommentPostId === post.id && (
                  <div className="pt-3 border-t border-white/5 space-y-3">
                    {post.comments?.map((c) => (
                      <div key={c.id} className="p-2.5 bg-[#050810] border border-white/5 text-xs flex justify-between">
                        <div>
                          <span className="font-mono text-[#FFAA00] font-semibold mr-2">
                            {c.profiles?.username || '@user'}:
                          </span>
                          <span className="text-zinc-300">{c.content}</span>
                        </div>
                        <span className="font-mono text-[10px] text-[#4A5464]">
                          {new Date(c.created_at).toLocaleTimeString().slice(0, 5)}
                        </span>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Написать комментарий..."
                        className="flex-1 bg-[#050810] border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00C853]"
                      />
                      <Button size="sm" onClick={() => addCommentMutation.mutate(post)}>
                        Отправить
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}