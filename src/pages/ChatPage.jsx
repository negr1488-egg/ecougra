import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, checkRateLimit, uploadFileToStorage } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Avatar, Badge, Modal, useToast } from '../components/ui/DesignSystem';
import { getHighestRole, ROLE_ID_MAP } from '../utils/roleUtils';
import {
  Send,
  Paperclip,
  Plus,
  Search,
  Pin,
  Reply,
  Edit2,
  Trash2,
  Archive,
  BellOff,
  Bell,
  SmilePlus,
  Check,
  Hash,
  MessageSquare,
  Sparkles,
  Flag,
  ShieldAlert,
  Ban,
  FileText,
  ExternalLink,
  X
} from 'lucide-react';

const EMOJIS = ['👍', '❤️', '🔥', '🌲', '💡', '🎉'];

const DEFAULT_CHATS = [
  { id: 'aaaa1111-1111-1111-1111-111111111111', type: 'general', title: 'Общий канал промысла' },
  { id: 'bbbb2222-2222-2222-2222-222222222222', type: 'support', title: 'Вопросы экспертам жюри' }
];

const REPORT_REASONS = [
  'Спам, реклама или флуд в канале',
  'Оскорбления участников или токсичное поведение',
  'Публикация недостоверных расчётов / плагиат проекта',
  'Нарушение правил безопасности платформы'
];

export default function ChatPage() {
  const { user, profile, hasRole, setUnreadChatCount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const isAdmin = hasRole(['admin', 'dev']);

  const [activeChatId, setActiveChatId] = useState(
    searchParams.get('room') || DEFAULT_CHATS[0].id
  );
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [msgSearch, setMsgSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedIds, setArchivedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ugra_archived_chats') || '[]');
    } catch {
      return [];
    }
  });
  const [mutedIds, setMutedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ugra_muted_chats') || '[]');
    } catch {
      return [];
    }
  });
  const [reactionMenuMsgId, setReactionMenuMsgId] = useState(null);

  // Состояния для системы жалоб
  const [reportTarget, setReportTarget] = useState(null); // { userObj, messageObj }
  const [reportCategory, setReportCategory] = useState(REPORT_REASONS[0]);
  const [reportComment, setReportComment] = useState('');

  // Онлайн и индикатор печати
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [newChatModal, setNewChatModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');

  const bottomRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (setUnreadChatCount) setUnreadChatCount(0);
  }, [setUnreadChatCount]);

  // Сохранение архива и мута в localStorage
  const toggleArchiveChat = (chatId, e) => {
    e?.stopPropagation();
    setArchivedIds((prev) => {
      const next = prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId];
      localStorage.setItem('ugra_archived_chats', JSON.stringify(next));
      return next;
    });
    toast('Статус архивации канала обновлён', 'info');
  };

  const toggleMuteChat = (chatId) => {
    setMutedIds((prev) => {
      const next = prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId];
      localStorage.setItem('ugra_muted_chats', JSON.stringify(next));
      return next;
    });
  };

  // 1. Загрузка списка комнат
  const { data: chats = DEFAULT_CHATS } = useQuery({
    queryKey: ['chats_list_v8', user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('chats')
          .select('*')
          .order('created_at', { ascending: true });
        if (error || !data || data.length === 0) return DEFAULT_CHATS;
        return data.filter((c) => !c.deleted_at);
      } catch {
        return DEFAULT_CHATS;
      }
    }
  });

  // 2. Загрузка профилей вместе с их ролями из user_roles
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['chat_all_profiles_with_roles_v8'],
    queryFn: async () => {
      const [profRes, urRes] = await Promise.all([
        supabase.from('profiles').select('id, username, full_name, avatar_url, status, xp, is_banned, mentor_id'),
        supabase.from('user_roles').select('user_id, role_id')
      ]);

      const roleMap = {};
      (urRes.data || []).forEach((ur) => {
        if (!roleMap[ur.user_id]) roleMap[ur.user_id] = [];
        const rName = ROLE_ID_MAP[ur.role_id] || 'student';
        roleMap[ur.user_id].push(rName);
      });

      return (profRes.data || []).map((p) => {
        const userRoles = roleMap[p.id] || ['student'];
        const highestRole = getHighestRole(userRoles, p.username);
        return {
          ...p,
          roles: userRoles,
          highestRole
        };
      });
    }
  });

  const profileMap = React.useMemo(() => {
    return Object.fromEntries(allProfiles.map((p) => [p.id, p]));
  }, [allProfiles]);

  // 3. Загрузка сообщений активного чата
  const { data: rawMessages = [] } = useQuery({
    queryKey: ['chat_messages_v8', activeChatId],
    enabled: Boolean(activeChatId),
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('chat_id', activeChatId)
          .order('created_at', { ascending: true })
          .limit(150);

        if (error || !data) return [];
        return data.filter((m) => !m.deleted_at);
      } catch {
        return [];
      }
    }
  });

  // 4. Realtime подписка на сообщения, онлайн и печать
  useEffect(() => {
    if (!activeChatId) return;

    const channelName = `chat_room_${activeChatId.slice(0, 8)}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: profile?.username || 'user' } }
    });

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat_messages_v8', activeChatId] });
      })
      .on('presence', { event: 'sync' }, () => {
        setOnlineUsers(Object.keys(channel.presenceState() || {}));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.username && payload.username !== profile?.username) {
          setTypingUser(payload.username);
          setTimeout(() => setTypingUser(null), 2500);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId, profile?.username, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rawMessages.length, activeChatId]);

  const handleTypingInput = (val) => {
    setText(val);
    if (channelRef.current && profile?.username) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { username: profile.username }
      });
    }
  };

  // Отправка и редактирование сообщения
  const sendMutation = useMutation({
    mutationFn: async ({ isEdit, content, editId }) => {
      if (profile?.is_banned) {
        throw new Error('Ваш аккаунт ограничен модератором. Отправка сообщений недоступна.');
      }
      if (isEdit) {
        const { error } = await supabase
          .from('chat_messages')
          .update({ content, edited_at: new Date().toISOString() })
          .eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('chat_messages').insert([
          {
            chat_id: activeChatId,
            author_id: user?.id,
            content,
            reply_to_id: replyTo?.id || null
          }
        ]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_messages_v8', activeChatId] });
      setText('');
      setEditingMsg(null);
      setReplyTo(null);
    },
    onError: (err) => toast(err.message, 'error')
  });

  const handleSendOrEdit = (e) => {
    e.preventDefault();
    if (!text.trim() || !user?.id) return;
    checkRateLimit('chat_send', 350);
    sendMutation.mutate({
      isEdit: Boolean(editingMsg),
      content: text.trim(),
      editId: editingMsg?.id
    });
  };

  // Удаление сообщения (своего или любого для админа)
  const deleteMsgMutation = useMutation({
    mutationFn: async (msgId) => {
      const { error } = await supabase
        .from('chat_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', msgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_messages_v8', activeChatId] });
      toast('Сообщение удалено', 'info');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Быстрый бан нарушителя прямо из чата (для Админа)
  const quickBanMutation = useMutation({
    mutationFn: async (targetUser) => {
      const nextBan = !targetUser.is_banned;
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: nextBan })
        .eq('id', targetUser.id);
      if (error) throw error;
      return nextBan;
    },
    onSuccess: (nextBan) => {
      queryClient.invalidateQueries({ queryKey: ['chat_all_profiles_with_roles_v8'] });
      toast(nextBan ? 'Пользователь заблокирован в чате' : 'Блокировка снята', 'info');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Отправка жалобы в таблицу reports
  const submitReportMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      if (!reportTarget?.userObj?.id) throw new Error('Не выбран нарушитель');
      const fullReason = `[${reportCategory}] ${reportComment.trim()}${
        reportTarget.messageObj ? ` | Сообщение: "${reportTarget.messageObj.content?.slice(0, 120)}"` : ''
      }`;

      const { error } = await supabase.from('reports').insert([
        {
          reporter_id: user.id,
          target_id: reportTarget.userObj.id,
          reason: fullReason,
          status: 'pending'
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      setReportTarget(null);
      setReportComment('');
      toast('Жалоба передана в Терминал Администратора!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Реакции на сообщения
  const toggleReaction = async (msg, emoji) => {
    const current = msg.reactions || {};
    const usersForEmoji = current[emoji] || [];
    const myUname = profile?.username || '@me';
    const nextUsers = usersForEmoji.includes(myUname)
      ? usersForEmoji.filter((u) => u !== myUname)
      : [...usersForEmoji, myUname];

    const updated = { ...current, [emoji]: nextUsers };
    setReactionMenuMsgId(null);

    await supabase.from('chat_messages').update({ reactions: updated }).eq('id', msg.id);
    queryClient.invalidateQueries({ queryKey: ['chat_messages_v8', activeChatId] });
  };

  // Закрепление сообщения
  const togglePinMessage = async (msg) => {
    await supabase.from('chat_messages').update({ is_pinned: !msg.is_pinned }).eq('id', msg.id);
    queryClient.invalidateQueries({ queryKey: ['chat_messages_v8', activeChatId] });
    toast(msg.is_pinned ? 'Сообщение откреплено' : '📌 Закреплено в шапке канала', 'info');
  };

  // Загрузка файла в чат
  const handleFileAttach = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    try {
      toast('Загрузка вложения...', 'info');
      const url = await uploadFileToStorage('chat-attachments', user.id, file);
      await supabase.from('chat_messages').insert([
        {
          chat_id: activeChatId,
          author_id: user.id,
          content: `Прикреплён документ: ${file.name}`,
          attachments: [{ name: file.name, url, type: file.type }]
        }
      ]);
      queryClient.invalidateQueries({ queryKey: ['chat_messages_v8', activeChatId] });
      toast('Файл успешно отправлен!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const currentChat = chats.find((c) => c.id === activeChatId) || chats[0] || DEFAULT_CHATS[0];
  const pinnedMessages = rawMessages.filter((m) => m.is_pinned);
  const filteredMessages = rawMessages.filter(
    (m) => !msgSearch.trim() || m.content?.toLowerCase().includes(msgSearch.toLowerCase())
  );
  const visibleChats = chats.filter((c) =>
    showArchived ? archivedIds.includes(c.id) : !archivedIds.includes(c.id)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
      {/* ЛЕВАЯ КОЛОНКА: КАНАЛЫ И ЛИЧНЫЕ СООБЩЕНИЯ */}
      <Card className="lg:col-span-4 flex flex-col justify-between space-y-5 border-white/10 bg-[#060a14]/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-5">
        <div className="space-y-4">
          {/* Переключатель Каналы / Архив + Кнопка Создать */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowArchived(false)}
                className={`font-mono text-[11px] uppercase px-3 py-1.5 rounded border transition-all ${
                  !showArchived
                    ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold shadow-[0_0_12px_rgba(0,200,83,0.2)]'
                    : 'border-white/10 text-[#8A93A6] hover:text-white'
                }`}
              >
                Каналы ({chats.length - archivedIds.length})
              </button>
              <button
                onClick={() => setShowArchived(true)}
                className={`font-mono text-[11px] uppercase px-3 py-1.5 rounded border flex items-center gap-1.5 transition-all ${
                  showArchived
                    ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00] font-bold'
                    : 'border-white/10 text-[#8A93A6] hover:text-white'
                }`}
              >
                <Archive size={12} /> Архив ({archivedIds.length})
              </button>
            </div>

            <Button size="sm" variant="gold" onClick={() => setNewChatModal(true)} className="px-3 py-1.5 rounded">
              <Plus size={13} /> Создать
            </Button>
          </div>

          {/* Список каналов */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {visibleChats.length === 0 ? (
              <div className="text-xs text-[#8A93A6] font-mono py-6 text-center">
                {showArchived ? 'В архиве пока нет каналов' : 'Нет доступных каналов'}
              </div>
            ) : (
              visibleChats.map((ch) => {
                const isSelected = activeChatId === ch.id;
                return (
                  <div
                    key={ch.id}
                    onClick={() => setActiveChatId(ch.id)}
                    className={`p-3 rounded-lg border transition-all flex items-center justify-between cursor-pointer group ${
                      isSelected
                        ? 'border-[#00C853] bg-gradient-to-r from-[#00C853]/20 to-[#050810] text-white shadow-[inset_3px_0_0_#00C853]'
                        : 'border-white/5 bg-[#050810]/70 text-zinc-300 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {ch.type === 'direct' ? (
                        <MessageSquare size={15} className="text-[#22D3EE] shrink-0" />
                      ) : (
                        <Hash size={15} className="text-[#00C853] shrink-0" />
                      )}
                      <span className="font-mono text-xs truncate">
                        {mutedIds.includes(ch.id) && '🔇 '}
                        {ch.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge color={ch.type === 'direct' ? 'cyan' : 'emerald'}>
                        {ch.type === 'direct' ? 'ЛС' : 'Канал'}
                      </Badge>
                      <button
                        onClick={(e) => toggleArchiveChat(ch.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[#8A93A6] hover:text-[#FFAA00] transition-opacity"
                        title={archivedIds.includes(ch.id) ? 'Вернуть из архива' : 'В архив'}
                      >
                        <Archive size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Быстрый поиск участников и переход в ЛС */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-wider text-[#34D399] flex items-center gap-1.5">
              <Sparkles size={12} /> Написать участнику или наставнику:
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-2.5 text-[#8A93A6]" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Поиск по @username или ФИО..."
                className="w-full bg-[#050810] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#00C853]"
              />
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {allProfiles
                .filter(
                  (p) =>
                    p.id !== user?.id &&
                    (p.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
                      p.full_name?.toLowerCase().includes(userSearch.toLowerCase()))
                )
                .map((u) => (
                  <div
                    key={u.id}
                    onClick={async () => {
                      const { data } = await supabase.rpc('get_or_create_direct_chat', { target_user_id: u.id });
                      if (data) {
                        queryClient.invalidateQueries({ queryKey: ['chats_list_v8'] });
                        setActiveChatId(data);
                      }
                    }}
                    className="p-2.5 rounded-lg border border-white/5 bg-[#050810]/70 hover:border-[#00C853]/60 flex items-center justify-between cursor-pointer text-xs transition-all group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Avatar src={u.avatar_url} username={u.username} status={u.status} size="sm" />
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[#FFAA00] font-semibold truncate">{u.username}</span>
                          <Badge color={u.highestRole?.color || 'emerald'}>
                            {u.highestRole?.label || 'Исследователь'}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-[#8A93A6] truncate mt-0.5">{u.full_name}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#34D399] group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                      ЛС →
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Нижний статус-бар онлайна */}
        <div className="pt-3 border-t border-white/10 font-mono text-[11px] text-[#34D399] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00C853] animate-pulse" />
            <span>В сети сейчас: {onlineUsers.length > 0 ? onlineUsers.length : 1} чел.</span>
          </div>
          <span className="text-[#8A93A6] text-[10px]">Realtime TLS</span>
        </div>
      </Card>

      {/* ПРАВАЯ КОЛОНКА: ОКНО СООБЩЕНИЙ */}
      <Card className="lg:col-span-8 flex flex-col justify-between h-[680px] relative border-white/10 bg-[#060a14]/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-5">
        {/* Шапка активного канала */}
        <div className="border-b border-white/10 pb-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-white flex items-center gap-2.5">
                <span>{currentChat?.title}</span>
                <Badge color={currentChat?.type === 'direct' ? 'cyan' : 'emerald'}>
                  {currentChat?.type === 'direct' ? 'Личный диалог' : 'Официальный канал'}
                </Badge>
              </h2>
              <div className="font-mono text-[11px] text-[#34D399] mt-0.5">
                {typingUser
                  ? `✍ Участник ${typingUser} печатает сообщение...`
                  : 'Сообщения защищены • Отображается старший ранг участника'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-2.5 text-[#8A93A6]" />
                <input
                  type="text"
                  value={msgSearch}
                  onChange={(e) => setMsgSearch(e.target.value)}
                  placeholder="Поиск в чате..."
                  className="bg-[#050810] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white w-44 focus:outline-none focus:border-[#FFAA00]"
                />
              </div>

              <button
                onClick={() => toggleMuteChat(activeChatId)}
                className="p-2 rounded-lg border border-white/10 bg-[#050810] text-[#8A93A6] hover:text-white transition-colors"
                title="Уведомления канала"
              >
                {mutedIds.includes(activeChatId) ? (
                  <BellOff size={15} className="text-[#FFAA00]" />
                ) : (
                  <Bell size={15} />
                )}
              </button>
            </div>
          </div>

          {/* Закрепленное сообщение в шапке */}
          {pinnedMessages.length > 0 && (
            <div className="p-2.5 rounded-lg bg-[#FFAA00]/10 border border-[#FFAA00]/30 text-xs flex items-center justify-between gap-2">
              <span className="truncate">
                <Pin size={12} className="inline mr-1.5 text-[#FFAA00]" />
                <strong className="font-mono text-[#FFAA00]">Закреплено:</strong>{' '}
                <span className="text-zinc-100">{pinnedMessages[pinnedMessages.length - 1].content}</span>
              </span>
              <button
                onClick={() => togglePinMessage(pinnedMessages[pinnedMessages.length - 1])}
                className="text-[10px] font-mono text-[#FFAA00] hover:underline shrink-0"
              >
                Открепить
              </button>
            </div>
          )}
        </div>

        {/* Лента сообщений */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center font-mono text-xs text-[#8A93A6] space-y-2">
              <MessageSquare size={32} className="text-white/20" />
              <div>В этом канале пока нет сообщений. Начните обсуждение первым!</div>
            </div>
          ) : (
            filteredMessages.map((m) => {
              const isMine = m.author_id === user?.id;
              const authorProf = profileMap[m.author_id];
              const authorUname = authorProf?.username || '@исследователь';
              const authorFullName = authorProf?.full_name || '';
              const roleBadge = authorProf?.highestRole || getHighestRole([], authorUname);
              const parentMsg = m.reply_to_id ? rawMessages.find((x) => x.id === m.reply_to_id) : null;
              const reactions = m.reactions || {};
              const attachments = Array.isArray(m.attachments) ? m.attachments : [];

              return (
                <div key={m.id} className={`flex items-start gap-3.5 ${isMine ? 'flex-row-reverse' : ''} group`}>
                  <Avatar
                    src={authorProf?.avatar_url}
                    username={authorUname}
                    status={authorProf?.status}
                    size="md"
                    onClick={() => navigate(`/profile/${authorUname.replace('@', '')}`)}
                  />

                  <div
                    className={`p-4 rounded-xl border max-w-xl space-y-2 relative transition-all ${
                      isMine
                        ? 'border-[#00C853]/40 bg-gradient-to-br from-[#00C853]/15 to-[#050810] shadow-[0_6px_20px_rgba(0,200,83,0.1)]'
                        : 'border-white/10 bg-[#050810]/90 hover:border-white/20'
                    }`}
                  >
                    {/* Ответ на предыдущее сообщение */}
                    {parentMsg && (
                      <div className="p-2 rounded border-l-2 border-[#FFAA00] bg-black/50 text-xs text-[#8A93A6]">
                        <span className="text-[#FFAA00] font-mono font-semibold">
                          {profileMap[parentMsg.author_id]?.username || '@участник'}:
                        </span>{' '}
                        <span className="truncate">{parentMsg.content}</span>
                      </div>
                    )}

                    {/* Шапка сообщения: Ник + Старшая Роль + Кнопки действий */}
                    <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          onClick={() => navigate(`/profile/${authorUname.replace('@', '')}`)}
                          className="text-[#FFAA00] font-bold cursor-pointer hover:underline"
                        >
                          {authorUname}
                        </span>
                        {authorFullName && (
                          <span className="text-zinc-400 text-[10px] hidden sm:inline">({authorFullName})</span>
                        )}
                        {/* БЕЙДЖ СТАРШЕЙ РОЛИ ПОЛЬЗОВАТЕЛЯ */}
                        <Badge color={roleBadge.color}>{roleBadge.label}</Badge>
                        {authorProf?.is_banned && <Badge color="red">Заблокирован</Badge>}
                      </div>

                      {/* Панель действий над сообщением */}
                      <div className="flex items-center gap-1.5 text-[#8A93A6]">
                        {m.edited_at && <span className="text-zinc-500 italic text-[10px]">изм.</span>}
                        <span>{new Date(m.created_at).toLocaleTimeString().slice(0, 5)}</span>

                        <button
                          onClick={() => setReactionMenuMsgId(reactionMenuMsgId === m.id ? null : m.id)}
                          className="hover:text-[#FFAA00] p-1 rounded hover:bg-white/5"
                          title="Реакция"
                        >
                          <SmilePlus size={13} />
                        </button>
                        <button
                          onClick={() => setReplyTo(m)}
                          className="hover:text-white p-1 rounded hover:bg-white/5"
                          title="Ответить"
                        >
                          <Reply size={13} />
                        </button>
                        <button
                          onClick={() => togglePinMessage(m)}
                          className="hover:text-[#FFAA00] p-1 rounded hover:bg-white/5"
                          title="Закрепить"
                        >
                          <Pin size={13} />
                        </button>

                        {/* Кнопка ЖАЛОБЫ на чужое сообщение */}
                        {!isMine && authorProf && (
                          <button
                            onClick={() => setReportTarget({ userObj: authorProf, messageObj: m })}
                            className="hover:text-red-400 p-1 rounded hover:bg-red-500/10"
                            title="Пожаловаться модераторам"
                          >
                            <Flag size={13} />
                          </button>
                        )}

                        {/* Кнопка быстрого бана для Админа прямо из чата */}
                        {isAdmin && !isMine && authorProf && (
                          <button
                            onClick={() => quickBanMutation.mutate(authorProf)}
                            className="hover:text-red-400 p-1 rounded hover:bg-red-500/10 text-red-400/80"
                            title={authorProf.is_banned ? 'Разблокировать участника' : 'Заблокировать участника'}
                          >
                            <Ban size={13} />
                          </button>
                        )}

                        {/* Редактирование и удаление (своих или любых для Админа) */}
                        {(isMine || isAdmin) && (
                          <>
                            {isMine && (
                              <button
                                onClick={() => {
                                  setEditingMsg(m);
                                  setText(m.content);
                                }}
                                className="hover:text-[#22D3EE] p-1 rounded hover:bg-white/5"
                                title="Редактировать"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => deleteMsgMutation.mutate(m.id)}
                              className="hover:text-red-400 p-1 rounded hover:bg-red-500/10"
                              title="Удалить сообщение"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Текст сообщения */}
                    <p className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">{m.content}</p>

                    {/* Вложенные файлы */}
                    {attachments.length > 0 && (
                      <div className="pt-1 space-y-1">
                        {attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-[#22D3EE] hover:border-[#22D3EE]"
                          >
                            <FileText size={13} />
                            <span>{att.name || 'Документ'}</span>
                            <ExternalLink size={11} />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Всплывающее меню выбора эмодзи */}
                    {reactionMenuMsgId === m.id && (
                      <div className="absolute -top-9 right-2 bg-[#091122] border border-white/20 rounded-full px-3 py-1.5 flex gap-2 z-30 shadow-2xl">
                        {EMOJIS.map((em) => (
                          <button
                            key={em}
                            onClick={() => toggleReaction(m, em)}
                            className="hover:scale-125 transition-transform text-base"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Отображение поставленных реакций */}
                    {Object.keys(reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.entries(reactions).map(([em, users]) => {
                          if (!Array.isArray(users) || !users.length) return null;
                          const hasMy = users.includes(profile?.username);
                          return (
                            <button
                              key={em}
                              onClick={() => toggleReaction(m, em)}
                              className={`px-2.5 py-0.5 rounded-full text-xs font-mono flex items-center gap-1 border transition-all ${
                                hasMy
                                  ? 'bg-[#00C853]/25 border-[#00C853] text-[#34D399]'
                                  : 'bg-white/5 border-white/10 text-zinc-300 hover:border-white/30'
                              }`}
                              title={users.join(', ')}
                            >
                              <span>{em}</span>
                              <span>{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Плашка активного ответа или редактирования */}
        {(editingMsg || replyTo) && (
          <div className="px-4 py-2.5 rounded-t-lg bg-[#050810] border border-[#FFAA00]/40 flex items-center justify-between text-xs font-mono text-[#FFAA00]">
            <span className="truncate">
              {editingMsg
                ? `✎ Редактирование сообщения: "${editingMsg.content.slice(0, 60)}"`
                : `↩ Ответ участнику ${profileMap[replyTo.author_id]?.username || '@автор'}: "${replyTo.content.slice(0, 60)}"`}
            </span>
            <button
              onClick={() => {
                setEditingMsg(null);
                setReplyTo(null);
                setText('');
              }}
              className="text-red-400 hover:text-red-300 ml-3 shrink-0"
            >
              ✕ Отмена
            </button>
          </div>
        )}

        {/* Форма отправки сообщения */}
        <form onSubmit={handleSendOrEdit} className="pt-3 border-t border-white/10 flex items-center gap-2.5">
          <label
            className="p-3 rounded-lg border border-white/10 text-[#8A93A6] hover:text-white cursor-pointer bg-[#050810] transition-colors"
            title="Прикрепить презентацию или файл"
          >
            <Paperclip size={16} />
            <input type="file" onChange={handleFileAttach} className="hidden" />
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => handleTypingInput(e.target.value)}
            placeholder={
              profile?.is_banned
                ? 'Вы заблокированы модератором...'
                : editingMsg
                ? 'Введите новый текст сообщения...'
                : 'Напишите сообщение в канал...'
            }
            disabled={Boolean(profile?.is_banned)}
            className="flex-1 bg-[#050810] border border-white/15 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00C853] disabled:opacity-50"
          />
          <Button type="submit" size="md" disabled={sendMutation.isPending || Boolean(profile?.is_banned)} className="px-5 py-3 rounded-lg">
            {editingMsg ? <Check size={16} /> : <Send size={16} />}
          </Button>
        </form>
      </Card>

      {/* МОДАЛЬНОЕ ОКНО: ОТПРАВКА ЖАЛОБЫ НА ПОЛЬЗОВАТЕЛЯ / СООБЩЕНИЕ */}
      <Modal
        isOpen={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        title={`Пожаловаться на ${reportTarget?.userObj?.username || 'участника'}`}
      >
        <form onSubmit={(e) => submitReportMutation.mutate(e)} className="space-y-4 text-xs">
          {reportTarget?.messageObj && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-zinc-200">
              <div className="font-mono text-[10px] uppercase text-red-400 mb-1">Сообщение с нарушением:</div>
              <div className="italic">«{reportTarget.messageObj.content}»</div>
            </div>
          )}

          <div>
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1.5">
              Категория нарушения
            </label>
            <select
              value={reportCategory}
              onChange={(e) => setReportCategory(e.target.value)}
              className="w-full bg-[#050810] border border-white/15 p-2.5 text-xs text-white rounded focus:outline-none focus:border-[#FFAA00]"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1.5">
              Дополнительный комментарий для модераторов
            </label>
            <textarea
              rows={3}
              value={reportComment}
              onChange={(e) => setReportComment(e.target.value)}
              placeholder="Опишите детали нарушения..."
              className="w-full bg-[#050810] border border-white/15 p-3 text-xs text-white rounded focus:outline-none focus:border-[#00C853]"
              required
            />
          </div>

          <Button type="submit" variant="gold" className="w-full justify-center">
            <ShieldAlert size={14} /> Отправить жалобу в Админ-панель
          </Button>
        </form>
      </Modal>

      {/* МОДАЛЬНОЕ ОКНО: СОЗДАНИЕ НОВОГО КАНАЛА */}
      <Modal isOpen={newChatModal} onClose={() => setNewChatModal(false)} title="Создать проектный канал">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { data } = await supabase
              .from('chats')
              .insert([{ type: 'project', title: newChatTitle.trim(), owner_id: user.id }])
              .select()
              .single();
            if (data) {
              await supabase.from('chat_members').upsert([{ chat_id: data.id, user_id: user.id, role: 'owner' }]);
              queryClient.invalidateQueries({ queryKey: ['chats_list_v8'] });
              setActiveChatId(data.id);
              setNewChatModal(false);
              setNewChatTitle('');
            }
          }}
          className="space-y-4"
        >
          <input
            type="text"
            placeholder="Например: Проектная группа ХМАО-Югра"
            value={newChatTitle}
            onChange={(e) => setNewChatTitle(e.target.value)}
            className="w-full bg-[#050810] border border-white/15 rounded p-3 text-xs text-white"
            required
          />
          <Button type="submit" variant="gold" className="w-full">
            Создать канал
          </Button>
        </form>
      </Modal>
    </div>
  );
}