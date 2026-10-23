import React from 'react';

const TREE_STAGES = [
  { level: 1, name: 'Сеянец кедра', minXp: 0, desc: 'Базовый допуск к экологическому модулю ХМАО' },
  { level: 2, name: 'Молодой побег', minXp: 100, desc: 'Изучены нормативы ПДК и утилизации ПНГ' },
  { level: 3, name: 'Кедровая крона', minXp: 200, desc: 'Проведён аудит выбросов CO₂ промысла' },
  { level: 4, name: 'Страж тайги Югры', minXp: 300, desc: 'Выполнен полный цикл биорекультивации земель' },
  { level: 5, name: 'Эко-инженер будущего', minXp: 400, desc: 'Защищён проект в мастерской «Зелёный след»' }
];

export default function AchievementTree({ user, onActionClick, showCertModal, setShowCertModal }) {
  const currentLevel = user?.tree_level || 1;
  const points = user?.green_points || 0;
  const nextTarget = currentLevel * 100;
  const progressPercent = Math.min(100, Math.round(((points % 100) / 100) * 100));

  return (
    <div className="border border-white/[0.05] bg-[#050810]">
      <div className="p-6 sm:px-8 border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="eyebrow eyebrow-emerald mb-2">Геймификация и верификация знаний</div>
          <h3 className="text-2xl sm:text-3xl font-extralight text-white tracking-tight">
            Дерево достижений и <strong className="font-semibold text-[#34D399]">Цифровой сертификат</strong>
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onActionClick('extended')}
            className="px-4 py-2 border border-white/10 hover:border-[#FFAA00] font-mono text-[10px] uppercase tracking-[0.2em] text-[#8A93A6] hover:text-[#FFAA00] transition-all"
          >
            Рейтинг школ ХМАО →
          </button>
          <button
            onClick={() => setShowCertModal && setShowCertModal(true)}
            className="px-4 py-2 bg-[#FFAA00] hover:bg-[#FFC857] text-[#050810] font-mono text-[10px] font-semibold uppercase tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(255,170,0,0.25)]"
          >
            ★ Открыть сертификат
          </button>
        </div>
      </div>

      <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* SVG Сибирский кедр */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 border border-white/[0.05] bg-[#08090f] relative">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FFAA00] mb-2">
            РАНГ 0{currentLevel} / 05 · {TREE_STAGES[currentLevel - 1]?.name}
          </div>

          <svg className="w-48 h-48 my-2" viewBox="0 0 200 200">
            <defs>
              <radialGradient id="treeGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00C853" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#00C853" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="100" cy="100" r="85" fill="url(#treeGlow)" />
            <circle cx="100" cy="100" r="82" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
            <circle
              cx="100"
              cy="100"
              r="82"
              fill="none"
              stroke="#00C853"
              strokeWidth="3"
              strokeDasharray="515"
              strokeDashoffset={515 - (515 * Math.min(100, (points / 500) * 100)) / 100}
              strokeLinecap="round"
              transform="rotate(-90 100 100)"
            />

            <path d="M70 165 Q100 155 130 165" stroke="#FFAA00" strokeWidth="2" fill="none" opacity="0.6" />
            <line x1="100" y1="160" x2="100" y2={150 - currentLevel * 18} stroke="#FFAA00" strokeWidth="4" strokeLinecap="round" />

            {currentLevel >= 1 && (
              <polygon points="100,115 72,145 128,145" fill="rgba(0,200,83,0.22)" stroke="#00C853" strokeWidth="1.6" />
            )}
            {currentLevel >= 2 && (
              <polygon points="100,92 66,126 134,126" fill="rgba(0,200,83,0.32)" stroke="#00C853" strokeWidth="1.6" />
            )}
            {currentLevel >= 3 && (
              <polygon points="100,68 62,106 138,106" fill="rgba(0,200,83,0.45)" stroke="#00C853" strokeWidth="1.6" />
            )}
            {currentLevel >= 4 && (
              <polygon points="100,46 70,84 130,84" fill="rgba(0,200,83,0.6)" stroke="#34D399" strokeWidth="1.6" />
            )}
            {currentLevel >= 5 && (
              <>
                <polygon points="100,28 80,60 120,60" fill="#00C853" stroke="#FFAA00" strokeWidth="2" />
                <circle cx="100" cy="24" r="4" fill="#FFAA00" />
              </>
            )}
          </svg>

          <div className="font-mono text-xs text-white">
            {points} XP <span className="text-[#8A93A6]">/ {nextTarget} XP до след. ранга</span>
          </div>
          <div className="w-full bg-white/5 h-1.5 mt-2 overflow-hidden">
            <div className="h-full bg-[#00C853] transition-all duration-700" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* 5 ступеней эволюции */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-5 arch-grid">
            {TREE_STAGES.map((st) => {
              const unlocked = currentLevel >= st.level;
              return (
                <div
                  key={st.level}
                  className={`arch-card p-4 flex flex-col justify-between ${
                    unlocked ? 'text-[#34D399]' : 'text-[#4A5464]'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[9px] mb-3">
                    <span>LVL 0{st.level}</span>
                    <span>{unlocked ? '● АКТИВЕН' : `${st.minXp} XP`}</span>
                  </div>
                  <div>
                    <div className={`text-xs font-medium mb-1 ${unlocked ? 'text-white' : 'text-[#8A93A6]'}`}>
                      {st.name}
                    </div>
                    <p className="text-[11px] text-[#8A93A6] font-light leading-snug">{st.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-5 border border-white/[0.05] bg-[#08090f] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FFAA00]">
                Практические модули для повышения ранга
              </div>
              <p className="text-xs font-light text-[#8A93A6] mt-1">
                Все выполненные действия автоматически сохраняются и повышают уровень вашего кедра.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                onClick={() => onActionClick('simulator')}
                className="px-3.5 py-2 border border-[#00C853]/40 bg-[#00C853]/10 hover:bg-[#00C853]/20 font-mono text-[10px] uppercase tracking-wider text-[#34D399]"
              >
                +100 XP Рекультивация
              </button>
              <button
                onClick={() => onActionClick('calculator')}
                className="px-3.5 py-2 border border-[#FFAA00]/40 bg-[#FFAA00]/10 hover:bg-[#FFAA00]/20 font-mono text-[10px] uppercase tracking-wider text-[#FFAA00]"
              >
                +50 XP Аудит CO₂
              </button>
              <button
                onClick={() => onActionClick('workshop')}
                className="px-3.5 py-2 border border-[#22D3EE]/40 bg-[#22D3EE]/10 hover:bg-[#22D3EE]/20 font-mono text-[10px] uppercase tracking-wider text-[#22D3EE]"
              >
                +75 XP Эко-проект
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО ИМЕННОГО СЕРТИФИКАТА */}
      {showCertModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
          <div className="relative w-full max-w-2xl bg-[#050810] border-2 border-[#FFAA00]/60 p-8 sm:p-12 shadow-[0_0_80px_rgba(255,170,0,0.2)]">
            <button
              onClick={() => setShowCertModal(false)}
              className="absolute top-5 right-5 font-mono text-xs text-[#8A93A6] hover:text-white"
            >
              [ЗАКРЫТЬ ✕]
            </button>

            <div className="border border-white/10 p-6 sm:p-8 relative">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <div>
                  <div className="text-xs font-light tracking-[0.38em] text-white uppercase">
                    ЮГРА<span className="text-[#FFAA00]">.</span><strong className="font-semibold text-[#FFAA00]">НЕФТЬ</strong>
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#34D399] mt-1">
                    Музей нефти им. Р. И. Кузоваткина · МБОУ «СОШ №1» пгт. Пойковский
                  </div>
                </div>
                <div className="font-mono text-[10px] text-right text-[#8A93A6]">
                  СЕРТИФИКАТ № UGRA-2026-0{user?.tree_level || 1}
                  <br />
                  ХМАО — ЮГРА
                </div>
              </div>

              <div className="text-center space-y-3 my-8">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFAA00]">
                  Именной сертификат экологических компетенций
                </div>
                <div className="text-xs text-[#8A93A6]">Подтверждает, что исследователь</div>
                <div className="text-2xl sm:text-3xl font-extralight text-white tracking-tight border-b border-[#00C853]/50 inline-block px-6 pb-2">
                  {user?.full_name || 'Пестриков Кирилл Валерьевич'}
                </div>
                <div className="text-xs font-light text-[#8A93A6] max-w-md mx-auto leading-relaxed pt-2">
                  успешно прошёл подготовку в модуле <strong>«Зелёная Югра»</strong> (расчёт углеродного следа, рекультивация нарушенных таёжных земель, IoT-мониторинг ПДК рабочей зоны) с присвоением квалификации:
                </div>
                <div className="font-mono text-sm uppercase tracking-widest text-[#34D399] pt-1">
                  «{TREE_STAGES[(user?.tree_level || 1) - 1]?.name}» ({user?.green_points || 0} XP · {user?.neftcoins || 0} NEFTCOIN)
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/10 text-[11px] font-mono text-[#8A93A6]">
                <div>
                  Научный руководитель: <span className="text-white">А. В. Рахманов</span>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-5 py-2 bg-[#FFAA00] hover:bg-[#FFC857] text-[#050810] font-semibold uppercase tracking-widest text-[10px]"
                >
                  Печать / Сохранить PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}