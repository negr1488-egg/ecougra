import React, { useState } from 'react';
import { api, AVATAR_PRESETS } from '../../lib/supabaseClient';

export default function AuthModal({ user, onClose, onSuccess, onSignOut }) {
  const [mode, setMode] = useState(user ? 'profile' : 'login'); // 'profile' | 'edit' | 'login' | 'register'
  const [identifier, setIdentifier] = useState('@pestrikov_kv');
  const [password, setPassword] = useState('123');

  // Поля регистрации и редактирования
  const [username, setUsername] = useState(user?.username || '@new_ecologist');
  const [email, setEmail] = useState(user?.email || '');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [school, setSchool] = useState(user?.school || 'МБОУ «СОШ № 1» пгт. Пойковский');
  const [role, setRole] = useState(user?.role || 'Ученик 11А Роснефть-класса');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarPreset, setAvatarPreset] = useState(user?.avatar_preset || 'cyber-drop');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [errorMsg, setErrorMsg] = useState('');

  const allUsers = api.getAllUsers();
  const currentPreset = AVATAR_PRESETS.find((a) => a.id === (user?.avatar_preset || avatarPreset)) || AVATAR_PRESETS[0];
  const votesLeft = Math.max(0, (user?.votes_quota || 3) - (user?.votes_used || 0));

  // Загрузка собственной аватарки с компьютера
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const updated = await api.auth.updateProfile({
        username,
        full_name: fullName,
        school,
        role,
        bio,
        avatar_preset: avatarPreset,
        avatar_url: avatarUrl
      });
      onSuccess(updated);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (mode === 'login') {
        const res = await api.auth.signIn(identifier, password);
        onSuccess(res.user);
      } else {
        const res = await api.auth.signUp({
          username,
          email,
          password,
          fullName,
          school,
          role,
          avatarPreset,
          bio
        });
        onSuccess(res.user);
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const quickSwitch = async (u) => {
    const res = await api.auth.signIn(u.username, '123');
    onSuccess(res.user);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <div className="relative w-full max-w-3xl bg-[#050810] border border-white/15 shadow-[0_0_80px_rgba(0,0,0,0.95)] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00C853] to-transparent" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-10 font-mono text-[10px] tracking-widest uppercase text-[#8A93A6] hover:text-[#FFAA00] px-2.5 py-1 border border-white/10"
        >
          [ESC / ЗАКРЫТЬ]
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Левая колонка: список участников БД «Зелёная Югра» */}
          <div className="md:col-span-5 p-7 bg-[#08090f] border-b md:border-b-0 md:border-r border-white/[0.06] flex flex-col justify-between">
            <div>
              <div className="eyebrow eyebrow-emerald mb-2">База данных «Зелёная Югра»</div>
              <h3 className="text-xl font-extralight text-white">
                Автономные аккаунты <strong className="font-semibold text-[#34D399]">Эко-платформы</strong>
              </h3>
              <p className="text-xs font-light text-[#8A93A6] mt-2 leading-relaxed">
                У каждого исследователя свой уникальный <code className="text-[#FFAA00]">@username</code>, аватарка и строгий лимит в <strong>3 голоса</strong> на поддержку проектов.
              </p>

              <div className="mt-6 pt-5 border-t border-white/[0.06]">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#FFAA00] mb-3">
                  Быстрое переключение аккаунта:
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {allUsers.map((u) => {
                    const p = AVATAR_PRESETS.find((a) => a.id === u.avatar_preset) || AVATAR_PRESETS[0];
                    const active = user?.username === u.username;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => quickSwitch(u)}
                        className={`w-full text-left p-2.5 border flex items-center gap-3 transition-all ${
                          active
                            ? 'border-[#00C853] bg-[#00C853]/10'
                            : 'border-white/[0.06] bg-[#050810] hover:border-[#FFAA00]/40'
                        }`}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-base border shrink-0"
                          style={{ backgroundColor: p.bg, borderColor: p.color }}
                        >
                          {p.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-semibold text-[#FFAA00] truncate">
                              {u.username}
                            </span>
                            <span className="font-mono text-[9px] text-[#34D399]">
                              {u.green_points} XP
                            </span>
                          </div>
                          <div className="text-xs text-white truncate">{u.full_name}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.06] font-mono text-[9px] uppercase tracking-widest text-[#4A5464]">
              Таблица: public.eco_users · Квота: 3 голоса
            </div>
          </div>

          {/* Правая колонка: Карточка профиля с аватаркой / Редактирование / Вход */}
          <div className="md:col-span-7 p-8">
            {mode === 'profile' && user ? (
              <div className="space-y-6">
                {/* Шапка карточки профиля с аватаркой */}
                <div className="flex items-center gap-5">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#00C853] shadow-[0_0_25px_rgba(0,200,83,0.3)]"
                    />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center text-3xl border-2 shadow-[0_0_25px_rgba(0,200,83,0.2)] shrink-0"
                      style={{ backgroundColor: currentPreset.bg, borderColor: currentPreset.color }}
                    >
                      {currentPreset.icon}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#FFAA00]">{user.username}</span>
                      <span className="px-2 py-0.5 bg-[#00C853]/15 border border-[#00C853]/40 font-mono text-[9px] uppercase text-[#34D399]">
                        ● Online
                      </span>
                    </div>
                    <h4 className="text-xl font-medium text-white mt-0.5">{user.full_name}</h4>
                    <div className="text-xs text-[#8A93A6]">{user.role} · {user.school}</div>
                  </div>
                </div>

                {/* О себе (Bio) */}
                <div className="p-4 border border-white/[0.06] bg-[#08090f] text-xs font-light text-zinc-300 leading-relaxed">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#FFAA00] block mb-1">
                    Профессиональное досье исследователя:
                  </span>
                  {user.bio}
                </div>

                {/* Статистика и лимит голосов */}
                <div className="grid grid-cols-3 arch-grid">
                  <div className="arch-card p-4">
                    <div className="font-mono text-[9px] uppercase text-[#8A93A6]">Эко-рейтинг</div>
                    <div className="text-2xl font-extralight text-[#34D399] mt-1">{user.green_points} XP</div>
                  </div>
                  <div className="arch-card p-4">
                    <div className="font-mono text-[9px] uppercase text-[#8A93A6]">Квота голосов</div>
                    <div className="text-2xl font-extralight text-[#FFAA00] mt-1">
                      {votesLeft} <span className="text-xs text-[#8A93A6]">из {user.votes_quota || 3}</span>
                    </div>
                  </div>
                  <div className="arch-card p-4">
                    <div className="font-mono text-[9px] uppercase text-[#8A93A6]">Дерево Югры</div>
                    <div className="text-2xl font-extralight text-white mt-1">LVL 0{user.tree_level}</div>
                  </div>
                </div>

                {/* Знаки отличия */}
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-2">
                    Открытые достижения в БД:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(user.badges || []).map((b, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 bg-[#00C853]/10 border border-[#00C853]/30 font-mono text-[10px] text-[#34D399]"
                      >
                        ✦ {b}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUsername(user.username);
                      setFullName(user.full_name);
                      setSchool(user.school);
                      setRole(user.role);
                      setBio(user.bio);
                      setAvatarPreset(user.avatar_preset || 'cyber-drop');
                      setAvatarUrl(user.avatar_url || '');
                      setMode('edit');
                    }}
                    className="px-4 py-2 border border-[#FFAA00]/50 text-[#FFAA00] hover:bg-[#FFAA00]/10 font-mono text-[10px] uppercase tracking-widest"
                  >
                    ✎ Настроить аватарку и профиль
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="px-3 py-2 border border-white/10 font-mono text-[10px] uppercase text-[#8A93A6] hover:text-white"
                    >
                      Сменить юзера
                    </button>
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="px-3 py-2 border border-red-500/40 font-mono text-[10px] uppercase text-red-400 hover:bg-red-500/10"
                    >
                      Выход
                    </button>
                  </div>
                </div>
              </div>
            ) : mode === 'edit' ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00]">
                  Редактирование карточки профиля и аватарки
                </div>

                {/* Выбор пресета аватарки или загрузка фото */}
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-2">
                    Выберите векторный кибер-аватар или загрузите фото:
                  </label>
                  <div className="grid grid-cols-6 gap-2 mb-3">
                    {AVATAR_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setAvatarPreset(p.id);
                          setAvatarUrl('');
                        }}
                        className={`p-2.5 border flex flex-col items-center gap-1 transition-all ${
                          avatarPreset === p.id && !avatarUrl
                            ? 'border-[#00C853] bg-[#00C853]/15'
                            : 'border-white/10 bg-[#08090f]'
                        }`}
                      >
                        <span className="text-xl">{p.icon}</span>
                      </button>
                    ))}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-[#8A93A6] file:mr-3 file:py-1.5 file:px-3 file:border file:border-white/15 file:bg-[#08090f] file:text-xs file:font-mono file:text-white hover:file:border-[#FFAA00]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">Никнейм (@username)</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[#08090f] border border-white/10 px-3 py-2 text-xs font-mono text-[#FFAA00]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">ФИО</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#08090f] border border-white/10 px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">О себе (Досье)</label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-[#08090f] border border-white/10 p-3 text-xs text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMode('profile')}
                    className="px-4 py-2 border border-white/10 font-mono text-[10px] uppercase text-[#8A93A6]"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#00C853] text-[#050810] font-mono text-[10px] font-semibold uppercase tracking-widest"
                  >
                    Сохранить в БД
                  </button>
                </div>
              </form>
            ) : (
              /* ВХОД ИЛИ РЕГИСТРАЦИЯ ПО @USERNAME */
              <div>
                <div className="flex gap-4 border-b border-white/[0.06] pb-3 mb-5">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className={`font-mono text-xs uppercase tracking-[0.2em] pb-1 border-b-2 ${
                      mode === 'login' ? 'border-[#FFAA00] text-[#FFAA00]' : 'border-transparent text-[#8A93A6]'
                    }`}
                  >
                    01 / Вход по @username
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className={`font-mono text-xs uppercase tracking-[0.2em] pb-1 border-b-2 ${
                      mode === 'register' ? 'border-[#00C853] text-[#34D399]' : 'border-transparent text-[#8A93A6]'
                    }`}
                  >
                    02 / Новый аккаунт
                  </button>
                </div>

                {errorMsg && (
                  <div className="mb-4 p-3 border border-red-500/40 bg-red-500/10 text-red-300 font-mono text-xs">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {mode === 'login' ? (
                    <>
                      <div>
                        <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">
                          Ваш @username или Email
                        </label>
                        <input
                          type="text"
                          required
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder="@pestrikov_kv"
                          className="w-full bg-[#08090f] border border-white/10 px-3.5 py-2.5 text-sm font-mono text-[#FFAA00]"
                        />
                      </div>
                      <div>
                        <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">Пароль</label>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-[#08090f] border border-white/10 px-3.5 py-2.5 text-sm text-white"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">
                            Уникальный @username
                          </label>
                          <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="@ivanov_ugra"
                            className="w-full bg-[#08090f] border border-white/10 px-3 py-2 text-xs font-mono text-[#FFAA00]"
                          />
                        </div>
                        <div>
                          <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">Email</label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="student@ugra.ru"
                            className="w-full bg-[#08090f] border border-white/10 px-3 py-2 text-xs text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">ФИО</label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full bg-[#08090f] border border-white/10 px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#00C853] hover:bg-[#34D399] text-[#050810] font-mono text-xs font-semibold uppercase tracking-[0.22em]"
                  >
                    {mode === 'login' ? 'Войти в «Зелёную Югру»' : 'Зарегистрировать @username'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}