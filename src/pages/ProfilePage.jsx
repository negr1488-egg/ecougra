import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, uploadFileToStorage, checkRateLimit } from '../lib/supabaseClient';
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
  UserCheck,
  Flag,
  FolderKanban,
  Send,
  Trash2,
  Heart,
  MessageCircle,
  Clock,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';

export default function ProfilePage() {
  const { username } = useParams();
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('wall'); // 'wall' | 'projects' | 'activity'
  const [wallPostText, setWallPostText] = useState('');
  const [mentorInput, setMentorInput] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    bio: '',
    status: 'online'
  });

  // Загружаем профиль целевого пользователя
  const { data: profileBundle, isLoading } = useQuery({
    queryKey: ['profile_bundle_v9', username || myProfile?.id],
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

      const [urRes, projsRes, logsRes, mentorRes, menteesRes] = await Promise.all([
        supabase.from('user_roles').select('user_id, role_id'),
        supabase.from('projects').select('*').eq('author_id', target.id).order('created_at', { ascending: false }),
        supabase.from('activity_log').select('*').eq('user_id', target.id).order('created_at', { ascending: false }).limit(20),
        target.mentor_id
          ? supabase.from('profiles').select('id, username, full_name, avatar_url').eq('id', target.mentor_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('profiles').select('id, username, full_name, xp').eq('mentor_id', target.id)
      ]);

      const allUr = urRes.data || [];
      const targetRoleIds = allUr.filter((r) => r.user_id === target.id).map((r) => r.role_id);
      const targetRoleNames = targetRoleIds.length
        ? targetRoleIds.map((id) => ROLE_ID_MAP[id] || 'student')
        : ['student'];
      const highestRole = getHighestRole(targetRoleNames, target.username);

      return {
        target,
        targetRoleNames,
        highestRole,
        mentorObj: mentorRes.data || null,
        menteesList: menteesRes.data || [],
        projects: projsRes.data || [],
        activities: logsRes.data || []
      };
    }
  });

  const targetProfile = profileBundle?.target;
  const isOwnProfile = !username || targetProfile?.id === user?.id;

  // Загрузка постов стены (посты конкретного автора)
  const { data: wallPosts = [], isLoading: wallLoading } = useQuery({
    queryKey: ['profile_wall_posts', targetProfile?.id],
    enabled: Boolean(targetProfile?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', targetProfile.id)
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data;
    }
  });

  // Публикация нового поста на стену
  const createWallPostMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      if (!wallPostText.trim() || !user?.id) return;
      if (myProfile?.is_banned) throw new Error('Ваш аккаунт ограничен модератором');
      checkRateLimit('wall_post_create', 1500);

      const content = wallPostText.trim();
      const { error } = await supabase.from('posts').insert([
        {
          author_id: user.id,
          body: content,
          content: content,
          tags: ['Профиль', 'Стена']
        }
      ]);
      if (error) throw error;

      await supabase.rpc('award_xp_secure', {
        p_action: 'wall_post_created',
        p_entity: 'post',
        p_xp_delta: 20,
        p_badge: 'Голос сообщества'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_wall_posts', targetProfile?.id] });
      queryClient.invalidateQueries({ queryKey: ['home_feed_posts_v9'] });
      setWallPostText('');
      toast('Запись опубликована на стене! (+20 XP)', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Удаление поста со стены
  const deleteWallPostMutation = useMutation({
    mutationFn: async (postId) => {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_wall_posts', targetProfile?.id] });
      queryClient.invalidateQueries({ queryKey: ['home_feed_posts_v9'] });
      toast('Запись удалена со стены', 'info');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Приватная привязка к наставнику по его личному @username
  const bindMentorByUsernameMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      const raw = mentorInput.trim();
      if (!raw) throw new Error('Введите никнейм наставника');
      const clean = raw.startsWith('@') ? raw : `@${raw}`;

      // 1. Ищем пользователя с таким никнеймом
      const { data: foundMentor, error: findErr } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .ilike('username', clean)
        .maybeSingle();

      if (findErr || !foundMentor) {
        throw new Error(`Пользователь ${clean} не найден. Проверьте правильность логина.`);
      }

      if (foundMentor.id === user.id) {
        throw new Error('Вы не можете назначить себя своим же наставником');
      }

      // 2. Проверяем, есть ли у него роль наставника (2) или админа/дева
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', foundMentor.id);

      const roleIds = (rolesData || []).map((r) => r.role_id);
      const isEligible = roleIds.includes(2) || roleIds.includes(4) || roleIds.includes(5);

      if (!isEligible) {
        throw new Error(`Пользователь ${clean} не зарегистрирован в системе как Наставник`);
      }

      // 3. Привязываем
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ mentor_id: foundMentor.id })
        .eq('id', user.id);

      if (updErr) throw updErr;
      return foundMentor;
    },
    onSuccess: (mentor) => {
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v9'] });
      if (refreshProfile) refreshProfile();
      setMentorInput('');
      toast(`Наставник ${mentor.username} (${mentor.full_name}) успешно привязан!`, 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Отвязка от наставника
  const unbindMentorMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({ mentor_id: null }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v9'] });
      if (refreshProfile) refreshProfile();
      toast('Наставник отвязан от вашего профиля', 'info');
    }
  });

  // Редактирование профиля
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
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v9'] });
      if (refreshProfile) refreshProfile();
      setEditOpen(false);
      toast('Профиль обновлён!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Отправка жалобы
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
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v9'] });
      if (refreshProfile) refreshProfile();
      toast('Аватар обновлён!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (isLoading || !profileBundle) return <Skeleton className="h-96 w-full" />;

  const { highestRole, targetRoleNames, mentorObj, menteesList, projects, activities } = profileBundle;
  const level = Math.floor((targetProfile.xp || 100) / 250) + 1;
  const badges = Array.isArray(targetProfile.badges) ? targetProfile.badges : ['Пионер Югры'];

  return (
    <div className="space-y-8">
      {/* 1. ГЛАВНАЯ КАРТОЧКА ПРОФИЛЯ */}
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

      {/* 2. СЕТКА: ЛЕВАЯ КОЛОНКА (НАСТАВНИК + ДОСТИЖЕНИЯ) И ПРАВАЯ (СТЕНА + ПРОЕКТЫ) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Левая колонка */}
        <div className="lg:col-span-4 space-y-6">
          {/* Блок Наставника: ЗАКРЫТАЯ ПРИВЯЗКА ПО НИКНЕЙМУ */}
          <Card className="p-5 space-y-4 border-[#22D3EE]/30 bg-[#060a14]">
            <div className="font-mono text-xs uppercase tracking-widest text-[#22D3EE] flex items-center gap-2">
              <UserCheck size={15} /> Научный наставник
            </div>

            {mentorObj ? (
              <div className="p-3.5 rounded-lg border border-[#22D3EE]/30 bg-[#050810] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#8A93A6]">Прикреплённый куратор:</span>
                  <Badge color="cyan">Подтверждён</Badge>
                </div>
                <div
                  onClick={() => navigate(`/profile/${mentorObj.username.replace('@', '')}`)}
                  className="cursor-pointer group"
                >
                  <div className="text-sm font-medium text-white group-hover:text-[#22D3EE] transition-colors">
                    {mentorObj.full_name}
                  </div>
                  <div className="font-mono text-xs text-[#FFAA00]">{mentorObj.username}</div>
                </div>

                {isOwnProfile && (
                  <button
                    onClick={() => unbindMentorMutation.mutate()}
                    className="text-[10px] font-mono text-red-400 hover:underline pt-1 block"
                  >
                    Сменить / отвязать наставника
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#8A93A6] leading-relaxed">
                  Куратор проверяет ваши черновики и допускает к защите. Наставник передаёт вам свой юзернейм лично.
                </p>

                {isOwnProfile && (
                  <form onSubmit={(e) => bindMentorByUsernameMutation.mutate(e)} className="space-y-2">
                    <Input
                      placeholder="@username_наставника"
                      value={mentorInput}
                      onChange={(e) => setMentorInput(e.target.value)}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="primary"
                      className="w-full justify-center"
                      disabled={bindMentorByUsernameMutation.isPending}
                    >
                      <LinkIcon size={13} /> Привязать куратора
                    </Button>
                  </form>
                )}
              </div>
            )}

            {/* Если сам пользователь Наставник — показываем его подопечных */}
            {targetRoleNames.includes('teacher') && (
              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="font-mono text-xs uppercase text-[#34D399]">
                  Подопечные ученики ({menteesList.length}):
                </div>
                {menteesList.length === 0 ? (
                  <div className="text-xs text-[#8A93A6]">Пока никто не привязался по вашему нику</div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {menteesList.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => navigate(`/profile/${st.username.replace('@', '')}`)}
                        className="p-2 rounded border border-white/5 bg-[#050810] flex items-center justify-between text-xs cursor-pointer hover:border-white/20"
                      >
                        <span className="font-mono text-[#FFAA00]">{st.username}</span>
                        <span className="text-zinc-300 truncate max-w-[120px]">{st.full_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Знаки отличия */}
          <Card className="p-5 space-y-3 border-white/10 bg-[#060a14]">
            <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00] flex items-center gap-2">
              <Award size={15} /> Знаки отличия ХМАО
            </div>
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b, i) => (
                <Badge key={i} color="gold">
                  ★ {b}
                </Badge>
              ))}
            </div>
          </Card>
        </div>

        {/* Правая колонка: СТЕНА ПРОФИЛЯ + ПРОЕКТЫ + АКТИВНОСТЬ */}
        <div className="lg:col-span-8 space-y-5">
          {/* Переключатель вкладок стены */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <button
              onClick={() => setActiveTab('wall')}
              className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all flex items-center gap-1.5 ${
                activeTab === 'wall'
                  ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold shadow-[0_0_12px_rgba(0,200,83,0.2)]'
                  : 'border-white/10 text-[#8A93A6] hover:text-white'
              }`}
            >
              <MessageCircle size={14} /> Стена ({wallPosts.length})
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all flex items-center gap-1.5 ${
                activeTab === 'projects'
                  ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE] font-bold'
                  : 'border-white/10 text-[#8A93A6] hover:text-white'
              }`}
            >
              <FolderKanban size={14} /> Проекты ({projects.length})
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all flex items-center gap-1.5 ${
                activeTab === 'activity'
                  ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00] font-bold'
                  : 'border-white/10 text-[#8A93A6] hover:text-white'
              }`}
            >
              <Clock size={14} /> История XP
            </button>
          </div>

          {/* ВКЛАДКА: СТЕНА ПРОФИЛЯ */}
          {activeTab === 'wall' && (
            <div className="space-y-4">
              {/* Поле создания записи на стене (доступно на своей стене) */}
              {isOwnProfile && (
                <Card className="p-4 bg-[#060a14] border-white/10">
                  <form onSubmit={(e) => createWallPostMutation.mutate(e)} className="space-y-3">
                    <textarea
                      rows={3}
                      value={wallPostText}
                      onChange={(e) => setWallPostText(e.target.value)}
                      placeholder="Опубликовать мысль, результат опыта или новость на своей стене..."
                      className="w-full bg-[#050810] border border-white/15 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-[#00C853]"
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-[#8A93A6] flex items-center gap-1">
                        <Sparkles size={11} className="text-[#00C853]" /> Публикация на стене даёт +20 XP
                      </span>
                      <Button type="submit" size="sm" disabled={createWallPostMutation.isPending}>
                        <Send size={13} /> Опубликовать
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {/* Лента постов на стене */}
              {wallLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : wallPosts.length === 0 ? (
                <Card className="p-8 text-center font-mono text-xs text-[#8A93A6] bg-[#060a14]">
                  На стене пока нет записей. {isOwnProfile ? 'Напишите первый пост выше!' : ''}
                </Card>
              ) : (
                wallPosts.map((post) => {
                  const postContent = post.content || post.body || '';
                  return (
                    <Card key={post.id} className="p-5 space-y-3 bg-[#060a14]/90 border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            src={targetProfile.avatar_url}
                            username={targetProfile.username}
                            status={targetProfile.status}
                            size="sm"
                          />
                          <div>
                            <div className="font-mono text-xs text-[#FFAA00] font-bold">
                              {targetProfile.username}
                            </div>
                            <div className="text-[10px] text-[#8A93A6]">
                              {new Date(post.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {isOwnProfile && (
                          <button
                            onClick={() => deleteWallPostMutation.mutate(post.id)}
                            className="p-1.5 rounded hover:bg-red-500/10 text-[#8A93A6] hover:text-red-400"
                            title="Удалить запись"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">
                        {postContent}
                      </p>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-[#8A93A6]">
                        <span className="flex items-center gap-1.5 text-[#34D399]">
                          <Heart size={13} className="fill-[#34D399]" /> {post.likes_count || 0}
                        </span>
                        <span>Стена пользователя</span>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* ВКЛАДКА: ПРОЕКТЫ */}
          {activeTab === 'projects' && (
            <div className="space-y-3">
              {projects.length === 0 ? (
                <Card className="p-8 text-center font-mono text-xs text-[#8A93A6] bg-[#060a14]">
                  Пользователь пока не подавал инженерных проектов.
                </Card>
              ) : (
                projects.map((pr) => (
                  <Card key={pr.id} className="p-4 rounded-lg border border-white/10 bg-[#060a14] space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-white">{pr.title}</h3>
                      <Badge color="emerald">{pr.status}</Badge>
                    </div>
                    <p className="text-xs text-zinc-300 line-clamp-2">{pr.description}</p>
                    <div className="text-[11px] font-mono text-[#34D399] pt-1">
                      Эффект: {pr.impact_metric}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* ВКЛАДКА: ИСТОРИЯ XP */}
          {activeTab === 'activity' && (
            <Card className="p-5 space-y-3 border-white/10 bg-[#060a14]">
              <div className="font-mono text-xs uppercase tracking-widest text-[#8A93A6] flex items-center gap-2">
                <ShieldCheck size={14} /> Подтверждённые действия в экосистеме
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded border border-white/5 bg-[#050810] flex items-center justify-between text-xs font-mono"
                  >
                    <span className="text-white uppercase">{act.action}</span>
                    <span className="text-[#34D399]">{new Date(act.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
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
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">
              О себе / научные интересы
            </label>
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

      {/* МОДАЛКА ЖАЛОБЫ */}
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