import React, { useState, useEffect } from 'react';
import { api, AVATAR_PRESETS } from '../../lib/supabaseClient';

export default function GreenFootprint({ user, onProjectSubmitted, onNavigateDefense }) {
  const [projects, setProjects] = useState([]);
  const [votedIds, setVotedIds] = useState([]);
  const [filterCat, setFilterCat] = useState('all');
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState('');
  const [description, setDescription] = useState('');
  const [impactMetric, setImpactMetric] = useState('-30% выбросов CO₂');
  const [category, setCategory] = useState('reclamation');
  const [showForm, setShowForm] = useState(false);
  const [voteNotice, setVoteNotice] = useState(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    const list = await api.getProjects();
    setProjects(list);
    if (user?.id) {
      setVotedIds(api.getUserVotedProjectIds(user.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const updated = await api.createProject({
      title,
      problem_statement: problem,
      description,
      impact_metric: impactMetric,
      category
    });
    setProjects(updated);
    setTitle('');
    setProblem('');
    setDescription('');
    setShowForm(false);
    if (onProjectSubmitted) onProjectSubmitted();
  };

  const handleVote = async (projectId) => {
    setVoteNotice(null);
    try {
      const res = await api.toggleProjectVote(projectId);
      setProjects(res.projects);
      setVotedIds(api.getUserVotedProjectIds(res.user.id));
      setVoteNotice({
        type: 'ok',
        text:
          res.action === 'added'
            ? `Голос от ${res.user.username} учтён в БД! (+15 XP)`
            : `Голос отозван. Слот возвращён в вашу квоту.`
      });
      if (onProjectSubmitted) onProjectSubmitted();
    } catch (err) {
      setVoteNotice({ type: 'err', text: err.message });
    }
  };

  const categories = {
    reclamation: { label: 'Рекультивация и биосорбенты', color: '#00C853' },
    apg_processing: { label: 'Утилизация ПНГ', color: '#FFAA00' },
    energy_efficiency: { label: 'ВИЭ и энергоэффективность', color: '#22D3EE' },
    biodiversity: { label: 'Сохранение биоразнообразия', color: '#A78BFA' }
  };

  const votesQuota = user?.votes_quota || 3;
  const votesUsed = votedIds.length;
  const votesLeft = Math.max(0, votesQuota - votesUsed);

  const visibleProjects =
    filterCat === 'all' ? projects : projects.filter((p) => p.category === filterCat);

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="eyebrow mb-2">06 / Проектная мастерская и народное голосование БД</div>
          <h2 className="text-3xl font-extralight text-white tracking-tight">
            Банк инициатив <strong className="font-semibold text-[#34D399]">«Зелёный след»</strong>
          </h2>
        </div>

        {/* Индикатор лимита голосов пользователя */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2.5 bg-[#08090f] border border-[#FFAA00]/40 flex items-center gap-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#8A93A6]">
              Ваша квота голосов ({user?.username}):
            </div>
            <div className="flex items-center gap-1">
              {[...Array(votesQuota)].map((_, idx) => (
                <span
                  key={idx}
                  className={`w-2.5 h-2.5 rotate-45 border ${
                    idx < votesLeft
                      ? 'bg-[#00C853] border-[#00C853] shadow-[0_0_8px_#00C853]'
                      : 'bg-transparent border-zinc-600'
                  }`}
                />
              ))}
            </div>
            <span className="font-mono text-xs font-bold text-[#FFAA00]">
              {votesLeft} из {votesQuota} доступно
            </span>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 bg-[#00C853] hover:bg-[#34D399] text-[#050810] font-mono text-xs font-semibold uppercase tracking-widest"
          >
            {showForm ? '✕ Скрыть форму' : '+ Выдвинуть проект (+75 XP)'}
          </button>
        </div>
      </div>

      {voteNotice && (
        <div
          className={`p-4 border font-mono text-xs flex items-center justify-between ${
            voteNotice.type === 'err'
              ? 'border-red-500/50 bg-red-500/10 text-red-300'
              : 'border-[#00C853]/50 bg-[#00C853]/10 text-[#34D399]'
          }`}
        >
          <span>{voteNotice.text}</span>
          <button onClick={() => setVoteNotice(null)} className="text-zinc-400 hover:text-white">✕</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-[#00C853]/40 bg-[#08090f] p-7 space-y-4">
          <div className="font-mono text-xs uppercase tracking-widest text-[#34D399]">
            Регистрация нового проекта в таблице public.eco_projects (Автор: {user?.username})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название инженерно-экологического проекта..."
              className="md:col-span-2 bg-[#050810] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00C853]"
            />
            <input
              type="text"
              required
              value={impactMetric}
              onChange={(e) => setImpactMetric(e.target.value)}
              placeholder="Целевой KPI (напр. -35 т CO₂)"
              className="bg-[#050810] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00C853]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-[#050810] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00C853]"
            >
              {Object.entries(categories).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <input
              type="text"
              required
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Решаемая экологическая проблема ХМАО..."
              className="md:col-span-2 bg-[#050810] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00C853]"
            />
          </div>

          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Подробное технологическое описание проекта для защиты перед жюри..."
            className="w-full bg-[#050810] border border-white/10 p-3.5 text-sm text-white focus:outline-none focus:border-[#00C853]"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#FFAA00] text-[#050810] font-mono text-xs font-semibold uppercase tracking-widest"
            >
              Сохранить в БД и отправить на защиту
            </button>
          </div>
        </form>
      )}

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCat('all')}
          className={`px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider border ${
            filterCat === 'all' ? 'border-[#FFAA00] text-[#FFAA00]' : 'border-white/10 text-[#8A93A6]'
          }`}
        >
          Все проекты в БД ({projects.length})
        </button>
        {Object.entries(categories).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setFilterCat(k)}
            className={`px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider border ${
              filterCat === k ? 'border-[#00C853] text-[#34D399]' : 'border-white/10 text-[#8A93A6]'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Карточки проектов */}
      <div className="grid grid-cols-1 md:grid-cols-2 arch-grid">
        {visibleProjects.map((proj) => {
          const cat = categories[proj.category] || categories.reclamation;
          const hasVoted = votedIds.includes(proj.id);
          const authorAvatar = AVATAR_PRESETS.find((a) => a.id === proj.author_avatar) || AVATAR_PRESETS[0];

          return (
            <div key={proj.id} className="arch-card p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: cat.color }}>
                    ● {cat.label}
                  </span>
                  <span className="px-2.5 py-0.5 bg-[#00C853]/10 border border-[#00C853]/30 font-mono text-[10px] text-[#34D399]">
                    KPI: {proj.impact_metric}
                  </span>
                </div>

                <h3 className="text-lg font-medium text-white mb-2 leading-snug">{proj.title}</h3>
                {proj.problem_statement && (
                  <div className="text-[11px] font-mono text-[#FFAA00]/90 mb-2">
                    Проблема: {proj.problem_statement}
                  </div>
                )}
                <p className="text-xs text-[#8A93A6] font-light leading-relaxed mb-4">{proj.description}</p>

                {/* Список проголосовавших по @username */}
                {proj.voter_usernames && proj.voter_usernames.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[9px] text-[#4A5464] uppercase">Поддержали:</span>
                    {proj.voter_usernames.map((uname, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-white/[0.03] border border-white/10 font-mono text-[9px] text-[#FFAA00]"
                      >
                        {uname}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs border"
                    style={{ backgroundColor: authorAvatar.bg, borderColor: authorAvatar.color }}
                  >
                    {authorAvatar.icon}
                  </div>
                  <div>
                    <div className="font-mono text-[10px] font-semibold text-[#FFAA00]">
                      {proj.author_username || '@pestrikov_kv'}
                    </div>
                    <div className="text-[10px] text-[#8A93A6]">{proj.author_name}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onNavigateDefense && (
                    <button
                      onClick={onNavigateDefense}
                      className="px-3 py-1.5 border border-white/10 hover:border-[#22D3EE] font-mono text-[10px] uppercase text-[#22D3EE]"
                    >
                      Зал защиты →
                    </button>
                  )}

                  <button
                    onClick={() => handleVote(proj.id)}
                    className={`px-3.5 py-1.5 border font-mono text-xs flex items-center gap-2 transition-all ${
                      hasVoted
                        ? 'border-[#00C853] bg-[#00C853]/20 text-[#34D399]'
                        : 'border-white/15 hover:border-[#FFAA00] text-white'
                    }`}
                  >
                    <span>{hasVoted ? '✓ Ваш голос' : '▲ Голосовать'}</span>
                    <span className="font-bold">{proj.votes_count || 0}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}