import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, checkRateLimit, uploadFileToStorage } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Avatar, Badge, Modal, useToast } from '../components/ui/DesignSystem';
import {
  Send,
  Paperclip,
  Plus,
  LogOut,
  Search,
  Pin,
  Reply,
  Edit2,
  Trash2,
  Archive,
  BellOff,
  Bell,
  Settings
} from 'lucide-react';

const EMOJIS = ['👍', '🔥', '🌲', '💡', '❤️'];

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

  const handleSendOrEdit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      checkRateLimit('chat_send', 600);
      const msgText = text.trim();
      setText('');

      if (editingMsg) {
        await supabase
          .from('chat_messages')
          .update({ content: msgText, edited_at: new Date().toISOString() })
          .eq('id', editingMsg.id);
        setEditingMsg(null);
      } else {
        await supabase.from('chat_messages').insert([
          {
            chat_id: activeChatId,
            author_id: user.id,
            content: msgText,
            reply_to_id: replyTo?.id || null
          }
        ]);
        setReplyTo(null);

        // Проверяем упоминания @username и шлём уведомление
        const mentions = msgText.match(/@[a-zA-Z0-9_]+/g) || [];
        for (const m of mentions) {
          const target = allProfiles.find((p) => p.username?.toLowerCase() === m.toLowerCase());
          if (target && target.id !== user.id) {
            await supabase.from('notifications').insert([
              {
                user_id: target.id,
                type: 'mention',
                payload: { preview: `${profile?.username} упомянул вас в чате: "${msgText.slice(0, 45)}..."` }
              }
            ]);
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['chat_messages_ext', activeChatId] });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const toggleReaction = async (msg, emoji) => {
    const current = msg.reactions || {};
    const usersForEmoji = current[emoji] || [];
    const myUname = profile?.username || '@me';
    const nextUsers = usersForEmoji.includes(myUname)
      ? usersForEmoji.filter((u) => u !== myUname)
      : [...usersForEmoji, myUname];

    const updated = { ...current, [emoji]: nextUsers };
    await supabase.from('chat_messages').update({ reactions: updated }).eq('id', msg.id);
    queryClient.invalidateQueries({ queryKey: ['chat_messages_ext', activeChatId] });
  };

  const togglePinMessage = async (msg) => {
    await supabase.from('chat_messages').update({ is_pinned: !msg.is_pinned }).eq('id', msg.id);
    queryClient.invalidateQueries({ queryKey: ['chat_messages_ext', activeChatId] });
    toast(msg.is_pinned ? 'Сообщение откреплено' : '📌 Сообщение закреплено вверху чата', 'info');
  };

  const softDeleteMessage = async (msgId) => {
    await supabase.from('chat_messages').update({ deleted_at: new Date().toISOString() }).eq('id', msgId);
    queryClient.invalidateQueries({ queryKey: ['chat_messages_ext', activeChatId] });
    toast('Сообщение удалено', 'info');
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

  const startDirectMessageWithUser = async (targetProfile) => {
    try {
      const { data: dmChatId, error } = await supabase.rpc('get_or_create_direct_chat', {
        target_user_id: targetProfile.id
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['chats_extended'] });
      setActiveChatId(dmChatId);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleDeleteChatByOwner = async () => {
    await supabase.from('chats').update({ deleted_at: new Date().toISOString() }).eq('id', activeChatId);
    await queryClient.invalidateQueries({ queryKey: ['chats_extended'] });
    setActiveChatId('aaaa1111-1111-1111-1111-111111111111');
    setSettingsModal(false);
    toast('Чат удалён владельцем (Soft Delete)', 'info');
  };

  const currentChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const pinnedMessages = messages.filter((m) => m.is_pinned);
  const filteredMessages = messages.filter(
    (m) => !msgSearch.trim() || m.content?.toLowerCase().includes(msgSearch.toLowerCase())
  );
  const visibleChats = chats.filter((c) =>
    showArchived ? archivedIds.includes(c.id) : !archivedIds.includes(c.id)
  );

  // Подсветка упоминаний @username в тексте
  const renderHighlightedContent = (txt = '') => {
    const parts = txt.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="px-1 bg-[#FFAA00]/20 text-[#FFAA00] font-mono font-bold rounded">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ЛЕВАЯ ПАНЕЛЬ: СПИСОК ЧАТОВ, АРХИВ И БЫСТРЫЕ ЛС */}
      <Card className="lg:col-span-4 flex flex-col justify-between space-y-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setShowArchived(false)}
                className={`font-mono text-[10px] uppercase px-2.5 py-1 border ${
                  !showArchived ? 'border-[#00C853] text-[#34D399]' : 'border-white/10 text-[#8A93A6]'
                }`}
              >
                Активные ({chats.length - archivedIds.length})
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
            {visibleChats.map((ch) => {
              const isMuted = mutedIds.includes(ch.id);
              return (
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
                    {isMuted && '🔇 '}
                    {ch.title}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setArchivedIds((prev) =>
                          prev.includes(ch.id) ? prev.filter((id) => id !== ch.id) : [...prev, ch.id]
                        );
                      }}
                      className="text-[#8A93A6] hover:text-[#FFAA00]"
                      title="В архив / Из архива"
                    >
                      <Archive size={12} />
                    </button>
                    <Badge color={ch.type === 'direct' ? 'cyan' : 'emerald'}>{ch.type}</Badge>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Написать участнику лично */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#34D399]">
              Написать лично (@username):
            </div>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Найти собеседника..."
              className="w-full bg-[#050810] border border-white/10 px-3 py-1.5 text-xs text-white"
            />
            <div className="space-y-1 max-h-40 overflow-y-auto">
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
                    onClick={() => startDirectMessageWithUser(u)}
                    className="p-2 border border-white/5 bg-[#050810] hover:border-[#00C853] flex items-center justify-between cursor-pointer text-xs"
                  >
                    <span className="font-mono text-[#FFAA00] truncate">{u.username}</span>
                    <span className="text-[10px] font-mono text-[#34D399]">ЛС →</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 font-mono text-[10px] text-[#34D399]">
          ● Онлайн в комнате ({onlineUsers.length}): {onlineUsers.join(', ')}
        </div>
      </Card>

      {/* ПРАВАЯ КОЛОНКА: ОКНО СООБЩЕНИЙ */}
      <Card className="lg:col-span-8 flex flex-col justify-between h-[650px]">
        {/* Шапка чата с поиском, мьютом и настройками */}
        <div className="space-y-2 border-b border-white/10 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-medium text-white">{currentChat?.title}</h2>
              <div className="font-mono text-[10px] text-[#34D399]">
                {typingUser ? `✍ ${typingUser} печатает...` : 'Realtime · Поддержка @упоминаний, реакций и цитат'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-2 text-[#8A93A6]" />
                <input
                  type="text"
                  value={msgSearch}
                  onChange={(e) => setMsgSearch(e.target.value)}
                  placeholder="Поиск в чате..."
                  className="bg-[#050810] border border-white/10 pl-7 pr-2 py-1 text-xs text-white w-36"
                />
              </div>

              <button
                onClick={() =>
                  setMutedIds((prev) =>
                    prev.includes(activeChatId) ? prev.filter((id) => id !== activeChatId) : [...prev, activeChatId]
                  )
                }
                className="p-1.5 border border-white/10 text-[#8A93A6] hover:text-white"
                title="Приглушить уведомления (Мьют)"
              >
                {mutedIds.includes(activeChatId) ? <BellOff size={14} className="text-[#FFAA00]" /> : <Bell size={14} />}
              </button>

              <button
                onClick={() => setSettingsModal(true)}
                className="p-1.5 border border-white/10 text-[#8A93A6] hover:text-white"
                title="Настройки чата"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>

          {/* Закреплённые сообщения вверху */}
          {pinnedMessages.length > 0 && (
            <div className="p-2 bg-[#FFAA00]/10 border border-[#FFAA00]/30 flex items-center justify-between text-xs">
              <div className="truncate">
                <Pin size={12} className="inline text-[#FFAA00] mr-1.5" />
                <strong className="font-mono text-[#FFAA00]">Закреплено:</strong>{' '}
                <span className="text-zinc-200">{pinnedMessages[pinnedMessages.length - 1].content}</span>
              </div>
            </div>
          )}
        </div>

        {/* Лента сообщений */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-2">
          {filteredMessages.map((m) => {
            const isMine = m.author_id === user?.id;
            const authorUname = m.profiles?.username || '@user';
            const parentMsg = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;

            return (
              <div key={m.id} className={`flex items-start gap-3 ${isMine ? 'flex-row-reverse' : ''}`}>
                <Avatar
                  src={m.profiles?.avatar_url}
                  username={authorUname}
                  status={m.profiles?.status}
                  size="sm"
                  onClick={() => navigate(`/profile/${authorUname.replace('@', '')}`)}
                />

                <div
                  className={`p-3.5 border max-w-lg space-y-1.5 ${
                    isMine ? 'border-[#00C853]/40 bg-[#00C853]/10' : 'border-white/10 bg-[#050810]'
                  }`}
                >
                  {/* Цитата (Reply) */}
                  {parentMsg && (
                    <div className="p-2 border-l-2 border-[#FFAA00] bg-black/40 text-[11px] text-[#8A93A6]">
                      <div className="font-mono text-[#FFAA00]">{parentMsg.profiles?.username || '@user'}</div>
                      <div className="truncate">{parentMsg.content}</div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 font-mono text-[10px]">
                    <span className="text-[#FFAA00] font-bold">{authorUname}</span>
                    <div className="flex items-center gap-1.5 text-[#8A93A6]">
                      {m.edited_at && <span>(изменено)</span>}
                      <span>{new Date(m.created_at).toLocaleTimeString().slice(0, 5)}</span>
                      <button onClick={() => setReplyTo(m)} className="hover:text-white" title="Ответить">
                        <Reply size={11} />
                      </button>
                      <button onClick={() => togglePinMessage(m)} className="hover:text-[#FFAA00]" title="Закрепить">
                        <Pin size={11} />
                      </button>
                      {isMine && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMsg(m);
                              setText(m.content);
                            }}
                            className="hover:text-[#22D3EE]"
                            title="Редактировать"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => softDeleteMessage(m.id)}
                            className="hover:text-red-400"
                            title="Удалить"
                          >
                            <Trash2 size={11} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-zinc-100 leading-relaxed whitespace-pre-wrap">
                    {renderHighlightedContent(m.content)}
                  </p>

                  {/* Вложения с превью изображений */}
                  {Array.isArray(m.attachments) &&
                    m.attachments.map((att, idx) =>
                      att.type?.startsWith('image/') ? (
                        <img
                          key={idx}
                          src={att.url}
                          alt={att.name}
                          className="mt-2 max-h-48 rounded border border-white/10"
                        />
                      ) : (
                        <a
                          key={idx}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block px-2.5 py-1 bg-white/5 border border-[#22D3EE]/40 font-mono text-[10px] text-[#22D3EE]"
                        >
                          📎 {att.name}
                        </a>
                      )
                    )}

                  {/* Эмодзи-реакции */}
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {EMOJIS.map((em) => {
                      const count = (m.reactions?.[em] || []).length;
                      return (
                        <button
                          key={em}
                          onClick={() => toggleReaction(m, em)}
                          className={`px-1.5 py-0.5 text-[10px] rounded border ${
                            count > 0
                              ? 'border-[#00C853]/50 bg-[#00C853]/20 text-white'
                              : 'border-white/5 bg-black/20 text-[#8A93A6] hover:border-white/20'
                          }`}
                        >
                          {em} {count > 0 && count}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Плашка ответа или редактирования */}
        {(replyTo || editingMsg) && (
          <div className="px-3 py-1.5 bg-[#050810] border-t border-[#FFAA00]/40 flex items-center justify-between text-xs font-mono">
            <span className="text-[#FFAA00] truncate">
              {editingMsg ? `✎ Редактирование: ${editingMsg.content}` : `↩ Ответ для ${replyTo.profiles?.username}: ${replyTo.content}`}
            </span>
            <button
              onClick={() => {
                setReplyTo(null);
                setEditingMsg(null);
                setText('');
              }}
              className="text-red-400 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSendOrEdit} className="pt-3 border-t border-white/10 flex items-center gap-2">
          <label className="p-2.5 border border-white/10 hover:border-[#FFAA00] text-[#8A93A6] hover:text-white cursor-pointer">
            <Paperclip size={16} />
            <input type="file" onChange={handleFileAttach} className="hidden" />
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сообщение (используйте @username для упоминания)..."
            className="flex-1 bg-[#050810] border border-white/10 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00C853]"
          />
          <Button type="submit" size="md">
            <Send size={14} /> {editingMsg ? 'Сохранить' : 'Отправить'}
          </Button>
        </form>
      </Card>

      {/* Настройки чата */}
      <Modal isOpen={settingsModal} onClose={() => setSettingsModal(false)} title="Настройки и управление чатом">
        <div className="space-y-4">
          <Input
            label="Пригласить участника по @username"
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.target.value)}
            placeholder="@username"
          />
          <Button
            size="sm"
            onClick={async () => {
              const target = allProfiles.find(
                (p) => p.username?.toLowerCase() === inviteUsername.trim().toLowerCase()
              );
              if (!target) return toast('Пользователь не найден', 'error');
              await supabase.from('chat_members').upsert([{ chat_id: activeChatId, user_id: target.id, role: 'member' }]);
              toast(`Участник ${target.username} добавлен в чат!`, 'success');
              setInviteUsername('');
            }}
          >
            Пригласить в чат
          </Button>

          {currentChat?.owner_id === user?.id && (
            <div className="pt-4 border-t border-white/10">
              <Button variant="danger" onClick={handleDeleteChatByOwner} className="w-full">
                Удалить чат владельцем (Soft Delete)
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={newChatModal} onClose={() => setNewChatModal(false)} title="Создать новый канал">
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
            }
          }}
          className="space-y-4"
        >
          <Input label="Название чата" value={newChatTitle} onChange={(e) => setNewChatTitle(e.target.value)} required />
          <Button type="submit" className="w-full">Создать</Button>
        </form>
      </Modal>
    </div>
  );
}