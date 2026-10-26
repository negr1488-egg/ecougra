// src/pages/ProfilePage.jsx
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
  Link as LinkIcon,
  UserPlus,
  UserMinus,
  Settings,
  Radio,
  MapPin,
  GraduationCap,
  School,
  ExternalLink,
  Share2,
  Trees,
  CheckCircle2,
  Lock
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'online', label: 'В сети', color: 'emerald' },
  { value: 'away', label: 'Отошёл', color: 'gold' },
  { value: 'busy', label: 'На промысле / Занят', color: 'red' },
  { value: 'offline', label: 'Невидимка (Офлайн)', color: 'zinc' }
];

// Плоды на растущем дереве Югры (с координатами на кроне дерева)
const TREE_FRUITS = [
  { id: 1, level: 1, title: 'Семя Первопроходца', xpReq: 0, perk: 'Доступ к чатам, базе знаний и обучающим курсам', cx: 200, cy: 235, color: '#34D399' },
  { id: 2, level: 5, title: 'Плод Тайги', xpReq: 500, perk: 'Право подачи инженерных и экологических проектов', cx: 135, cy: 195, color: '#00C853' },
  { id: 3, level: 10, title: 'Янтарная Смола', xpReq: 1500, perk: 'Доступ к интерактивным 3D-симуляторам бурения', cx: 265, cy: 190, color: '#FFAA00' },
  { id: 4, level: 20, title: 'Изумрудный Побег', xpReq: 3000, perk: 'Генерация официального PDF-сертификата отличия', cx: 115, cy: 135, color: '#22D3EE' },
  { id: 5, level: 30, title: 'Шишка Самотлора', xpReq: 5000, perk: 'Право голосовать за проекты в экспертном совете', cx: 285, cy: 130, color: '#FFAA00' },
  { id: 6, level: 40, title: 'Золотой Плод Югры', xpReq: 8000, perk: 'Золотая рамка профиля и статус Наставника', cx: 155, cy: 85, color: '#FFD700' },
  { id: 7, level: 50, title: 'Звезда Нефтяного Края', xpReq: 12000, perk: 'Высшая награда Оргкомитета региона', cx: 200, cy: 50, color: '#FF5252' }
];

export default function ProfilePage() {
  const { username } = useParams();
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('wall'); // wall | tree | projects | activity
  const [wallContent, setWallContent] = useState('');
  const [wallLink, setWallLink] = useState('');
  const [selectedFruit, setSelectedFruit] = useState(TREE_FRUITS[0]);

  const [openCommentsPostId, setOpenCommentsPostId] = useState(null);
  const [commentInput, setCommentInput] = useState('');

  const [mentorInput, setMentorInput] = useState('');
  const [studentInput, setStudentInput] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    bio: '',
    status: 'online',
    city: '',
    school: '',
    grade: '',
    interests: '',
    telegram: '',
    vk: ''
  });

  const [privacySettings, setPrivacySettings] = useState({
    show_online: true,
    allow_direct_messages: 'all',
    show_streak_xp: true
  });

  // Загружаем профиль
  const { data: profileBundle, isLoading } = useQuery({
    queryKey: ['profile_bundle_v17', username || myProfile?.id],
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
          ? supabase.from('profiles').select('id, username, full_name, avatar_url, status').eq('id', target.mentor_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('profiles').select('id, username, full_name, xp, status, avatar_url').eq('mentor_id', target.id)
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
  const isMentorRole =
    profileBundle?.targetRoleNames?.includes('teacher') ||
    profileBundle?.highestRole?.name === 'teacher' ||
    profileBundle?.highestRole?.name === 'admin' ||
    profileBundle?.highestRole?.name === 'dev';

  // ЗАГРУЗКА wall_posts + wall_comments + wall_likes
  const { data: wallPosts = [], isLoading: wallLoading } = useQuery({
    queryKey: ['profile_wall_posts_v17', targetProfile?.id, user?.id],
    enabled: Boolean(targetProfile?.id),
    queryFn: async () => {
      try {
        const [postsRes, commentsRes, profsRes, myLikesRes] = await Promise.all([
          supabase.from('wall_posts').select('*').eq('author_id', targetProfile.id),
          supabase.from('wall_comments').select('*').order('created_at', { ascending: true }),
          supabase.from('profiles').select('id, username, full_name, avatar_url'),
          user?.id
            ? supabase.from('wall_likes').select('post_id').eq('user_id', user.id)
            : Promise.resolve({ data: [] })
        ]);

        const profMap = Object.fromEntries((profsRes.data || []).map((p) => [p.id, p]));
        const myLikedSet = new Set((myLikesRes.data || []).map((l) => l.post_id));

        const commentsByPost = {};
        (commentsRes.data || []).forEach((c) => {
          if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
          commentsByPost[c.post_id].push({
            ...c,
            author: profMap[c.author_id] || { username: '@участник' }
          });
        });

        const sorted = (postsRes.data || []).sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );

        return sorted.map((p) => ({
          ...p,
          isLiked: myLikedSet.has(p.id),
          comments: commentsByPost[p.id] || []
        }));
      } catch {
        return [];
      }
    }
  });

  // Безопасный лайк поста через таблицу wall_likes (без ошибки duplicate key)
  const toggleLikeMutation = useMutation({
    mutationFn: async (post) => {
      if (!user?.id) throw new Error('Требуется авторизация');
      checkRateLimit('wall_like_toggle', 300);

      const { data: existingLike } = await supabase
        .from('wall_likes')
        .select('*')
        .match({ post_id: post.id, user_id: user.id })
        .maybeSingle();

      if (existingLike || post.isLiked) {
        const { error } = await supabase
          .from('wall_likes')
          .delete()
          .match({ post_id: post.id, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('wall_likes')
          .insert([{ post_id: post.id, user_id: user.id }]);
        if (error && !error.message?.includes('duplicate key') && !error.message?.includes('wall_likes_pkey')) {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_wall_posts_v17', targetProfile?.id] });
      queryClient.invalidateQueries({ queryKey: ['home_wall_posts_feed_v15'] });
    },
    onError: (err) => toast(err.message, 'error')
  });

  // ПУБЛИКАЦИЯ В wall_posts
  const createWallPostMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      if (!wallContent.trim() || !user?.id) return;
      if (myProfile?.is_banned) throw new Error('Ваш аккаунт ограничен модератором');
      checkRateLimit('wall_post_create', 1500);

      const payload = {
        author_id: user.id,
        content: wallContent.trim(),
        link_url: wallLink.trim() || null,
        images: [],
        visibility: 'public'
      };

      const { error } = await supabase.from('wall_posts').insert([payload]);
      if (error) throw error;

      await supabase.rpc('award_xp_secure', {
        p_action: 'wall_post_created',
        p_entity: 'wall_post',
        p_xp_delta: 20,
        p_badge: 'Голос сообщества'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_wall_posts_v17', targetProfile?.id] });
      queryClient.invalidateQueries({ queryKey: ['home_wall_posts_feed_v15'] });
      setWallContent('');
      setWallLink('');
      toast('Запись опубликована на стене! (+20 XP)', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // ДОБАВЛЕНИЕ КОММЕНТАРИЯ
  const addCommentMutation = useMutation({
    mutationFn: async ({ postId, text }) => {
      if (!text.trim() || !user?.id) return;
      if (myProfile?.is_banned) throw new Error('Ваш аккаунт заблокирован');

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
      queryClient.invalidateQueries({ queryKey: ['profile_wall_posts_v17', targetProfile?.id] });
      setCommentInput('');
      toast('Комментарий добавлен', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // УДАЛЕНИЕ КОММЕНТАРИЯ
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId) => {
      const { error } = await supabase.from('wall_comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_wall_posts_v17', targetProfile?.id] });
      toast('Комментарий удалён', 'info');
    }
  });

  // УДАЛЕНИЕ ПОСТА
  const deleteWallPostMutation = useMutation({
    mutationFn: async (postId) => {
      const { error } = await supabase.from('wall_posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_wall_posts_v17', targetProfile?.id] });
      queryClient.invalidateQueries({ queryKey: ['home_wall_posts_feed_v15'] });
      toast('Запись удалена со стены', 'info');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Наставничество: привязка
  const studentBindMentorMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      const raw = mentorInput.trim();
      if (!raw) throw new Error('Введите никнейм наставника');
      const clean = raw.startsWith('@') ? raw : `@${raw}`;

      const { data: foundMentor } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .ilike('username', clean)
        .maybeSingle();

      if (!foundMentor) throw new Error(`Пользователь ${clean} не найден`);
      if (foundMentor.id === user.id) throw new Error('Нельзя назначить себя');

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', foundMentor.id);

      const roleIds = (rolesData || []).map((r) => r.role_id);
      const isEligible = roleIds.includes(2) || roleIds.includes(4) || roleIds.includes(5);

      if (!isEligible) throw new Error(`У пользователя ${clean} нет статуса Наставника`);

      const { error } = await supabase
        .from('profiles')
        .update({ mentor_id: foundMentor.id })
        .eq('id', user.id);

      if (error) throw error;
      return foundMentor;
    },
    onSuccess: (mentor) => {
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v17'] });
      if (refreshProfile) refreshProfile();
      setMentorInput('');
      toast(`Наставник ${mentor.username} привязан!`, 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  const mentorBindStudentMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      const raw = studentInput.trim();
      if (!raw) throw new Error('Введите никнейм ученика');
      const clean = raw.startsWith('@') ? raw : `@${raw}`;

      const { data: foundStudent } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .ilike('username', clean)
        .maybeSingle();

      if (!foundStudent) throw new Error(`Ученик ${clean} не найден`);

      const { error } = await supabase
        .from('profiles')
        .update({ mentor_id: user.id })
        .eq('id', foundStudent.id);

      if (error) throw error;
      return foundStudent;
    },
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v17'] });
      setStudentInput('');
      toast(`Ученик ${student.username} привязан к вам!`, 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  const mentorUnbindStudentMutation = useMutation({
    mutationFn: async (studentId) => {
      const { error } = await supabase.from('profiles').update({ mentor_id: null }).eq('id', studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v17'] });
      toast('Ученик отвязан', 'info');
    }
  });

  const studentUnbindMentorMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({ mentor_id: null }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v17'] });
      if (refreshProfile) refreshProfile();
      toast('Наставник отвязан', 'info');
    }
  });

  // Сохранение анкеты
  const updateProfileMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileForm.full_name.trim(),
          bio: profileForm.bio.trim(),
          status: profileForm.status,
          city: profileForm.city.trim(),
          school: profileForm.school.trim(),
          grade: profileForm.grade.trim(),
          interests: profileForm.interests.trim(),
          telegram: profileForm.telegram.trim(),
          vk: profileForm.vk.trim()
        })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v17'] });
      if (refreshProfile) refreshProfile();
      setEditOpen(false);
      toast('Анкета сохранена!', 'success');
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
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v17'] });
      if (refreshProfile) refreshProfile();
      toast('Аватар обновлён!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (isLoading || !profileBundle) return <Skeleton className="h-96 w-full" />;

  const { highestRole, mentorObj, menteesList, projects, activities } = profileBundle;
  const userXp = targetProfile.xp || 100;
  const level = Math.floor(userXp / 250) + 1;
  const badges = Array.isArray(targetProfile.badges) ? targetProfile.badges : ['Пионер Югры'];
  const userStatus = STATUS_OPTIONS.find((s) => s.value === targetProfile.status) || STATUS_OPTIONS[0];

  // Вычисляем стадию роста дерева от XP (масштаб от 0.55 до 1.08)
  const unlockedFruitsCount = TREE_FRUITS.filter((f) => userXp >= f.xpReq).length;
  const treeScale = Math.min(1.06, 0.58 + (unlockedFruitsCount / TREE_FRUITS.length) * 0.48);
  const treeStageName =
    unlockedFruitsCount <= 2
      ? 'Молодой саженец Югры'
      : unlockedFruitsCount <= 4
      ? 'Окрепший таёжный кедр'
      : unlockedFruitsCount <= 6
      ? 'Плодоносящее древо промысла'
      : 'Вековой исполин Зелёной Югры';

  return (
    <div className="space-y-8">
      {/* 1. ШАПКА ПРОФИЛЯ */}
      <Card className="p-6 sm:p-8 border-[#00C853]/30 bg-gradient-to-r from-[#060a14] via-[#071914] to-[#050810] shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
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
                <Badge color={userStatus.color}>
                  <Radio size={10} className="mr-1 animate-pulse" /> {userStatus.label}
                </Badge>
                <Badge color="emerald">Уровень {level}</Badge>
                <Badge color="gold">
                  <Flame size={12} /> Серия {targetProfile.streak_days || 1} дн.
                </Badge>
                {targetProfile.is_banned && <Badge color="red">Аккаунт заблокирован</Badge>}
              </div>

              <h1 className="text-2xl sm:text-3xl font-semibold text-white">{targetProfile.full_name}</h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#8A93A6] pt-0.5">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <MapPin size={13} className="text-[#00C853]" />
                  {targetProfile.city || 'ХМАО-Югра, пгт. Пойковский'}
                </span>
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <School size={13} className="text-[#22D3EE]" />
                  {targetProfile.school || targetProfile.organizations?.name || 'МБОУ «СОШ № 1»'}
                  {targetProfile.grade ? ` • ${targetProfile.grade}` : ''}
                </span>
              </div>

              {targetProfile.bio && (
                <p className="text-xs text-zinc-200 max-w-xl pt-1.5 leading-relaxed">{targetProfile.bio}</p>
              )}

              {(targetProfile.telegram || targetProfile.vk) && (
                <div className="flex items-center gap-3 pt-1 text-xs font-mono">
                  {targetProfile.telegram && (
                    <a
                      href={`https://t.me/${targetProfile.telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#22D3EE] hover:underline flex items-center gap-1"
                    >
                      <Send size={11} /> {targetProfile.telegram}
                    </a>
                  )}
                  {targetProfile.vk && (
                    <a
                      href={targetProfile.vk.startsWith('http') ? targetProfile.vk : `https://vk.com/${targetProfile.vk}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#3b82f6] hover:underline flex items-center gap-1"
                    >
                      <Share2 size={11} /> VK
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {isOwnProfile ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setProfileForm({
                      full_name: targetProfile.full_name || '',
                      bio: targetProfile.bio || '',
                      status: targetProfile.status || 'online',
                      city: targetProfile.city || 'пгт. Пойковский',
                      school: targetProfile.school || 'МБОУ «СОШ № 1»',
                      grade: targetProfile.grade || '10 класс',
                      interests: targetProfile.interests || 'Экология, нефтехимия, IT-моделирование',
                      telegram: targetProfile.telegram || '',
                      vk: targetProfile.vk || ''
                    });
                    setEditOpen(true);
                  }}
                >
                  <Edit3 size={14} /> Редактировать анкету
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                  <Settings size={14} /> Приватность
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

      {/* 2. СЕТКА КОНТЕНТА */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ЛЕВАЯ КОЛОНКА */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-5 space-y-3.5 border-white/10 bg-[#060a14]">
            <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00] flex items-center gap-2">
              <GraduationCap size={15} /> Досье участника платформы
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-[#050810] border border-white/5 rounded">
                <span className="text-[#8A93A6] block text-[10px] font-mono uppercase">Образование:</span>
                <span className="text-white font-medium">{targetProfile.school || 'МБОУ «СОШ № 1» пгт. Пойковский'}</span>
                {targetProfile.grade && <span className="text-[#34D399] ml-2 font-mono">({targetProfile.grade})</span>}
              </div>

              <div className="p-2.5 bg-[#050810] border border-white/5 rounded">
                <span className="text-[#8A93A6] block text-[10px] font-mono uppercase">Муниципалитет / Город:</span>
                <span className="text-white font-medium">{targetProfile.city || 'ХМАО-Югра, Нефтеюганский район'}</span>
              </div>

              {targetProfile.interests && (
                <div className="p-2.5 bg-[#050810] border border-white/5 rounded">
                  <span className="text-[#8A93A6] block text-[10px] font-mono uppercase">Научные интересы:</span>
                  <span className="text-zinc-200">{targetProfile.interests}</span>
                </div>
              )}
            </div>
          </Card>

          {/* БЛОК НАСТАВНИКА ДЛЯ УЧЕНИКА */}
          <Card className="p-5 space-y-4 border-[#22D3EE]/30 bg-[#060a14]">
            <div className="font-mono text-xs uppercase tracking-widest text-[#22D3EE] flex items-center gap-2">
              <UserCheck size={15} /> Научный наставник
            </div>

            {mentorObj ? (
              <div className="p-3.5 rounded-lg border border-[#22D3EE]/30 bg-[#050810] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#8A93A6]">Прикреплённый наставник:</span>
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
                    onClick={() => studentUnbindMentorMutation.mutate()}
                    className="text-[10px] font-mono text-red-400 hover:underline pt-1 block"
                  >
                    Сменить / отвязать наставника
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#8A93A6] leading-relaxed">
                  Наставник курирует ваши проекты и допускает к защите. Введите логин наставника.
                </p>

                {isOwnProfile && (
                  <form onSubmit={(e) => studentBindMentorMutation.mutate(e)} className="space-y-2">
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
                      disabled={studentBindMentorMutation.isPending}
                    >
                      <LinkIcon size={13} /> Привязать наставника
                    </Button>
                  </form>
                )}
              </div>
            )}
          </Card>

          {/* ПРИВЯЗКА УЧЕНИКОВ САМИМ НАСТАВНИКОМ */}
          {isMentorRole && (
            <Card className="p-5 space-y-4 border-[#00C853]/30 bg-[#060a14]">
              <div className="font-mono text-xs uppercase tracking-widest text-[#34D399] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserPlus size={15} /> Ученики наставника ({menteesList.length})
                </span>
                <Badge color="emerald">Роль наставника</Badge>
              </div>

              {isOwnProfile && (
                <form onSubmit={(e) => mentorBindStudentMutation.mutate(e)} className="space-y-2 pt-1">
                  <div className="text-xs text-zinc-300">Привязать ученика по его юзернейму:</div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="@username_ученика"
                      value={studentInput}
                      onChange={(e) => setStudentInput(e.target.value)}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="gold"
                      className="shrink-0"
                      disabled={mentorBindStudentMutation.isPending}
                    >
                      Привязать
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-2 pt-2 border-t border-white/10">
                {menteesList.length === 0 ? (
                  <div className="text-xs text-[#8A93A6] font-mono py-2">Пока нет привязанных учеников.</div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {menteesList.map((st) => (
                      <div
                        key={st.id}
                        className="p-2.5 rounded border border-white/5 bg-[#050810] flex items-center justify-between text-xs"
                      >
                        <div
                          onClick={() => navigate(`/profile/${st.username.replace('@', '')}`)}
                          className="cursor-pointer"
                        >
                          <span className="font-mono text-[#FFAA00] block">{st.username}</span>
                          <span className="text-zinc-300 text-[11px]">{st.full_name}</span>
                        </div>
                        {isOwnProfile && (
                          <button
                            onClick={() => mentorUnbindStudentMutation.mutate(st.id)}
                            className="p-1 text-[#8A93A6] hover:text-red-400"
                            title="Отвязать ученика"
                          >
                            <UserMinus size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

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

        {/* ПРАВАЯ КОЛОНКА: СТЕНА + РАСТУЩЕЕ ДЕРЕВО С ПЛОДАМИ + ПРОЕКТЫ + ИСТОРИЯ */}
        <div className="lg:col-span-8 space-y-5">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
            <button
              onClick={() => setActiveTab('wall')}
              className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all flex items-center gap-1.5 ${
                activeTab === 'wall'
                  ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold shadow-[0_0_12px_rgba(0,200,83,0.2)]'
                  : 'border-white/10 text-[#8A93A6] hover:text-white'
              }`}
            >
              <MessageCircle size={14} /> Стена профиля ({wallPosts.length})
            </button>

            <button
              onClick={() => setActiveTab('tree')}
              className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all flex items-center gap-1.5 ${
                activeTab === 'tree'
                  ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00] font-bold shadow-[0_0_12px_rgba(255,170,0,0.2)]'
                  : 'border-white/10 text-[#8A93A6] hover:text-white'
              }`}
            >
              <Trees size={14} /> Древо Югры ({unlockedFruitsCount}/{TREE_FRUITS.length})
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
                  ? 'border-white/30 bg-white/10 text-white font-bold'
                  : 'border-white/10 text-[#8A93A6] hover:text-white'
              }`}
            >
              <Clock size={14} /> История XP
            </button>
          </div>

          {/* ВКЛАДКА: СТЕНА ПРОФИЛЯ */}
          {activeTab === 'wall' && (
            <div className="space-y-4">
              {isOwnProfile && (
                <Card className="p-4 bg-[#060a14] border-white/10 space-y-3">
                  <form onSubmit={(e) => createWallPostMutation.mutate(e)} className="space-y-3">
                    <textarea
                      rows={3}
                      value={wallContent}
                      onChange={(e) => setWallContent(e.target.value)}
                      placeholder="Опубликовать мысль, результат эксперимента или отчёт на своей стене..."
                      className="w-full bg-[#050810] border border-white/15 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-[#00C853]"
                      required
                    />

                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                      <div className="flex-1">
                        <Input
                          placeholder="Прикрепить ссылку (https://...)"
                          value={wallLink}
                          onChange={(e) => setWallLink(e.target.value)}
                        />
                      </div>
                      <Button type="submit" size="sm" disabled={createWallPostMutation.isPending} className="shrink-0">
                        <Send size={13} /> Опубликовать (+20 XP)
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {wallLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : wallPosts.length === 0 ? (
                <Card className="p-8 text-center font-mono text-xs text-[#8A93A6] bg-[#060a14]">
                  На стене пока нет записей. {isOwnProfile ? 'Напишите первый пост выше!' : ''}
                </Card>
              ) : (
                wallPosts.map((post) => {
                  const comments = post.comments || [];
                  const isCommentsOpen = openCommentsPostId === post.id;
                  const isLiked = Boolean(post.isLiked);

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
                              {new Date(post.created_at || Date.now()).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {isOwnProfile && (
                          <button
                            onClick={() => deleteWallPostMutation.mutate(post.id)}
                            className="p-1.5 rounded hover:bg-red-500/10 text-[#8A93A6] hover:text-red-400"
                            title="Удалить запись со стены"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">
                        {post.content}
                      </p>

                      {post.link_url && (
                        <a
                          href={post.link_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 p-2 bg-white/5 border border-white/10 rounded text-xs text-[#22D3EE] hover:underline"
                        >
                          <ExternalLink size={12} /> {post.link_url}
                        </a>
                      )}

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-[#8A93A6]">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => toggleLikeMutation.mutate(post)}
                            disabled={toggleLikeMutation.isPending}
                            className={`px-3 py-1 rounded border font-mono text-xs flex items-center gap-1.5 transition-all ${
                              isLiked
                                ? 'border-[#00C853] bg-[#00C853]/20 text-[#34D399] shadow-[0_0_12px_rgba(0,200,83,0.3)]'
                                : 'border-white/10 text-[#8A93A6] hover:text-white hover:border-white/30'
                            }`}
                            title={isLiked ? 'Снять отметку «Нравится»' : 'Поставить отметку «Нравится»'}
                          >
                            <Heart size={13} className={isLiked ? 'fill-[#34D399] text-[#34D399]' : ''} />
                            <span>{post.likes_count || 0}</span>
                          </button>

                          {/* ТОЛЬКО ЗНАЧОК КОММЕНТАРИЕВ И ЧИСЛО (БЕЗ НАДПИСИ) */}
                          <button
                            onClick={() => setOpenCommentsPostId(isCommentsOpen ? null : post.id)}
                            className={`px-3 py-1 rounded border font-mono text-xs flex items-center gap-1.5 transition-all ${
                              isCommentsOpen
                                ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE]'
                                : 'border-white/10 text-zinc-300 hover:text-white hover:border-white/30'
                            }`}
                            title="Открыть комментарии"
                          >
                            <MessageSquare size={13} />
                            <span>{comments.length}</span>
                          </button>
                        </div>
                        <span>Стена исследователя</span>
                      </div>

                      {/* БЛОК КОММЕНТАРИЕВ */}
                      {isCommentsOpen && (
                        <div className="pt-3 border-t border-white/10 space-y-3">
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {comments.length === 0 ? (
                              <div className="text-[11px] text-[#8A93A6] font-mono py-1">
                                Нет комментариев. Напишите первым!
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
                                  {(c.author_id === user?.id || isOwnProfile) && (
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
                              addCommentMutation.mutate({ postId: post.id, text: commentInput });
                            }}
                            className="flex gap-2"
                          >
                            <input
                              type="text"
                              value={commentInput}
                              onChange={(e) => setCommentInput(e.target.value)}
                              placeholder="Написать комментарий..."
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
                })
              )}
            </div>
          )}

          {/* НАСТОЯЩЕЕ РАСТУЩЕЕ ДЕРЕВО С ПЛОДАМИ (КЕДР ЮГРЫ) */}
          {activeTab === 'tree' && (
            <Card className="p-6 sm:p-8 border-[#00C853]/30 bg-gradient-to-b from-[#061217] via-[#050a12] to-[#04070d] space-y-6 relative overflow-hidden">
              {/* Заголовок и прогресс */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <div className="eyebrow">Живая экосистема прогресса ХМАО-Югры</div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2.5 mt-1">
                    <Trees size={22} className="text-[#00C853]" />
                    {treeStageName}
                  </h2>
                  <p className="text-xs text-[#8A93A6] mt-1">
                    Дерево растёт по мере накопления опыта и приносит плоды-награды. Нажмите на любой плод на кроне!
                  </p>
                </div>
                <div className="text-left sm:text-right font-mono">
                  <div className="text-lg font-bold text-[#34D399]">{userXp} XP</div>
                  <div className="text-[11px] text-[#FFAA00]">
                    Созрело плодов: {unlockedFruitsCount} из {TREE_FRUITS.length}
                  </div>
                </div>
              </div>

              {/* Визуальная сцена с растущим SVG-Деревом и интерактивными плодами */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-7 relative flex items-center justify-center bg-[#03060c]/90 rounded-2xl border border-white/10 p-4 min-h-[360px] overflow-hidden shadow-inner">
                  {/* Фоновое северное сияние */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-40 bg-[#00C853]/15 blur-3xl rounded-full pointer-events-none" />
                  <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-[#092218]/60 to-transparent pointer-events-none" />

                  <svg
                    viewBox="0 0 400 340"
                    className="w-full max-w-[380px] h-auto select-none transition-transform duration-700"
                    style={{
                      transform: `scale(${treeScale})`,
                      transformOrigin: '200px 310px'
                    }}
                  >
                    <defs>
                      <radialGradient id="canopyGlow" cx="50%" cy="45%" r="55%">
                        <stop offset="0%" stopColor="#34D399" stopOpacity="0.35" />
                        <stop offset="60%" stopColor="#00C853" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#050810" stopOpacity="0" />
                      </radialGradient>
                      <linearGradient id="trunkGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#4A2E1B" />
                        <stop offset="50%" stopColor="#6E472B" />
                        <stop offset="100%" stopColor="#3B2313" />
                      </linearGradient>
                      <linearGradient id="foliage1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#047857" />
                      </linearGradient>
                      <linearGradient id="foliage2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34D399" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>

                    {/* Сияние кроны */}
                    <circle cx="200" cy="145" r="135" fill="url(#canopyGlow)" />

                    {/* Земля / Таёжный холм */}
                    <path
                      d="M40 315 Q200 285 360 315 L380 340 L20 340 Z"
                      fill="#0c291e"
                      stroke="#00C853"
                      strokeOpacity="0.4"
                      strokeWidth="1.5"
                    />

                    {/* Корни и мощный ствол кедра */}
                    <path
                      d="M165 315 Q182 290 186 240 L188 120 L212 120 L214 240 Q218 290 235 315 Z"
                      fill="url(#trunkGrad)"
                    />
                    {/* Боковые ветви */}
                    <path d="M192 220 Q150 205 125 190" stroke="#5c3a21" strokeWidth="7" strokeLinecap="round" fill="none" />
                    <path d="M208 215 Q250 200 275 185" stroke="#5c3a21" strokeWidth="7" strokeLinecap="round" fill="none" />
                    <path d="M194 165 Q145 150 115 135" stroke="#5c3a21" strokeWidth="5.5" strokeLinecap="round" fill="none" />
                    <path d="M206 160 Q255 145 285 130" stroke="#5c3a21" strokeWidth="5.5" strokeLinecap="round" fill="none" />

                    {/* Пышная многоярусная крона кедра */}
                    <g opacity="0.95">
                      {/* Нижний ярус хвои */}
                      <ellipse cx="140" cy="200" rx="60" ry="38" fill="url(#foliage1)" />
                      <ellipse cx="260" cy="195" rx="60" ry="38" fill="url(#foliage1)" />
                      <ellipse cx="200" cy="210" rx="75" ry="42" fill="url(#foliage2)" />

                      {/* Средний ярус хвои */}
                      <ellipse cx="130" cy="145" rx="55" ry="36" fill="url(#foliage2)" />
                      <ellipse cx="270" cy="140" rx="55" ry="36" fill="url(#foliage2)" />
                      <ellipse cx="200" cy="150" rx="72" ry="45" fill="url(#foliage1)" />

                      {/* Верхний ярус и верхушка */}
                      <ellipse cx="165" cy="95" rx="48" ry="34" fill="url(#foliage2)" />
                      <ellipse cx="235" cy="95" rx="48" ry="34" fill="url(#foliage2)" />
                      <ellipse cx="200" cy="70" rx="52" ry="38" fill="url(#foliage2)" />
                    </g>

                    {/* ИНТЕРАКТИВНЫЕ ПЛОДЫ НА ВЕТВЯХ ДЕРЕВА */}
                    {TREE_FRUITS.map((fruit) => {
                      const isRipe = userXp >= fruit.xpReq;
                      const isSelected = selectedFruit?.id === fruit.id;

                      return (
                        <g
                          key={fruit.id}
                          onClick={() => setSelectedFruit(fruit)}
                          className="cursor-pointer transition-transform"
                        >
                          {/* Пульсирующий ореол для созревшего плода */}
                          {isRipe && (
                            <circle
                              cx={fruit.cx}
                              cy={fruit.cy}
                              r={isSelected ? 22 : 17}
                              fill={fruit.color}
                              opacity={isSelected ? 0.35 : 0.2}
                            />
                          )}

                          {/* Сам плод */}
                          <circle
                            cx={fruit.cx}
                            cy={fruit.cy}
                            r={isSelected ? 14 : 11}
                            fill={isRipe ? fruit.color : '#111827'}
                            stroke={isSelected ? '#FFFFFF' : isRipe ? '#FEF08A' : '#4B5563'}
                            strokeWidth={isSelected ? 3 : 2}
                          />

                          {/* Блик или уровень внутри плода */}
                          <text
                            x={fruit.cx}
                            y={fruit.cy + 3.5}
                            textAnchor="middle"
                            fill={isRipe ? '#050810' : '#9CA3AF'}
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {fruit.level}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  <div className="absolute bottom-2.5 left-4 right-4 flex justify-between items-center text-[10px] font-mono text-[#8A93A6]">
                    <span>Масштаб роста: {Math.round(treeScale * 100)}%</span>
                    <span className="text-[#34D399]">● Цветной плод — созрел</span>
                  </div>
                </div>

                {/* Правая панель: выбранный плод и список всех плодов */}
                <div className="md:col-span-5 space-y-4">
                  {selectedFruit && (
                    <div className="p-4 rounded-xl border border-[#FFAA00]/40 bg-[#050810] space-y-2.5 shadow-lg">
                      <div className="flex items-center justify-between">
                        <Badge color={userXp >= selectedFruit.xpReq ? 'emerald' : 'zinc'}>
                          {userXp >= selectedFruit.xpReq ? '🍎 Плод созрел' : `🔒 Требуется ${selectedFruit.xpReq} XP`}
                        </Badge>
                        <span className="font-mono text-xs text-[#FFAA00] font-bold">
                          Уровень {selectedFruit.level}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-white">{selectedFruit.title}</h3>
                      <p className="text-xs text-zinc-300 leading-relaxed">{selectedFruit.perk}</p>
                      {userXp < selectedFruit.xpReq && (
                        <div className="pt-1 font-mono text-[11px] text-[#8A93A6]">
                          До созревания плода осталось: <strong className="text-white">{selectedFruit.xpReq - userXp} XP</strong>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {TREE_FRUITS.map((f) => {
                      const unlocked = userXp >= f.xpReq;
                      const active = selectedFruit?.id === f.id;
                      return (
                        <div
                          key={f.id}
                          onClick={() => setSelectedFruit(f)}
                          className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all text-xs ${
                            active
                              ? 'border-[#00C853] bg-[#00C853]/15 text-white'
                              : 'border-white/5 bg-[#050810]/70 text-zinc-300 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: unlocked ? f.color : '#374151' }}
                            />
                            <span className="font-medium truncate">{f.title}</span>
                          </div>
                          <span className="font-mono text-[10px] text-[#FFAA00] shrink-0 ml-2">
                            {unlocked ? 'Созрел ✓' : `${f.xpReq} XP`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
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

      {/* МОДАЛКА РЕДАКТИРОВАНИЯ АНКЕТЫ */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Анкета исследователя «Югра.Нефть»">
        <form onSubmit={(e) => updateProfileMutation.mutate(e)} className="space-y-4 text-xs">
          <Input
            label="ФИО / Отображаемое имя"
            value={profileForm.full_name}
            onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">
                Сетевой статус (присутствие)
              </label>
              <select
                value={profileForm.status}
                onChange={(e) => setProfileForm({ ...profileForm, status: e.target.value })}
                className="w-full bg-[#050810] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#00C853]"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Город / Населённый пункт ХМАО"
              placeholder="пгт. Пойковский, Сургут..."
              value={profileForm.city}
              onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Образовательное учреждение"
              placeholder="МБОУ «СОШ № 1»"
              value={profileForm.school}
              onChange={(e) => setProfileForm({ ...profileForm, school: e.target.value })}
            />
            <Input
              label="Класс / Курс"
              placeholder="10 класс"
              value={profileForm.grade}
              onChange={(e) => setProfileForm({ ...profileForm, grade: e.target.value })}
            />
          </div>

          <Input
            label="Научные интересы / Специализация"
            placeholder="Экология, нефтехимия, IT..."
            value={profileForm.interests}
            onChange={(e) => setProfileForm({ ...profileForm, interests: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Telegram (для связи)"
              placeholder="@username"
              value={profileForm.telegram}
              onChange={(e) => setProfileForm({ ...profileForm, telegram: e.target.value })}
            />
            <Input
              label="ВКонтакте (VK)"
              placeholder="id_или_логин"
              value={profileForm.vk}
              onChange={(e) => setProfileForm({ ...profileForm, vk: e.target.value })}
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">
              О себе / Краткая характеристика
            </label>
            <textarea
              rows={3}
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              placeholder="Расскажите о ваших инженерных целях и разработках..."
              className="w-full bg-[#050810] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#00C853]"
            />
          </div>

          <Button type="submit" className="w-full justify-center">
            Сохранить данные анкеты
          </Button>
        </form>
      </Modal>

      {/* МОДАЛКА ПРИВАТНОСТИ */}
      <Modal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="Настройки приватности">
        <div className="space-y-4 text-xs">
          <div className="space-y-3 p-4 bg-[#050810] rounded-lg border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">Отображать статус онлайн</div>
                <div className="text-[#8A93A6] text-[11px]">Показывать другим исследователям ваше присутствие</div>
              </div>
              <input
                type="checkbox"
                checked={privacySettings.show_online}
                onChange={(e) => setPrivacySettings({ ...privacySettings, show_online: e.target.checked })}
                className="accent-[#00C853] w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <div className="text-white font-medium">Личные сообщения (ЛС)</div>
                <div className="text-[#8A93A6] text-[11px]">Кто может писать вам в чате</div>
              </div>
              <select
                value={privacySettings.allow_direct_messages}
                onChange={(e) => setPrivacySettings({ ...privacySettings, allow_direct_messages: e.target.value })}
                className="bg-[#030509] border border-white/15 rounded px-2 py-1 text-xs text-white"
              >
                <option value="all">Все участники</option>
                <option value="mentor_only">Только мой наставник</option>
                <option value="none">Никто</option>
              </select>
            </div>
          </div>

          <Button
            onClick={() => {
              setSettingsOpen(false);
              toast('Параметры приватности обновлены!', 'success');
            }}
            variant="gold"
            className="w-full justify-center"
          >
            Применить
          </Button>
        </div>
      </Modal>

      {/* МОДАЛКА ЖАЛОБЫ */}
      <Modal isOpen={reportOpen} onClose={() => setReportOpen(false)} title={`Жалоба на ${targetProfile.username}`}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await supabase.from('wall_reports').insert([
              {
                reporter_id: user.id,
                target_id: targetProfile.id,
                reason: reportReason.trim(),
                status: 'pending'
              }
            ]);
            if (error) {
              toast(error.message, 'error');
            } else {
              setReportOpen(false);
              setReportReason('');
              toast('Жалоба передана модераторам!', 'success');
            }
          }}
          className="space-y-4"
        >
          <textarea
            rows={4}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Опишите причину нарушения..."
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
            {targetProfile.school} • {targetProfile.city}
          </div>
          <div className="font-mono text-xs text-[#34D399]">
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