import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, checkRateLimit, uploadFileToStorage } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Avatar, Badge, Modal, useToast } from '../components/ui/DesignSystem';
import { Send, Paperclip, UserPlus, Plus, LogOut } from 'lucide-react';

export default function ChatPage() {
  const { user, profile, setUnreadChatCount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeChatId, setActiveChatId] = useState('aaaa1111-1111-1111-1111-111111111111');
  const [text, setText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [newChatModal, setNewChatModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatType, setNewChatType] = useState('project');
  const bottomRef = useRef(null);
  const presenceChannelRef = useRef(null);

  useEffect(() => {
    setUnreadChatCount(0);
  }, [setUnreadChatCount]);

  // Загружаем список доступных чатов
  const { data: chats = [] } = useQuery({
    queryKey: ['chats_list', user?.id],
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

  // Realtime: новые сообщения + Supabase Presence (онлайн и статус «печатает»)
  useEffect(() => {
    if (!activeChatId || !user) return;

    // Обновляем last_read_at
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
      checkRateLimit('chat_send', 1000);
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
      toast('Загрузка вложения в Supabase Storage...', 'info');
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

  const handleInviteByUsername = async (e) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    const formatted = inviteUsername.startsWith('@') ? inviteUsername.trim() : `@${inviteUsername.trim()}`;
    const { data: target } = await supabase.from('profiles').select('id, username').eq('username', formatted).maybeSingle();
    if (!target) return toast(`Пользователь ${formatted} не найден`, 'error');

    await supabase.from('chat_members').upsert([{ chat_id: activeChatId, user_id: target.id, role: 'member' }]);
    setInviteUsername('');
    toast(`Участник ${target.username} добавлен в чат!`, 'success');
  };

  const handleCreateChat = async (e) => {
    e.preventDefault();
    if (!newChatTitle.trim()) return;
    const { data, error } = await supabase
      .from('chats')
      .insert([{ type: newChatType, title: newChatTitle, owner_id: user.id, org_id: profile?.org_id }])
      .select()
      .single();
    if (error) return toast(error.message, 'error');

    await supabase.from('chat_members').insert([{ chat_id: data.id, user_id: user.id, role: 'owner' }]);
    queryClient.invalidateQueries({ queryKey: ['chats_list'] });
    setActiveChatId(data.id);
    setNewChatModal(false);
    setNewChatTitle('');
    toast('Новый канал создан!', 'success');
  };

  const handleLeaveChat = async () => {
    await supabase.from('chat_members').delete().eq('chat_id', activeChatId).eq('user_id', user.id);
    setActiveChatId('aaaa1111-1111-1111-1111-111111111111');
    toast('Вы покинули чат', 'info');
  };

  const currentChat = chats.find((c) => c.id === activeChatId) || chats[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* СПИСОК КАНАЛОВ И PRESENCE ОНЛАЙН */}
      <Card className="lg:col-span-4 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-[#FFAA00]">Каналы и Диалоги</span>
            <Button size="sm" variant="outline" onClick={() => setNewChatModal(true)}>
              <Plus size={13} /> Создать
            </Button>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {chats.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChatId(ch.id)}
                className={`w-full text-left p-3 border transition-all flex items-center justify-between ${
                  activeChatId === ch.id
                    ? 'border-[#00C853] bg-[#00C853]/10 text-white'
                    : 'border-white/5 bg-[#050810] text-[#8A93A6] hover:text-white'
                }`}
              >
                <span className="font-mono text-xs truncate">{ch.title}</span>
                <Badge color="gold">{ch.type}</Badge>
              </button>
            ))}
          </div>

          {/* Приглашение в текущий чат по @username */}
          <form onSubmit={handleInviteByUsername} className="pt-4 border-t border-white/10 space-y-2">
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6]">
              Пригласить участника по @username
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder="@username..."
                className="flex-1 bg-[#050810] border border-white/10 px-3 py-1.5 text-xs font-mono text-[#FFAA00]"
              />
              <Button type="submit" size="sm" variant="outline">
                <UserPlus size={14} />
              </Button>
            </div>
          </form>
        </div>

        {/* Онлайн в комнате через Supabase Presence */}
        <div className="pt-4 border-t border-white/10">
          <div className="font-mono text-[10px] uppercase text-[#34D399] mb-2">
            ● Сейчас в канале ({onlineUsers.length}):
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

      {/* ОКНО СООБЩЕНИЙ */}
      <Card className="lg:col-span-8 flex flex-col justify-between h-[580px]">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-base font-medium text-white">{currentChat?.title}</h2>
            <div className="font-mono text-[10px] text-[#34D399]">
              {typingUser ? `✍ ${typingUser} печатает...` : 'Supabase Realtime + Presence активен'}
            </div>
          </div>
          {currentChat?.type !== 'general' && (
            <Button size="sm" variant="danger" onClick={handleLeaveChat}>
              <LogOut size={13} /> Выйти
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-2">
          {messages.map((m) => {
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
                        📎 Скачать: {att.name}
                      </a>
                    ))}
                </div>
              </div>
            );
          })}
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
            placeholder="Напишите сообщение или упомяните @username..."
            className="flex-1 bg-[#050810] border border-white/10 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00C853]"
          />
          <Button type="submit" size="md">
            <Send size={14} /> Отправить
          </Button>
        </form>
      </Card>

      <Modal isOpen={newChatModal} onClose={() => setNewChatModal(false)} title="Создать новый канал чата">
        <form onSubmit={handleCreateChat} className="space-y-4">
          <Input
            label="Название чата"
            value={newChatTitle}
            onChange={(e) => setNewChatTitle(e.target.value)}
            placeholder="#проект-биоремедиация"
            required
          />
          <div>
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">Тип канала</label>
            <select
              value={newChatType}
              onChange={(e) => setNewChatType(e.target.value)}
              className="w-full bg-[#050810] border border-white/10 px-3 py-2 text-xs text-white"
            >
              <option value="project">Проектный чат (#project)</option>
              <option value="org">Чат организации (#org)</option>
              <option value="direct">Личный диалог (direct)</option>
            </select>
          </div>
          <Button type="submit" className="w-full">Создать чат</Button>
        </form>
      </Modal>
    </div>
  );
}