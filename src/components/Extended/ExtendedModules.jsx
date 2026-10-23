import React, { useState, useEffect, useRef } from 'react';
import { fullEcoData } from '../../data/fullEcoData';
import { api, AVATAR_PRESETS } from '../../lib/supabaseClient';

export default function ExtendedModules({ user, onActionComplete }) {
  const [subTab, setSubTab] = useState('defense'); // 'defense' | 'chat' | 'lab' | 'rating'

  // СОСТОЯНИЕ ПЛАТФОРМЫ ЗАЩИТЫ ПРОЕКТОВ
  const [projects, setProjects] = useState([]);
  const [activeProj, setActiveProj] = useState(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [pitchTimer, setPitchTimer] = useState(300); // 5 минут = 300 сек
  const [timerRunning, setTimerRunning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Оценки жюри
  const [scores, setScores] = useState({
    jury_novelty: 10,
    jury_eco: 10,
    jury_tech: 9,
    jury_economy: 9,
    jury_pitch: 10
  });
  const [qaList, setQaList] = useState([]);
  const [questionInput, setQuestionInput] = useState('');
  const [scoreSaved, setScoreSaved] = useState(false);

  // СОСТОЯНИЕ ЧАТА ПО @USERNAME
  const [chatChannel, setChatChannel] = useState('general'); // 'general' | 'defense' | 'patrol' | 'dm'
  const [dmPeer, setDmPeer] = useState('@morozov_ap');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [searchUser, setSearchUser] = useState('');

  // СОСТОЯНИЕ ХИМИЧЕСКОЙ ЛАБОРАТОРИИ ПРОБ ХМАО
  const [samplePh, setSamplePh] = useState(5.2);
  const [sampleOilMg, setSampleOilMg] = useState(4.8);
  const [labResult, setLabResult] = useState(null);

  const allUsers = api.getAllUsers();

  useEffect(() => {
    loadDefenseProjects();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (activeProj) {
      setQaList(api.getDefenseQA(activeProj.id));
      setScores({
        jury_novelty: activeProj.jury_novelty || 9,
        jury_eco: activeProj.jury_eco || 10,
        jury_tech: activeProj.jury_tech || 9,
        jury_economy: activeProj.jury_economy || 9,
        jury_pitch: activeProj.jury_pitch || 10
      });
      setSlideIdx(0);
    }
  }, [activeProj]);

  useEffect(() => {
    loadMessages();
  }, [chatChannel, dmPeer, user]);

  useEffect(() => {
    if (!timerRunning) return;
    const t = setInterval(() => {
      setPitchTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [timerRunning]);

  const loadDefenseProjects = async () => {
    const list = await api.getProjects();
    setProjects(list);
    if (list.length > 0 && !activeProj) setActiveProj(list[0]);
  };

  const loadMessages = () => {
    const myUname = user?.username || '@pestrikov_kv';
    setMessages(api.getChatMessages(chatChannel, myUname, dmPeer));
  };

  // Включение/отключение опционального видеопотока докладчика
  const toggleCamera = async () => {
    if (cameraActive) {
      stopCamera();
      return;
    }
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      setCameraError('Камера не подключена или доступ запрещён браузером. Активен режим демонстрации слайдов.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleSaveJuryScore = async () => {
    if (!activeProj) return;
    const updated = await api.scoreProjectDefense(activeProj.id, scores);
    setProjects(updated);
    const current = updated.find((p) => p.id === activeProj.id);
    setActiveProj(current);
    setScoreSaved(true);
    setTimeout(() => setScoreSaved(false), 3000);
    if (onActionComplete) onActionComplete();
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!questionInput.trim() || !activeProj) return;
    const updatedQa = await api.addDefenseQA(
      activeProj.id,
      questionInput,
      'Ответ докладчика зафиксирован в стенограмме комиссии.'
    );
    setQaList(updatedQa);
    setQuestionInput('');
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    await api.sendChatMessage({
      channel: chatChannel,
      recipientUsername: chatChannel === 'dm' ? dmPeer : null,
      text: chatInput
    });
    setChatInput('');
    loadMessages();
  };

  const startDirectMessage = (targetUsername) => {
    setDmPeer(targetUsername);
    setChatChannel('dm');
    setSubTab('chat');
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `0${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalScore =
    scores.jury_novelty + scores.jury_eco + scores.jury_tech + scores.jury_economy + scores.jury_pitch;

  return (
    <div className="space-y-8">
      {/* Переключатель 4 крупных модулей */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="eyebrow mb-2">07 / Интерактивные коммуникации и научная защита</div>
          <h2 className="text-3xl font-extralight text-white tracking-tight">
            Защита проектов, <strong className="font-semibold text-[#FFAA00]">Чат по @username и Эко-Лаборатория</strong>
          </h2>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'defense', label: '01 / Платформа защиты проектов' },
            { id: 'chat', label: '02 / Чат участников (@username)' },
            { id: 'lab', label: '03 / Лаборатория проб & NDVI' },
            { id: 'rating', label: '04 / Рейтинг школ & Волонтёры' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3.5 py-2 font-mono text-[10px] uppercase tracking-widest border transition-all ${
                subTab === t.id
                  ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00]'
                  : 'border-white/10 text-[#8A93A6] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          МОДУЛЬ 1: ПЛАТФОРМА ДЛЯ ЗАЩИТЫ ПРОЕКТОВ (СЛАЙДЫ + WEBRTC ВИДЕО + ЖЮРИ)
         ===================================================================== */}
      {subTab === 'defense' && activeProj && (
        <div className="space-y-6">
          {/* Выбор защищаемого проекта */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#08090f] p-4 border border-white/[0.06]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase text-[#8A93A6] mr-2">Выступающий проект:</span>
              {projects.map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => setActiveProj(p)}
                  className={`px-3 py-1.5 font-mono text-[10px] border transition-all ${
                    activeProj.id === p.id
                      ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399]'
                      : 'border-white/10 text-[#8A93A6] hover:text-white'
                  }`}
                >
                  0{idx + 1} · {p.author_username}
                </button>
              ))}
            </div>

            {/* Таймер регламента защиты */}
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 border border-[#FFAA00]/40 bg-[#050810] font-mono text-xs text-[#FFAA00]">
                ⏱ Регламент: <strong>{formatTime(pitchTimer)}</strong>
              </div>
              <button
                onClick={() => setTimerRunning(!timerRunning)}
                className="px-3 py-1.5 bg-[#FFAA00] text-[#050810] font-mono text-[10px] font-bold uppercase"
              >
                {timerRunning ? 'Пауза' : 'Старт доклада'}
              </button>
              <button
                onClick={() => {
                  setTimerRunning(false);
                  setPitchTimer(300);
                }}
                className="px-2.5 py-1.5 border border-white/10 font-mono text-[10px] text-[#8A93A6]"
              >
                Сброс
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 arch-grid">
            {/* Сцена докладчика: Слайды презентации + Опциональное видео (WebRTC) */}
            <div className="lg:col-span-7 arch-card p-7 flex flex-col justify-between space-y-6">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/50 font-mono text-[9px] uppercase text-red-400">
                      ● ПРЯМОЙ ЭФИР ЗАЩИТЫ
                    </span>
                    <button
                      onClick={() => startDirectMessage(activeProj.author_username)}
                      className="font-mono text-xs text-[#FFAA00] hover:underline"
                    >
                      Докладчик: {activeProj.author_username} (Написать в ЛС ↗)
                    </button>
                  </div>

                  <button
                    onClick={toggleCamera}
                    className={`px-3 py-1 font-mono text-[10px] uppercase border transition-all ${
                      cameraActive
                        ? 'border-[#00C853] bg-[#00C853]/20 text-[#34D399]'
                        : 'border-white/15 text-[#8A93A6] hover:text-white'
                    }`}
                  >
                    {cameraActive ? '📹 Камера включена (Выкл)' : '📷 Включить видеопоток (Опционально)'}
                  </button>
                </div>

                <h3 className="text-xl font-medium text-white leading-snug mb-4">{activeProj.title}</h3>

                {cameraError && (
                  <div className="mb-3 p-2.5 border border-[#FFAA00]/40 bg-[#FFAA00]/10 font-mono text-[10px] text-[#FFAA00]">
                    {cameraError}
                  </div>
                )}

                {/* Экран презентации или веб-камеры */}
                <div className="relative min-h-[250px] border border-white/10 bg-[#08090f] p-6 flex flex-col justify-between">
                  {cameraActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-56 object-cover border border-[#00C853]/40"
                    />
                  ) : (
                    <div className="my-auto space-y-3">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-[#00C853]">
                        Демонстрация презентации · Слайд {slideIdx + 1} из {(activeProj.slides || []).length || 1}
                      </div>
                      <h4 className="text-lg font-medium text-white">
                        {activeProj.slides?.[slideIdx]?.title || 'Инженерное обоснование проекта'}
                      </h4>
                      <p className="text-sm font-light text-zinc-300 leading-relaxed">
                        {activeProj.slides?.[slideIdx]?.content || activeProj.description}
                      </p>
                      <div className="pt-3 flex items-center gap-4 font-mono text-xs text-[#FFAA00]">
                        <span>Целевой KPI: {activeProj.impact_metric}</span>
                        <span>·</span>
                        <span>Голосов поддержки в БД: {activeProj.votes_count}</span>
                      </div>
                    </div>
                  )}

                  {/* Переключение слайдов */}
                  {activeProj.slides && activeProj.slides.length > 1 && (
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                      <button
                        onClick={() => setSlideIdx((prev) => Math.max(0, prev - 1))}
                        className="px-3 py-1 border border-white/10 font-mono text-[10px] text-[#8A93A6] hover:text-white"
                      >
                        ← Пред. слайд
                      </button>
                      <span className="font-mono text-[10px] text-[#8A93A6]">
                        Слайд {slideIdx + 1} / {activeProj.slides.length}
                      </span>
                      <button
                        onClick={() =>
                          setSlideIdx((prev) => Math.min(activeProj.slides.length - 1, prev + 1))
                        }
                        className="px-3 py-1 border border-white/10 font-mono text-[10px] text-[#8A93A6] hover:text-white"
                      >
                        След. слайд →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Секция вопросов от комиссии и зрителей по @username */}
              <div className="space-y-3 pt-4 border-t border-white/[0.06]">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#FFAA00]">
                  Вопросы экспертной комиссии к докладчику ({qaList.length}):
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {qaList.map((q) => (
                    <div key={q.id} className="p-3 border border-white/[0.06] bg-[#08090f] text-xs">
                      <div className="font-mono text-[10px] text-[#FFAA00]">
                        Вопрос от {q.asker_username} ({q.asker_name}):
                      </div>
                      <div className="text-white mt-0.5">{q.question_text}</div>
                      {q.answer_text && (
                        <div className="text-[#34D399] font-light mt-1 pl-2 border-l border-[#00C853]">
                          Ответ {activeProj.author_username}: {q.answer_text}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAskQuestion} className="flex gap-2">
                  <input
                    type="text"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder={`Задать вопрос докладчику ${activeProj.author_username}...`}
                    className="flex-1 bg-[#08090f] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFAA00]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#FFAA00] text-[#050810] font-mono text-[10px] font-bold uppercase"
                  >
                    Спросить
                  </button>
                </form>
              </div>
            </div>

            {/* Правая панель: Оценочный лист экспертного жюри (5 критериев) */}
            <div className="lg:col-span-5 arch-card p-7 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#34D399]">
                      Лист аттестационной комиссии
                    </div>
                    <div className="text-base font-medium text-white mt-0.5">
                      Оценка защиты проекта
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-2xl font-light text-[#FFAA00]">{totalScore} / 50</div>
                    <div className="text-[9px] text-[#8A93A6] uppercase">Итоговый балл</div>
                  </div>
                </div>

                {[
                  { key: 'jury_novelty', label: '1. Научная новизна и оригинальность' },
                  { key: 'jury_eco', label: '2. Экологический эффект для ХМАО-Югры' },
                  { key: 'jury_tech', label: '3. Инженерно-техническая проработка' },
                  { key: 'jury_economy', label: '4. Экономическая целесообразность' },
                  { key: 'jury_pitch', label: '5. Качество доклада и ответов на вопросы' }
                ].map((crit) => (
                  <div key={crit.key}>
                    <div className="flex justify-between font-mono text-xs mb-1.5">
                      <span className="text-zinc-300">{crit.label}</span>
                      <span className="text-[#34D399] font-bold">{scores[crit.key]} / 10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={scores[crit.key]}
                      onChange={(e) =>
                        setScores((prev) => ({ ...prev, [crit.key]: Number(e.target.value) }))
                      }
                      className="w-full"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleSaveJuryScore}
                  className="w-full py-3.5 bg-[#00C853] hover:bg-[#34D399] text-[#050810] font-mono text-xs font-semibold uppercase tracking-[0.2em]"
                >
                  Утвердить протокол защиты в БД (+50 XP)
                </button>
                {scoreSaved && (
                  <div className="p-2.5 border border-[#00C853]/50 bg-[#00C853]/10 font-mono text-[10px] text-[#34D399] text-center">
                    ✓ Протокол оценки ({totalScore}/50) сохранён в public.eco_projects!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          МОДУЛЬ 2: ЧАТ МЕЖДУ УЧАСТНИКАМИ ПО @USERNAME (КАНАЛЫ + ЛИЧНЫЕ СООБЩЕНИЯ)
         ===================================================================== */}
      {subTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 arch-grid">
          {/* Левая колонка: Каналы и поиск участников по @username */}
          <div className="lg:col-span-4 arch-card p-6 space-y-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#FFAA00] mb-3">
                Общие каналы экосистемы
              </div>
              <div className="space-y-1.5">
                {[
                  { id: 'general', name: '# общий-эко-чат', desc: 'Все участники Зелёной Югры' },
                  { id: 'defense', name: '# защита-проектов', desc: 'Вопросы к докладчикам и жюри' },
                  { id: 'patrol', name: '# эко-патруль-хмао', desc: 'Сводки с месторождений и ООПТ' }
                ].map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setChatChannel(ch.id)}
                    className={`w-full text-left px-3.5 py-2.5 border transition-all ${
                      chatChannel === ch.id
                        ? 'border-[#00C853] bg-[#00C853]/10 text-white'
                        : 'border-white/5 bg-[#08090f] text-[#8A93A6] hover:text-white'
                    }`}
                  >
                    <div className="font-mono text-xs font-medium text-[#34D399]">{ch.name}</div>
                    <div className="text-[10px] text-[#8A93A6]">{ch.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Поиск и Личные сообщения по @username */}
            <div className="pt-4 border-t border-white/[0.06]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#22D3EE] mb-2">
                Личные сообщения по @username
              </div>
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Поиск по @username или имени..."
                className="w-full bg-[#08090f] border border-white/10 px-3 py-2 text-xs font-mono text-white mb-3 focus:outline-none focus:border-[#22D3EE]"
              />
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {allUsers
                  .filter(
                    (u) =>
                      u.username.toLowerCase().includes(searchUser.toLowerCase()) ||
                      u.full_name.toLowerCase().includes(searchUser.toLowerCase())
                  )
                  .map((u) => {
                    const p = AVATAR_PRESETS.find((a) => a.id === u.avatar_preset) || AVATAR_PRESETS[0];
                    const isSelectedDm = chatChannel === 'dm' && dmPeer === u.username;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          setDmPeer(u.username);
                          setChatChannel('dm');
                        }}
                        className={`w-full text-left p-2.5 border flex items-center gap-3 transition-all ${
                          isSelectedDm
                            ? 'border-[#22D3EE] bg-[#22D3EE]/10'
                            : 'border-white/5 bg-[#08090f] hover:border-white/20'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm border shrink-0"
                          style={{ backgroundColor: p.bg, borderColor: p.color }}
                        >
                          {p.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-semibold text-[#FFAA00] truncate">
                              {u.username}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00C853]" />
                          </div>
                          <div className="text-[11px] text-zinc-300 truncate">{u.full_name}</div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Правая колонка: Лента сообщений и отправка */}
          <div className="lg:col-span-8 arch-card p-6 flex flex-col justify-between h-[520px]">
            <div className="pb-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <div className="font-mono text-xs text-[#FFAA00] uppercase">
                  {chatChannel === 'dm'
                    ? `Личный диалог: ${user?.username} ↔ ${dmPeer}`
                    : `Канал: #${chatChannel}`}
                </div>
                <div className="text-[11px] text-[#8A93A6]">
                  Вы общаетесь как <strong className="text-[#34D399] font-mono">{user?.username}</strong> ({user?.full_name})
                </div>
              </div>
              <span className="font-mono text-[10px] text-[#34D399]">● Realtime синхронизация БД</span>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-2">
              {messages.length === 0 ? (
                <div className="text-center text-xs font-mono text-[#8A93A6] my-16">
                  Сообщений с {dmPeer} пока нет. Напишите первым!
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_username === user?.username;
                  const av = AVATAR_PRESETS.find((a) => a.id === m.sender_avatar) || AVATAR_PRESETS[0];
                  return (
                    <div
                      key={m.id}
                      className={`p-4 border max-w-xl ${
                        isMe
                          ? 'ml-auto border-[#00C853]/40 bg-[#00C853]/10'
                          : 'border-white/10 bg-[#08090f]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{av.icon}</span>
                          <button
                            onClick={() => {
                              setDmPeer(m.sender_username);
                              setChatChannel('dm');
                            }}
                            className="font-mono text-xs font-bold text-[#FFAA00] hover:underline"
                          >
                            {m.sender_username}
                          </button>
                          <span className="text-[11px] text-[#8A93A6] hidden sm:inline">
                            ({m.sender_name})
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-[#4A5464]">{m.created_at}</span>
                      </div>
                      <div className="text-xs text-zinc-100 leading-relaxed">{m.message_text}</div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendChat} className="pt-3 border-t border-white/[0.06] flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  chatChannel === 'dm'
                    ? `Личное сообщение для ${dmPeer}...`
                    : 'Введите сообщение или упомяните участника через @username...'
                }
                className="flex-1 bg-[#08090f] border border-white/10 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00C853]"
              />
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#00C853] hover:bg-[#34D399] text-[#050810] font-mono text-xs font-semibold uppercase tracking-widest"
              >
                Отправить →
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          МОДУЛЬ 3: ЭКСПРЕСС-ЛАБОРАТОРИЯ ПРОБ ВОДЫ/ТОРФА ХМАО + СПУТНИКОВЫЙ NDVI
         ===================================================================== */}
      {subTab === 'lab' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 arch-grid">
          <div className="lg:col-span-6 arch-card p-7 space-y-6">
            <div>
              <div className="eyebrow eyebrow-emerald mb-1">Полевая физико-химическая лаборатория</div>
              <h3 className="text-xl font-medium text-white">
                Экспресс-анализ проб торфа и талых вод кустовой площадки
              </h3>
            </div>

            <div>
              <div className="flex justify-between font-mono text-xs mb-2">
                <span className="text-[#8A93A6]">Кислотность пробы грунта (pH):</span>
                <span className="text-[#FFAA00] font-bold">pH {samplePh}</span>
              </div>
              <input
                type="range"
                min="3.5"
                max="8.5"
                step="0.1"
                value={samplePh}
                onChange={(e) => setSamplePh(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between font-mono text-xs mb-2">
                <span className="text-[#8A93A6]">Остаточные нефтепродукты (мг/кг):</span>
                <span className="text-[#22D3EE] font-bold">{sampleOilMg} мг/кг</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="25.0"
                step="0.5"
                value={sampleOilMg}
                onChange={(e) => setSampleOilMg(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <button
              onClick={async () => {
                const needDolomite = samplePh < 5.8 ? Math.round((6.2 - samplePh) * 450) : 0;
                const needBiosorbent = sampleOilMg > 2.0 ? Math.round(sampleOilMg * 18) : 0;
                setLabResult({
                  status: samplePh >= 5.8 && sampleOilMg <= 2.0 ? 'Проба в пределах нормы ООПТ' : 'Требуется биоремедиация участка',
                  needDolomite,
                  needBiosorbent
                });
                await api.addRewards(35, 'Химик-лаборант Югры');
                if (onActionComplete) onActionComplete();
              }}
              className="w-full py-3 bg-[#00C853] text-[#050810] font-mono text-xs font-semibold uppercase tracking-widest"
            >
              Провести спектральный анализ пробы (+35 XP)
            </button>

            {labResult && (
              <div className="p-4 border border-[#00C853]/40 bg-[#08090f] space-y-2 font-mono text-xs">
                <div className="text-[#34D399] font-bold">{labResult.status}</div>
                <div className="text-zinc-300">
                  Рекомендовано доломитовой муки (раскисление): <strong>{labResult.needDolomite} кг/га</strong>
                </div>
                <div className="text-zinc-300">
                  Рекомендовано сфагнового биосорбента: <strong>{labResult.needBiosorbent} кг/га</strong>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-6 arch-card p-7 space-y-4">
            <div className="eyebrow eyebrow-cyan">Спутниковый индекс NDVI (Sentinel-2)</div>
            <h3 className="text-xl font-medium text-white">Дистанционное зондирование полигонов ХМАО</h3>
            <div className="space-y-3">
              {fullEcoData.satelliteSectors.map((sec) => (
                <div key={sec.id} className="p-4 border border-white/[0.06] bg-[#08090f]">
                  <div className="flex justify-between font-mono text-[10px] text-[#FFAA00]">
                    <span>{sec.name}</span>
                    <span>{sec.coords}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 font-mono text-xs">
                    <div>NDVI: <strong className="text-[#34D399]">{sec.ndvi}</strong></div>
                    <div>Факелы: <strong className="text-white">{sec.thermalAnomalies}</strong></div>
                    <div>Площадь: <strong className="text-[#22D3EE]">{sec.reclamationArea}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          МОДУЛЬ 4: РЕЙТИНГ ШКОЛ ХМАО И ВОЛОНТЁРСКИЙ КАЛЕНДАРЬ
         ===================================================================== */}
      {subTab === 'rating' && (
        <div className="border border-white/[0.06] bg-[#050810] overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] bg-[#08090f] font-mono text-[10px] uppercase tracking-widest text-[#8A93A6]">
                <th className="py-4 px-6">Ранг</th>
                <th className="py-4 px-6">Образовательная организация ХМАО-Югры</th>
                <th className="py-4 px-6">Муниципалитет</th>
                <th className="py-4 px-6">Статус</th>
                <th className="py-4 px-6 text-right">Эко-рейтинг</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-sm">
              {fullEcoData.schoolRatings.map((row) => (
                <tr key={row.rank} className="hover:bg-white/[0.02]">
                  <td className="py-4 px-6 font-mono text-xs text-[#FFAA00]">0{row.rank}</td>
                  <td className="py-4 px-6 font-medium text-white">{row.school}</td>
                  <td className="py-4 px-6 text-xs text-[#8A93A6]">{row.city}</td>
                  <td className="py-4 px-6">
                    <span className="px-2.5 py-1 bg-[#00C853]/10 border border-[#00C853]/30 font-mono text-[10px] uppercase text-[#34D399]">
                      {row.badge}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-sm font-semibold text-[#34D399] text-right">
                    {row.points.toLocaleString()} XP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}