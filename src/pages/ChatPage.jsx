import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, checkRateLimit, uploadFileToStorage } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Avatar, Badge, Modal, useToast } from '../components/ui/DesignSystem';
import { Send, Paperclip, Plus, LogOut, MessageCircle, Hash, Search } from 'lucide-react';

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
  const [userSearch, setUserSearch] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [newChatModal, setNewChatModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatType, setNewChatType] = useState('project');

  const bottomRef = useRef(null);
  const presenceChannelRef = useRef(null);

  useEffect(() => {
    setUnreadChatCount(0);
  }, [setUnreadChatCount]);

  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) setActiveChatId(roomParam);
  }, [searchParams]);

  // Загружаем список каналов и личных диалогов
  const { data: chats = [] } = useQuery({
    queryKey: ['chats_list_v2', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('chats').select('*').order('created_at');
      return data?.length
        ? data
        : [
            { id: 'aaaa1111-1111-1111-1111-111111111111', type: 'general', title: '#общий — Экосистема ЮГРА.НЕФТЬ' },
            { id: 'bbbb2222-2222-2222-2222-222222222222', type: 'support', title: '#поддержка — Вопросы по платформе' }
          ];
    }
  });

  // Загружаем список участников для быстрого старта личного чата (DM)
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['chat_directory_users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, status')
        .order('username');
      return data || [];
    }
  });

  // Загружаем сообщения выбранного чата
  const { data: messages = [] } = useQuery({
    queryKey: ['chat_messages', activeChatId],
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*, profiles(username, full_name, avatar_url, status)')
        .eq('chat_id', activeChatId)
        .order('created_at', { ascending: true })
        .limit(100);
      return data || [];
    }
  });

  // Запуск личного диалога в 1 клик
  const startDirectMessageWithUser = async (targetProfile) => {
    if (!targetProfile?.id || targetProfile.id === user?.id) return;
    try {
      const { data: dmChatId, error } = await supabase.rpc('get_or_create_direct_chat', {
        target_user_id: targetProfile.id
      });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['chats_list_v2'] });
      setActiveChatId(dmChatId);
      toast(`Открыт личный диалог с ${targetProfile.username}`, 'success');
    } catch (err) {
      toast(err.message || 'Не удалось открыть диалог. Выполните SQL-скрипт в Supabase.', 'error');
    }
  };

  // Realtime + Presence
  useEffect(() => {
    if (!activeChatId || !user) return;

    supabase
      .from('chat_members')
      .upsert([{ chat_id: activeChatId, user_id: user.id, last_read_at: new Date().toISOString() }])
      .then(() => {});

    const channel = supabase.channel(`room_${activeChatId}`, {
      config: { presence: { key: profile?.username || user.id } }
    });

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${activeChatId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat_messages', activeChatId] });
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineUsers(Object.keys(state));
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
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId, user, profile?.username, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTyping = (val) => {
    setText(val);
    if (presenceChannelRef.current && profile?.username) {
      presenceChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { username: profile.username }
      });
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      checkRateLimit('chat_send', 800);
      const msgText = text.trim();
      setText('');
      const { error } = await supabase.from('chat_messages').insert([{
        chat_id: activeChatId,
        author_id: user.id,
        content: msgText
      }]);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['chat_messages', activeChatId] });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleFileAttach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast('Загрузка файла...', 'info');
      const url = await uploadFileToStorage('chat-attachments', user.id, file);
      await supabase.from('chat_messages').insert([{
        chat_id: activeChatId,
        author_id: user.id,
        content: `Прикреплён файл: ${file.name}`,
        attachments: [{ name: file.name, url, type: file.type }]
      }]);
      queryClient.invalidateQueries({ queryKey: ['chat_messages', activeChatId] });
      toast('Файл отправлен!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChatTitle.trim()) return;
    try {
      const { data, error } = await supabase
        .from('chats')
        .insert([{ type: newChatType, title: newChatTitle.trim(), owner_id: user.id, org_id: profile?.org_id || null }])
        .select()
        .single();
      if (error) throw error;

      await supabase.from('chat_members').upsert([{ chat_id: data.id, user_id: user.id, role: 'owner' }]);
      await queryClient.invalidateQueries({ queryKey: ['chats_list_v2'] });
      setActiveChatId(data.id);
      setNewChatModal(false);
      setNewChatTitle('');
      toast('Групповой канал создан!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleLeaveChat = async () => {
    await supabase.from('chat_members').delete().eq('chat_id', activeChatId).eq('user_id', user.id);
    setActiveChatId('aaaa1111-1111-1111-1111-111111111111');
    toast('Вы покинули канал', 'info');
  };

  const currentChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const groupChannels = chats.filter((c) => c.type !== 'direct');
  const directChats = chats.filter((c) => c.type === 'direct');
  const otherUsers = allProfiles.filter(
    (p) =>
      p.id !== user?.id &&
      (p.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
        p.full_name?.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ЛЕВАЯ КОЛОНКА: КАНАЛЫ + ЛИЧНЫЕ СООБЩЕНИЯ В 1 КЛИК */}
      <Card className="lg:col-span-4 flex flex-col justify-between space-y-6">
        <div className="space-y-5">
          {/* 1. Групповые каналы */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-[#FFAA00] flex items-center gap-1.5">
                <Hash size={13} /> Каналы экосистемы
              </span>
              <button
                onClick={() => setNewChatModal(true)}
                className="font-mono text-[10px] uppercase text-[#34D399] hover:underline flex items-center gap-1"
              >
                <Plus size={12} /> Канал
              </button>
            </div>

            <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
              {groupChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChatId(ch.id)}
                  className={`w-full text-left p-2.5 border transition-all flex items-center justify-between ${
                    activeChatId === ch.id
                      ? 'border-[#00C853] bg-[#00C853]/10 text-white'
                      : 'border-white/5 bg-[#050810] text-[#8A93A6] hover:text-white'
                  }`}
                >
                  <span className="font-mono text-xs truncate">{ch.title}</span>
                  <Badge color="emerald">{ch.type}</Badge>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Активные личные переписки (Direct) */}
          {directChats.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-white/10">
              <span className="font-mono text-[11px] uppercase tracking-widest text-[#22D3EE] flex items-center gap-1.5">
                <MessageCircle size={13} /> Личные диалоги
              </span>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {directChats.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChatId(ch.id)}
                    className={`w-full text-left p-2.5 border transition-all flex items-center justify-between ${
                      activeChatId === ch.id
                        ? 'border-[#22D3EE] bg-[#22D3EE]/10 text-white'
                        : 'border-white/5 bg-[#050810] text-zinc-300 hover:text-white'
                    }`}
                  >
                    <span className="font-mono text-xs truncate">{ch.title}</span>
                    <Badge color="cyan">ЛС</Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Написать любому пользователю лично в 1 клик */}
          <div className="space-y-2.5 pt-3 border-t border-white/10">
            <div className="font-mono text-[11px] uppercase tracking-widest text-[#34D399]">
              Написать участнику лично:
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-2.5 text-[#8A93A6]" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Поиск по @username или имени..."
                className="w-full bg-[#050810] border border-white/10 pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00C853]"
              />
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {otherUsers.map((u) => (
                <div
                  key={u.id}
                  onClick={() => startDirectMessageWithUser(u)}
                  className="p-2 border border-white/5 bg-[#050810] hover:border-[#00C853]/50 flex items-center justify-between cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={u.avatar_url} username={u.username} status={u.status} size="sm" />
                    <div className="truncate">
                      <div className="font-mono text-xs text-[#FFAA00] truncate">{u.username}</div>
                      <div className="text-[11px] text-[#8A93A6] truncate">{u.full_name}</div>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-[#00C853]/10 border border-[#00C853]/30 font-mono text-[9px] uppercase text-[#34D399] group-hover:bg-[#00C853] group-hover:text-[#050810] transition-colors shrink-0">
                    Написать →
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Онлайн в текущей комнате */}
        <div className="pt-3 border-t border-white/10">
          <div className="font-mono text-[10px] uppercase text-[#34D399] mb-1.5">
            ● В этом чате онлайн ({onlineUsers.length}):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {onlineUsers.map((uname) => (
              <span key={uname} className="px-2 py-0.5 bg-white/5 border border-white/10 font-mono text-[10px] text-white">
                {uname}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* ПРАВАЯ КОЛОНКА: ОКНО ПЕРЕПИСКИ */}
      <Card className="lg:col-span-8 flex flex-col justify-between h-[620px]">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-base font-medium text-white">{currentChat?.title}</h2>
            <div className="font-mono text-[10px] text-[#34D399]">
              {typingUser ? `✍ ${typingUser} печатает сообщение...` : 'Защищённый канал Supabase Realtime'}
            </div>
          </div>
          {currentChat?.type !== 'general' && currentChat?.type !== 'support' && (
            <Button size="sm" variant="danger" onClick={handleLeaveChat}>
              <LogOut size={13} /> Покинуть
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-2">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center font-mono text-xs text-[#8A93A6]">
              Сообщений пока нет. Начните диалог первым!
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.author_id === user?.id;
              const authorUname = m.profiles?.username || '@user';
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
                    className={`p-3.5 border max-w-lg ${
                      isMine ? 'border-[#00C853]/40 bg-[#00C853]/10' : 'border-white/10 bg-[#050810]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 font-mono text-[10px]">
                      <button
                        onClick={() => navigate(`/profile/${authorUname.replace('@', '')}`)}
                        className="text-[#FFAA00] font-bold hover:underline"
                      >
                        {authorUname}
                      </button>
                      <span className="text-[#4A5464]">
                        {new Date(m.created_at).toLocaleTimeString().slice(0, 5)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-100 leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    {Array.isArray(m.attachments) &&
                      m.attachments.map((att, idx) => (
                        <a
                          key={idx}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block px-2.5 py-1 bg-white/5 border border-[#22D3EE]/40 font-mono text-[10px] text-[#22D3EE] hover:underline"
                        >
                          📎 {att.name}
                        </a>
                      ))}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="pt-3 border-t border-white/10 flex items-center gap-2">
          <label className="p-2.5 border border-white/10 hover:border-[#FFAA00] text-[#8A93A6] hover:text-white cursor-pointer">
            <Paperclip size={16} />
            <input type="file" onChange={handleFileAttach} className="hidden" />
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Введите сообщение..."
            className="flex-1 bg-[#050810] border border-white/10 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00C853]"
          />
          <Button type="submit" size="md">
            <Send size={14} /> Отправить
          </Button>
        </form>
      </Card>

      {/* Модальное окно создания группового канала */}
      <Modal isOpen={newChatModal} onClose={() => setNewChatModal(false)} title="Создать групповой канал">
        <form onSubmit={handleCreateChannel} className="space-y-4">
          <Input
            label="Название канала"
            value={newChatTitle}
            onChange={(e) => setNewChatTitle(e.target.value)}
            placeholder="#команда-рекультивации"
            required
          />
          <div>
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">Назначение канала</label>
            <select
              value={newChatType}
              onChange={(e) => setNewChatType(e.target.value)}
              className="w-full bg-[#050810] border border-white/10 px-3 py-2 text-xs text-white"
            >
              <option value="project">Проектная группа (#project)</option>
              <option value="org">Канал организации (#org)</option>
            </select>
          </div>
          <Button type="submit" className="w-full">Создать канал</Button>
        </form>
      </Modal>
    </div>
  );
}