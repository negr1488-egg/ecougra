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
  Settings,
  SmilePlus,
  Check
} from 'lucide-react';

const EMOJIS = ['👍', '❤️', '🔥', '🌲', '💡', '🎉'];

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
  const [settingsModal, setSettingsModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');

  const bottomRef = useRef(null);
  const presenceChannelRef = useRef(null);

  useEffect(() => {
    setUnreadChatCount(0);
  }, [setUnreadChatCount]);

  const { data: chats = [] } = useQuery({
    queryKey: ['chats_extended', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('chats').select('*').is('deleted_at', null).order('created_at');
      return data?.length
        ? data
        : [
            { id: 'aaaa1111-1111-1111-1111-111111111111', type: 'general', title: '#общий — Экосистема ЮГРА.НЕФТЬ' },
            { id: 'bbbb2222-2222-2222-2222-222222222222', type: 'support', title: '#поддержка — Вопросы жюри' }
          ];
    }
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['chat_users_dir'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, username, full_name, avatar_url, status').order('username');
      return data || [];
    }
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['chat_messages_ext', activeChatId],
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*, profiles(username, full_name, avatar_url, status)')
        .eq('chat_id', activeChatId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(120);
      return data || [];
    }
  });

  useEffect(() => {
    if (!activeChatId || !user) return;
    const channel = supabase.channel(`room_${activeChatId}`, {
      config: { presence: { key: profile?.username || user.id } }
    });

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${activeChatId}` },
        () => queryClient.invalidateQueries({ queryKey: ['chat_messages_ext', activeChatId] })
      )
      .on('presence', { event: 'sync' }, () => {
        setOnlineUsers(Object.keys(channel.presenceState()));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.username !== profile?.username) {
          setTypingUser(payload.username);
          setTimeout(() => setTypingUser(null), 2500);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString(), username: profile?.username });
        }
      });

    presenceChannelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [activeChatId, user, profile?.username, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Мутация отправки / редактирования
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
            author_id: user.id,
            content,
            reply_to_id: replyTo?.id || null
          }
        ]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_messages_ext', activeChatId] });
      setText('');
      setEditingMsg(null);
      setReplyTo(null);
    },
    onError: (err) => toast(err.message, 'error')
  });

  const handleSendOrEdit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    checkRateLimit('chat_send', 500);
    sendMutation.mutate({
      isEdit: Boolean(editingMsg),
      content: text.trim(),
      editId: editingMsg?.id
    });
  };

  // Мутация мягкого удаления (soft delete)
  const deleteMutation = useMutation({
    mutationFn: async (msgId) => {
      const { error } = await supabase
        .from('chat_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', msgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_messages_ext', activeChatId] });
      toast('Сообщение удалено', 'info');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Мутация реакций
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
    queryClient.invalidateQueries({ queryKey: ['chat_messages_ext', activeChatId] });
  };

  const togglePinMessage = async (msg) => {
    await supabase.from('chat_messages').update({ is_pinned: !msg.is_pinned }).eq('id', msg.id);
    queryClient.invalidateQueries({ queryKey: ['chat_messages_ext', activeChatId] });
    toast(msg.is_pinned ? 'Сообщение откреплено' : '📌 Сообщение закреплено', 'info');
  };

  const handleFileAttach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast('Загрузка вложения...', 'info');
      const url = await uploadFileToStorage('chat-attachments', user.id, file);
      await supabase.from('chat_messages').insert([
        {
          chat_id: activeChatId,
          author_id: user.id,
          content: `Вложение: ${file.name}`,
          attachments: [{ name: file.name, url, type: file.type }]
        }
      ]);
      queryClient.invalidateQueries({ queryKey: ['chat_messages_ext', activeChatId] });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const currentChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const pinnedMessages = messages.filter((m) => m.is_pinned);
  const filteredMessages = messages.filter(
    (m) => !msgSearch.trim() || m.content?.toLowerCase().includes(msgSearch.toLowerCase())
  );
  const visibleChats = chats.filter((c) =>
    showArchived ? archivedIds.includes(c.id) : !archivedIds.includes(c.id)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <Card className="lg:col-span-4 flex flex-col justify-between space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setShowArchived(false)}
                className={`font-mono text-[10px] uppercase px-2.5 py-1 border ${
                  !showArchived ? 'border-[#00C853] text-[#34D399]' : 'border-white/10 text-[#8A93A6]'
                }`}
              >
                Чаты ({chats.length - archivedIds.length})
              </button>
              <button
                onClick={() => setShowArchived(true)}
                className={`font-mono text-[10px] uppercase px-2.5 py-1 border flex items-center gap-1 ${
                  showArchived ? 'border-[#FFAA00] text-[#FFAA00]' : 'border-white/10 text-[#8A93A6]'
                }`}
              >
                <Archive size={11} /> Архив ({archivedIds.length})
              </button>
            </div>
            <button
              onClick={() => setNewChatModal(true)}
              className="font-mono text-[10px] uppercase text-[#34D399] hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> Создать
            </button>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {visibleChats.map((ch) => (
              <div
                key={ch.id}
                onClick={() => setActiveChatId(ch.id)}
                className={`p-2.5 border transition-all flex items-center justify-between cursor-pointer ${
                  activeChatId === ch.id
                    ? 'border-[#00C853] bg-[#00C853]/10 text-white'
                    : 'border-white/5 bg-[#050810] text-zinc-300 hover:text-white'
                }`}
              >
                <span className="font-mono text-xs truncate">
                  {mutedIds.includes(ch.id) && '🔇 '}
                  {ch.title}
                </span>
                <Badge color={ch.type === 'direct' ? 'cyan' : 'emerald'}>{ch.type}</Badge>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#34D399]">
              Написать участнику:
            </div>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Поиск по имени или нику..."
              className="w-full bg-[#050810] border border-white/10 px-3 py-1.5 text-xs text-white"
            />
            <div className="space-y-1 max-h-36 overflow-y-auto">
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
                        queryClient.invalidateQueries({ queryKey: ['chats_extended'] });
                        setActiveChatId(data);
                      }
                    }}
                    className="p-1.5 border border-white/5 bg-[#050810] hover:border-[#00C853] flex items-center justify-between cursor-pointer text-xs"
                  >
                    <span className="font-mono text-[#FFAA00] truncate">{u.username}</span>
                    <span className="text-[10px] text-[#34D399]">ЛС →</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-white/10 font-mono text-[10px] text-[#34D399]">
          ● Онлайн в чате: {onlineUsers.length} чел.
        </div>
      </Card>

      {/* ПРАВАЯ ПАНЕЛЬ: ОКНО ЧАТА */}
      <Card className="lg:col-span-8 flex flex-col justify-between h-[650px] relative">
        {/* Шапка чата */}
        <div className="border-b border-white/10 pb-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-medium text-white">{currentChat?.title}</h2>
              <div className="font-mono text-[10px] text-[#34D399]">
                {typingUser ? `✍ ${typingUser} печатает...` : 'Защищённый Realtime канал'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-2 text-[#8A93A6]" />
                <input
                  type="text"
                  value={msgSearch}
                  onChange={(e) => setMsgSearch(e.target.value)}
                  placeholder="Поиск..."
                  className="bg-[#050810] border border-white/10 pl-7 pr-2 py-1 text-xs text-white w-32"
                />
              </div>
              <button
                onClick={() =>
                  setMutedIds((prev) =>
                    prev.includes(activeChatId) ? prev.filter((id) => id !== activeChatId) : [...prev, activeChatId]
                  )
                }
                className="p-1.5 border border-white/10 text-[#8A93A6] hover:text-white"
              >
                {mutedIds.includes(activeChatId) ? <BellOff size={14} className="text-[#FFAA00]" /> : <Bell size={14} />}
              </button>
            </div>
          </div>

          {pinnedMessages.length > 0 && (
            <div className="p-2 bg-[#FFAA00]/10 border border-[#FFAA00]/30 text-xs flex items-center justify-between">
              <span className="truncate">
                <Pin size={12} className="inline mr-1 text-[#FFAA00]" />
                <strong>Закреплено:</strong> {pinnedMessages[pinnedMessages.length - 1].content}
              </span>
            </div>
          )}
        </div>

        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-2">
          {filteredMessages.map((m) => {
            const isMine = m.author_id === user?.id;
            const authorUname = m.profiles?.username || '@user';
            const parentMsg = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
            const reactions = m.reactions || {};

            return (
              <div key={m.id} className={`flex items-start gap-3 ${isMine ? 'flex-row-reverse' : ''} group`}>
                <Avatar
                  src={m.profiles?.avatar_url}
                  username={authorUname}
                  status={m.profiles?.status}
                  size="sm"
                  onClick={() => navigate(`/profile/${authorUname.replace('@', '')}`)}
                />

                <div
                  className={`p-3.5 border max-w-lg space-y-1.5 relative ${
                    isMine ? 'border-[#00C853]/40 bg-[#00C853]/10' : 'border-white/10 bg-[#050810]'
                  }`}
                >
                  {parentMsg && (
                    <div className="p-1.5 border-l-2 border-[#FFAA00] bg-black/40 text-[11px] text-[#8A93A6] mb-1">
                      <span className="text-[#FFAA00] font-mono">{parentMsg.profiles?.username}:</span> {parentMsg.content}
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
                            onClick={() => deleteMutation.mutate(m.id)}
                            className="hover:text-red-400 p-0.5"
                            title="Удалить"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-zinc-100 whitespace-pre-wrap leading-relaxed">{m.content}</p>

                  {/* Всплывающее меню реакций */}
                  {reactionMenuMsgId === m.id && (
                    <div className="absolute top-0 right-0 -mt-8 bg-[#0a0f1c] border border-white/20 rounded-full px-2 py-1 flex gap-1 z-30 shadow-xl">
                      {EMOJIS.map((em) => (
                        <button
                          key={em}
                          onClick={() => toggleReaction(m, em)}
                          className="hover:scale-125 transition-transform text-sm"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Аккуратные бейджи реакций */}
                  {Object.keys(reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1.5">
                      {Object.entries(reactions).map(([em, users]) => {
                        if (!users.length) return null;
                        const hasMy = users.includes(profile?.username);
                        return (
                          <button
                            key={em}
                            onClick={() => toggleReaction(m, em)}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-mono flex items-center gap-1 border transition-all ${
                              hasMy
                                ? 'bg-[#00C853]/20 border-[#00C853] text-[#34D399]'
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
          })}
          <div ref={bottomRef} />
        </div>

        {/* Индикатор редактирования / цитирования */}
        {(editingMsg || replyTo) && (
          <div className="px-4 py-2 bg-[#050810] border-t border-[#FFAA00]/40 flex items-center justify-between text-xs font-mono text-[#FFAA00]">
            <span>
              {editingMsg ? `✎ Редактирование сообщения` : `↩ Ответ для ${replyTo?.profiles?.username}`}
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
          <label className="p-2.5 border border-white/10 text-[#8A93A6] hover:text-white cursor-pointer">
            <Paperclip size={16} />
            <input type="file" onChange={handleFileAttach} className="hidden" />
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={editingMsg ? 'Измените текст...' : 'Напишите сообщение...'}
            className="flex-1 bg-[#050810] border border-white/10 px-4 py-2 text-xs text-white focus:outline-none focus:border-[#00C853]"
          />
          <Button type="submit" size="md" disabled={sendMutation.isPending}>
            {editingMsg ? <Check size={14} /> : <Send size={14} />}
          </Button>
        </form>
      </Card>

      <Modal isOpen={newChatModal} onClose={() => setNewChatModal(false)} title="Создать канал">
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
              queryClient.invalidateQueries({ queryKey: ['chats_extended'] });
              setActiveChatId(data.id);
              setNewChatModal(false);
              setNewChatTitle('');
            }
          }}
          className="space-y-4"
        >
          <Input label="Название канала" value={newChatTitle} onChange={(e) => setNewChatTitle(e.target.value)} required />
          <Button type="submit" className="w-full">Создать канал</Button>
        </form>
      </Modal>
    </div>
  );
}