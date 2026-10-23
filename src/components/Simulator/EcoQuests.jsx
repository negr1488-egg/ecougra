import React, { useState } from 'react';
import { ECO_QUESTS, DEBATE_CASES } from '../../data/questsData';
import { api } from '../../lib/supabaseClient';

export default function EcoQuests({ user, onComplete }) {
  const [subMode, setSubMode] = useState('quiz'); // 'quiz' | 'debate'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hiddenOptions, setHiddenOptions] = useState([]);
  const [fiftyUsed, setFiftyUsed] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Дебаты
  const [votes, setVotes] = useState({ 'deb-1': { pro: 42, con: 19 }, 'deb-2': { pro: 38, con: 27 } });
  const [userVoted, setUserVoted] = useState({});

  const quest = ECO_QUESTS[currentIndex];

  const handleUseFifty = () => {
    if (fiftyUsed || isAnswered) return;
    const wrongIndices = quest.options
      .map((_, i) => i)
      .filter((i) => i !== quest.correct);
    setHiddenOptions(wrongIndices.slice(0, 2));
    setFiftyUsed(true);
  };

  const handleSelect = (idx) => {
    if (isAnswered || hiddenOptions.includes(idx)) return;
    setSelectedOption(idx);
    setIsAnswered(true);

    if (idx === quest.correct) {
      const bonus = streak >= 2 ? 15 : 10;
      setScore((prev) => prev + bonus);
      setStreak((prev) => prev + 1);
    } else {
      setStreak(0);
    }
  };

  const handleNext = async () => {
    if (currentIndex < ECO_QUESTS.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setHiddenOptions([]);
    } else {
      setIsFinished(true);
      await api.saveTestResult({
        user_id: user?.id || 'demo-user',
        activity_type: 'quest',
        score,
        max_score: 100,
        passed: score >= 70,
        badge: 'Эксперт эко-нормативов'
      });
      if (onComplete) onComplete(score);
    }
  };

  const restartQuiz = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setStreak(0);
    setHiddenOptions([]);
    setFiftyUsed(false);
    setIsFinished(false);
  };

  const handleVoteDebate = async (debateId, side) => {
    if (userVoted[debateId]) return;
    setVotes((prev) => ({
      ...prev,
      [debateId]: {
        ...prev[debateId],
        [side]: prev[debateId][side] + 1
      }
    }));
    setUserVoted((prev) => ({ ...prev, [debateId]: side }));
    await api.addRewards(25, 50, 'Спикер Дебат-клуба');
    if (onComplete) onComplete(25);
  };

  return (
    <div className="space-y-6">
      {/* Переключатель: Эко-квесты / Дебат-клуб */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSubMode('quiz')}
            className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest border transition-all ${
              subMode === 'quiz'
                ? 'border-[#00C853] bg-[#00C853]/15 text-[#00C853]'
                : 'border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            01 / Сертификационный тест (10 вопросов, порог 70%)
          </button>
          <button
            onClick={() => setSubMode('debate')}
            className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest border transition-all ${
              subMode === 'debate'
                ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00]'
                : 'border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            02 / Эко-дебат клуб (Инженерные кейсы)
          </button>
        </div>

        {subMode === 'quiz' && (
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-zinc-400">
              Серия: <strong className="text-[#FFAA00]">🔥 x{streak}</strong>
            </span>
            <span className="text-zinc-400">
              Баллы: <strong className="text-[#00C853]">{score} XP</strong>
            </span>
          </div>
        )}
      </div>

      {subMode === 'quiz' ? (
        <div className="border border-white/[0.06] bg-[#050810] p-7 sm:p-9">
          {!isFinished ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#FFAA00]">
                    ВОПРОС 0{currentIndex + 1} / {ECO_QUESTS.length} · {quest.category}
                  </span>
                  <h3 className="text-xl font-light text-white mt-1">{quest.title}</h3>
                </div>

                <button
                  onClick={handleUseFifty}
                  disabled={fiftyUsed || isAnswered}
                  className="px-3.5 py-1.5 border border-[#22D3EE]/40 text-[#22D3EE] disabled:opacity-30 font-mono text-[10px] uppercase tracking-widest self-start"
                >
                  {fiftyUsed ? 'Подсказка 50/50 исп.' : 'Подсказка 50/50'}
                </button>
              </div>

              <div className="text-base text-zinc-100 leading-relaxed border-l-2 border-[#00C853] pl-4 py-1">
                {quest.question}
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {quest.options.map((opt, idx) => {
                  if (hiddenOptions.includes(idx)) {
                    return (
                      <div
                        key={idx}
                        className="p-4 border border-white/5 bg-white/[0.01] text-zinc-700 font-mono text-xs line-through"
                      >
                        Вариант исключён системой помощи
                      </div>
                    );
                  }

                  let style = 'border-white/10 bg-[#080c17] text-zinc-200 hover:border-[#FFAA00]/60';
                  if (isAnswered) {
                    if (idx === quest.correct) {
                      style = 'border-[#00C853] bg-[#00C853]/15 text-white';
                    } else if (idx === selectedOption) {
                      style = 'border-red-500/60 bg-red-500/10 text-red-300';
                    } else {
                      style = 'border-white/5 bg-[#050810] text-zinc-600';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelect(idx)}
                      className={`p-4 border text-left text-sm flex items-center justify-between transition-all ${style}`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="w-6 h-6 border border-white/15 flex items-center justify-center font-mono text-xs text-[#FFAA00]">
                          0{idx + 1}
                        </span>
                        <span>{opt}</span>
                      </div>
                      {isAnswered && idx === quest.correct && (
                        <span className="font-mono text-[10px] uppercase text-[#00C853]">✓ Норматив верен</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <div className="p-4 border border-[#FFAA00]/30 bg-[#FFAA00]/5 text-xs text-zinc-200 leading-relaxed">
                  <strong className="font-mono text-[#FFAA00] uppercase block mb-1">
                    Нормативно-техническая справка:
                  </strong>
                  {quest.explanation}
                </div>
              )}

              {isAnswered && (
                <div className="flex justify-end">
                  <button
                    onClick={handleNext}
                    className="px-6 py-3 bg-[#00C853] hover:bg-[#00e65f] text-[#050810] font-mono text-xs font-semibold uppercase tracking-widest"
                  >
                    {currentIndex === ECO_QUESTS.length - 1 ? 'Завершить аттестацию →' : 'Следующий вопрос →'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="eyebrow justify-center">Аттестация завершена</div>
              <div className="text-4xl font-extralight text-white">
                Набрано <strong className="text-[#00C853]">{score} XP</strong>
              </div>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {score >= 70
                  ? 'Порог 70% успешно преодолён! Сертификат экологической грамотности обновлён в вашем профиле.'
                  : 'Для получения знака отличия рекомендуется набрать не менее 70 баллов.'}
              </p>
              <button
                onClick={restartQuiz}
                className="px-6 py-2.5 border border-[#FFAA00] text-[#FFAA00] font-mono text-xs uppercase tracking-widest"
              >
                Пройти повторно
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ДЕБАТ-КЛУБ */
        <div className="space-y-6">
          {DEBATE_CASES.map((d) => {
            const v = votes[d.id];
            const total = v.pro + v.con;
            const proPct = Math.round((v.pro / total) * 100);
            const conPct = 100 - proPct;

            return (
              <div key={d.id} className="border border-white/[0.06] bg-[#050810] p-7 space-y-5">
                <div>
                  <div className="eyebrow mb-1">Дискуссионный кейс ХМАО</div>
                  <h3 className="text-xl font-medium text-white">{d.title}</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{d.context}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 arch-grid">
                  <div className="arch-card p-5 space-y-3">
                    <div className="font-mono text-xs text-[#00C853] uppercase">Позиция А · {d.proTitle}</div>
                    <ul className="space-y-2 text-xs text-zinc-300">
                      {d.proArgs.map((a, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-[#00C853]">+</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleVoteDebate(d.id, 'pro')}
                      disabled={Boolean(userVoted[d.id])}
                      className="w-full py-2.5 border border-[#00C853]/50 hover:bg-[#00C853]/15 font-mono text-[10px] uppercase tracking-widest text-[#00C853]"
                    >
                      Поддержать позицию А ({proPct}% · {v.pro} гол.)
                    </button>
                  </div>

                  <div className="arch-card p-5 space-y-3">
                    <div className="font-mono text-xs text-[#FFAA00] uppercase">Позиция Б · {d.conTitle}</div>
                    <ul className="space-y-2 text-xs text-zinc-300">
                      {d.conArgs.map((a, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-[#FFAA00]">+</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleVoteDebate(d.id, 'con')}
                      disabled={Boolean(userVoted[d.id])}
                      className="w-full py-2.5 border border-[#FFAA00]/50 hover:bg-[#FFAA00]/15 font-mono text-[10px] uppercase tracking-widest text-[#FFAA00]"
                    >
                      Поддержать позицию Б ({conPct}% · {v.con} гол.)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}