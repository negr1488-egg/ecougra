import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, checkRateLimit, uploadFileToStorage } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Avatar, Badge, Modal, useToast } from '../components/ui/DesignSystem';
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
  Users
} from 'lucide-react';

const EMOJIS = ['👍', '❤️', '🔥', '🌲', '💡', '🎉'];

const DEFAULT_CHATS = [
  { id: 'aaaa1111-1111-1111-1111-111111111111', type: 'general', title: 'Общий канал промысла' },
  { id: 'bbbb2222-2222-2222-2222-222222222222', type: 'support', title: 'Вопросы экспертам жюри' }
];

export default function ChatPage() {
  const { user, profile, setUnreadChatCount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [activeChatId, setActiveChatId] = useState(
    searchParams.get('room') || 'aaaa1111-1111-1111-1111-111111111111'
  );
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [msgSearch, setMsgSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedIds, setArchivedIds] = useState([]);
  const [mutedIds, setMutedIds] = useState([]);
  const [reactionMenuMsgId, setReactionMenuMsgId] = useState(null);

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [newChatModal, setNewChatModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');

  const bottomRef = useRef(null);

  useEffect(() => {
    if (setUnreadChatCount) setUnreadChatCount(0);
  }, [setUnreadChatCount]);

  // Загрузка комнат
  const { data: chats = DEFAULT_CHATS } = useQuery({
    queryKey: ['chats_list_v5', user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('chats').select('*').order('created_at', { ascending: true });
        if (error || !data || data.length === 0) return DEFAULT_CHATS;
        return data.filter((c) => !c.deleted_at);
      } catch {
        return DEFAULT_CHATS;
      }
    }
  });

  // Загрузка списка участников (для ЛС и профилей авторов)
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['chat_all_profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, username, full_name, avatar_url, status');
      return data || [];
    }
  });

  const profileMap = React.useMemo(() => {
    return Object.fromEntries(allProfiles.map((p) => [p.id, p]));
  }, [allProfiles]);

  // Загрузка сообщений БЕЗ ломающегося JOIN
  const { data: rawMessages = [] } = useQuery({
    queryKey: ['chat_messages_v5', activeChatId],
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

  // Realtime
  useEffect(() => {
    if (!activeChatId) return;

    const channelName = `chat_room_${activeChatId.slice(0, 8)}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: profile?.username || 'user' } }
    });

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat_messages_v5', activeChatId] });
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId, profile?.username, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rawMessages]);

  const sendMutation = useMutation({
    mutationFn: async ({ isEdit, content, editId }) => {
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
      queryClient.invalidateQueries({ queryKey: ['chat_messages_v5', activeChatId] });
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

  const deleteMsgMutation = useMutation({
    mutationFn: async (msgId) => {
      const { error } = await supabase
        .from('chat_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', msgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_messages_v5', activeChatId] });
      toast('Сообщение удалено', 'info');
    },
    onError: (err) => toast(err.message, 'error')
  });

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
    queryClient.invalidateQueries({ queryKey: ['chat_messages_v5', activeChatId] });
  };

  const togglePinMessage = async (msg) => {
    await supabase.from('chat_messages').update({ is_pinned: !msg.is_pinned }).eq('id', msg.id);
    queryClient.invalidateQueries({ queryKey: ['chat_messages_v5', activeChatId] });
    toast(msg.is_pinned ? 'Сообщение откреплено' : '📌 Закреплено в шапке чата', 'info');
  };

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
          content: `Прикреплён файл: ${file.name}`,
          attachments: [{ name: file.name, url, type: file.type }]
        }
      ]);
      queryClient.invalidateQueries({ queryKey: ['chat_messages_v5', activeChatId] });
      toast('Файл отправлен!', 'success');
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
      {/* ЛЕВАЯ КОЛОНКА КАНАЛОВ И ДИАЛОГОВ */}
      <Card className="lg:col-span-4 flex flex-col justify-between space-y-4 border-white/10 bg-[#060a14]/90 backdrop-blur-2xl shadow-[0_15px_35px_rgba(0,0,0,0.6)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowArchived(false)}
                className={`font-mono text-[10px] uppercase px-3 py-1.5 border transition-all ${
                  !showArchived
                    ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold shadow-[0_0_10px_rgba(0,200,83,0.2)]'
                    : 'border-white/10 text-[#8A93A6] hover:text-white'
                }`}
              >
                Каналы ({chats.length - archivedIds.length})
              </button>
              <button
                onClick={() => setShowArchived(true)}
                className={`font-mono text-[10px] uppercase px-3 py-1.5 border flex items-center gap-1 transition-all ${
                  showArchived
                    ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00] font-bold'
                    : 'border-white/10 text-[#8A93A6] hover:text-white'
                }`}
              >
                <Archive size={11} /> Архив ({archivedIds.length})
              </button>
            </div>

            <Button size="sm" variant="gold" onClick={() => setNewChatModal(true)} className="px-2.5 py-1">
              <Plus size={13} /> Создать
            </Button>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {visibleChats.map((ch) => {
              const isSelected = activeChatId === ch.id;
              return (
                <div
                  key={ch.id}
                  onClick={() => setActiveChatId(ch.id)}
                  className={`p-3 border transition-all flex items-center justify-between cursor-pointer group ${
                    isSelected
                      ? 'border-[#00C853] bg-gradient-to-r from-[#00C853]/20 to-transparent text-white shadow-[inset_3px_0_0_#00C853]'
                      : 'border-white/5 bg-[#050810]/70 text-zinc-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {ch.type === 'direct' ? (
                      <MessageSquare size={13} className="text-[#22D3EE] shrink-0" />
                    ) : (
                      <Hash size={13} className="text-[#00C853] shrink-0" />
                    )}
                    <span className="font-mono text-xs truncate">
                      {mutedIds.includes(ch.id) && '🔇 '}
                      {ch.title}
                    </span>
                  </div>
                  <Badge color={ch.type === 'direct' ? 'cyan' : 'emerald'}>
                    {ch.type === 'direct' ? 'ЛС' : 'Канал'}
                  </Badge>
                </div>
              );
            })}
          </div>

          {/* Быстрые личные сообщения */}
          <div className="pt-3 border-t border-white/10 space-y-2.5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#34D399] flex items-center gap-1.5">
              <Sparkles size={11} /> Написать исследователю лично:
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-3 top-2.5 text-[#8A93A6]" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Поиск по имени или никнейму..."
                className="w-full bg-[#050810]/80 border border-white/10 pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00C853]"
              />
            </div>

            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
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
                        queryClient.invalidateQueries({ queryKey: ['chats_list_v5'] });
                        setActiveChatId(data);
                      }
                    }}
                    className="p-2 border border-white/5 bg-[#050810]/60 hover:border-[#00C853]/60 flex items-center justify-between cursor-pointer text-xs transition-colors group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Avatar src={u.avatar_url} username={u.username} size="sm" />
                      <div className="truncate">
                        <div className="font-mono text-[#FFAA00] truncate">{u.username}</div>
                        <div className="text-[10px] text-[#8A93A6] truncate">{u.full_name}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#34D399] group-hover:underline shrink-0">ЛС →</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 font-mono text-[10px] text-[#34D399] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00C853] animate-pulse" />
          <span>Участников онлайн: {onlineUsers.length > 0 ? onlineUsers.length : 1} чел.</span>
        </div>
      </Card>

      {/* ПРАВАЯ КОЛОНКА ПЕРЕПИСКИ */}
      <Card className="lg:col-span-8 flex flex-col justify-between h-[660px] relative border-white/10 bg-[#060a14]/90 backdrop-blur-2xl shadow-[0_15px_35px_rgba(0,0,0,0.6)]">
        {/* Шапка чата */}
        <div className="border-b border-white/10 pb-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-white flex items-center gap-2">
                <span>{currentChat?.title}</span>
                <Badge color="emerald">{currentChat?.type === 'direct' ? 'Приватный диалог' : 'Открытый канал'}</Badge>
              </h2>
              <div className="font-mono text-[10px] text-[#34D399] mt-0.5">
                {typingUser ? `✍ ${typingUser} печатает сообщение...` : 'Шифрованный Realtime-канал «Югра.Нефть»'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-2 text-[#8A93A6]" />
                <input
                  type="text"
                  value={msgSearch}
                  onChange={(e) => setMsgSearch(e.target.value)}
                  placeholder="Поиск по сообщениям..."
                  className="bg-[#050810] border border-white/10 pl-7 pr-2 py-1 text-xs text-white w-40 focus:outline-none focus:border-[#FFAA00]"
                />
              </div>

              <button
                onClick={() =>
                  setMutedIds((prev) =>
                    prev.includes(activeChatId) ? prev.filter((id) => id !== activeChatId) : [...prev, activeChatId]
                  )
                }
                className="p-1.5 border border-white/10 text-[#8A93A6] hover:text-white"
                title="Приглушить уведомления"
              >
                {mutedIds.includes(activeChatId) ? <BellOff size={14} className="text-[#FFAA00]" /> : <Bell size={14} />}
              </button>
            </div>
          </div>

          {/* Закрепленное сообщение */}
          {pinnedMessages.length > 0 && (
            <div className="p-2.5 bg-[#FFAA00]/10 border border-[#FFAA00]/30 text-xs flex items-center justify-between">
              <span className="truncate">
                <Pin size={12} className="inline mr-1.5 text-[#FFAA00]" />
                <strong className="font-mono text-[#FFAA00]">Закреплено:</strong>{' '}
                <span className="text-zinc-200">{pinnedMessages[pinnedMessages.length - 1].content}</span>
              </span>
            </div>
          )}
        </div>

        {/* Окно сообщений */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-2">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center font-mono text-xs text-[#8A93A6] space-y-2">
              <MessageSquare size={28} className="text-white/20" />
              <div>В этой комнате пока нет сообщений. Напишите первым!</div>
            </div>
          ) : (
            filteredMessages.map((m) => {
              const isMine = m.author_id === user?.id;
              const authorProf = profileMap[m.author_id];
              const authorUname = authorProf?.username || '@исследователь';
              const parentMsg = m.reply_to_id ? rawMessages.find((x) => x.id === m.reply_to_id) : null;
              const reactions = m.reactions || {};

              return (
                <div key={m.id} className={`flex items-start gap-3 ${isMine ? 'flex-row-reverse' : ''} group`}>
                  <Avatar
                    src={authorProf?.avatar_url}
                    username={authorUname}
                    status={authorProf?.status}
                    size="sm"
                    onClick={() => navigate(`/profile/${authorUname.replace('@', '')}`)}
                  />

                  <div
                    className={`p-3.5 border max-w-lg space-y-1.5 relative transition-all ${
                      isMine
                        ? 'border-[#00C853]/40 bg-gradient-to-br from-[#00C853]/15 to-[#050810] shadow-[0_4px_15px_rgba(0,200,83,0.1)]'
                        : 'border-white/10 bg-[#050810]/85'
                    }`}
                  >
                    {/* Цитирование */}
                    {parentMsg && (
                      <div className="p-2 border-l-2 border-[#FFAA00] bg-black/50 text-[11px] text-[#8A93A6] mb-1">
                        <span className="text-[#FFAA00] font-mono">
                          {profileMap[parentMsg.author_id]?.username || '@автор'}:
                        </span>{' '}
                        <span className="truncate">{parentMsg.content}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4 font-mono text-[10px]">
                      <span className="text-[#FFAA00] font-bold">{authorUname}</span>
                      <div className="flex items-center gap-1.5 text-[#8A93A6]">
                        {m.edited_at && <span className="text-zinc-400 italic">изменено</span>}
                        <span>{new Date(m.created_at).toLocaleTimeString().slice(0, 5)}</span>

                        <button
                          onClick={() => setReactionMenuMsgId(reactionMenuMsgId === m.id ? null : m.id)}
                          className="hover:text-[#FFAA00] p-0.5"
                          title="Поставить реакцию"
                        >
                          <SmilePlus size={12} />
                        </button>
                        <button onClick={() => setReplyTo(m)} className="hover:text-white p-0.5" title="Ответить">
                          <Reply size={12} />
                        </button>
                        <button onClick={() => togglePinMessage(m)} className="hover:text-[#FFAA00] p-0.5" title="Закрепить">
                          <Pin size={12} />
                        </button>

                        {isMine && (
                          <>
                            <button
                              onClick={() => {
                                setEditingMsg(m);
                                setText(m.content);
                              }}
                              className="hover:text-[#22D3EE] p-0.5"
                              title="Редактировать"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => deleteMsgMutation.mutate(m.id)}
                              className="hover:text-red-400 p-0.5"
                              title="Удалить"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">{m.content}</p>

                    {/* Меню выбора эмодзи */}
                    {reactionMenuMsgId === m.id && (
                      <div className="absolute -top-7 right-2 bg-[#091122] border border-white/20 rounded-full px-2 py-1 flex gap-1.5 z-30 shadow-2xl animate-fadeIn">
                        {EMOJIS.map((em) => (
                          <button
                            key={em}
                            onClick={() => toggleReaction(m, em)}
                            className="hover:scale-130 transition-transform text-sm"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Бейджи реакций под сообщением */}
                    {Object.keys(reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {Object.entries(reactions).map(([em, users]) => {
                          if (!Array.isArray(users) || !users.length) return null;
                          const hasMy = users.includes(profile?.username);
                          return (
                            <button
                              key={em}
                              onClick={() => toggleReaction(m, em)}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-mono flex items-center gap-1 border transition-all ${
                                hasMy
                                  ? 'bg-[#00C853]/25 border-[#00C853] text-[#34D399]'
                                  : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/30'
                              }`}
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

        {/* Плашка редактирования / цитирования */}
        {(editingMsg || replyTo) && (
          <div className="px-4 py-2 bg-[#050810] border-t border-[#FFAA00]/40 flex items-center justify-between text-xs font-mono text-[#FFAA00]">
            <span>
              {editingMsg ? `✎ Редактирование сообщения` : `↩ Ответ на сообщение`}
            </span>
            <button
              onClick={() => {
                setEditingMsg(null);
                setReplyTo(null);
                setText('');
              }}
              className="text-red-400 hover:text-red-300"
            >
              ✕ Отмена
            </button>
          </div>
        )}

        {/* Форма ввода */}
        <form onSubmit={handleSendOrEdit} className="pt-3 border-t border-white/10 flex items-center gap-2">
          <label className="p-2.5 border border-white/10 text-[#8A93A6] hover:text-white cursor-pointer bg-[#050810]">
            <Paperclip size={16} />
            <input type="file" onChange={handleFileAttach} className="hidden" />
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={editingMsg ? 'Измените текст сообщения...' : 'Введите сообщение в канал...'}
            className="flex-1 bg-[#050810] border border-white/10 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00C853]"
          />
          <Button type="submit" size="md" disabled={sendMutation.isPending}>
            {editingMsg ? <Check size={14} /> : <Send size={14} />}
          </Button>
        </form>
      </Card>

      <Modal isOpen={newChatModal} onClose={() => setNewChatModal(false)} title="Создать командный канал">
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
              queryClient.invalidateQueries({ queryKey: ['chats_list_v5'] });
              setActiveChatId(data.id);
              setNewChatModal(false);
              setNewChatTitle('');
            }
          }}
          className="space-y-4"
        >
          <input
            type="text"
            placeholder="Например: #проект-утилизации-пнг"
            value={newChatTitle}
            onChange={(e) => setNewChatTitle(e.target.value)}
            className="w-full bg-[#050810] border border-white/15 p-2.5 text-xs text-white"
            required
          />
          <Button type="submit" variant="gold" className="w-full">Создать канал</Button>
        </form>
      </Modal>
    </div>
  );
}