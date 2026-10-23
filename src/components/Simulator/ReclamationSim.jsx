import React, { useState } from 'react';
import { api } from '../../lib/supabaseClient';

const RECLAMATION_STEPS = [
  {
    step: 1,
    code: 'ЭТАП 01 / ТЕХНИЧЕСКАЯ ОЧИСТКА',
    title: 'Локализация и сбор остаточных нефтепродуктов',
    desc: 'После завершения буровых работ на участке остались нефтешламы и уплотнённый техногенный грунт. Выберите метод первичной очистки:',
    choices: [
      { label: 'Вакуумный сбор + выемка в герметичный шламонакопитель и промывка сорбентом', ecoBonus: 22, cost: 350, comment: 'Оптимально: исключает попадание углеводородов в грунтовые воды.' },
      { label: 'Выжигание остатков нефти на месте открытым способом', ecoBonus: -15, cost: 80, comment: 'Грубое нарушение: выброс канцерогенной сажи и разрушение органики почвы.' }
    ]
  },
  {
    step: 2,
    code: 'ЭТАП 02 / ИНЖЕНЕРНАЯ ПЛАНИРОВКА',
    title: 'Выравнивание рельефа и восстановление гидрологии',
    desc: 'Необходимо ликвидировать обваловку, засыпать траншеи и восстановить естественный сток талых вод.',
    choices: [
      { label: 'Лазерная планировка бульдозерами на болотных гусеницах + глиняный замок', ecoBonus: 20, cost: 280, comment: 'Предотвращает заболачивание и эрозию торфяного горизонта.' },
      { label: 'Поверхностная засыпка строительным песком без дренажа', ecoBonus: 5, cost: 120, comment: 'Низкая эффективность: возможен застой верховодки.' }
    ]
  },
  {
    step: 3,
    code: 'ЭТАП 03 / БИОРЕМЕДИАЦИЯ И ТОРФОВАНИЕ',
    title: 'Нанесение плодородного слоя и штаммов-деструкторов',
    desc: 'Внесение нейтрализованного верхового торфа ХМАО и аборигенных нефтеокисляющих микроорганизмов.',
    choices: [
      { label: 'Торфо-сапропелевая смесь + криофильный биопрепарат «Родотрин» и доломитовая мука', ecoBonus: 25, cost: 420, comment: 'Нормализует pH до 6.4 и ускоряет распад остаточных УВ в 6 раз.' },
      { label: 'Обычный речной намывной песок с минеральной селитрой', ecoBonus: 8, cost: 150, comment: 'Недостаточно гумуса для субарктической зоны.' }
    ]
  },
  {
    step: 4,
    code: 'ЭТАП 04 / ФИТОМЕЛИОРАЦИЯ',
    title: 'Гидропосев многолетних злаково-бобовых трав',
    desc: 'Формирование плотной дернины для закрепления грунта и запуска почвенного микробиома.',
    choices: [
      { label: 'Гидропосев с мульчей: овсяница красная, тимофеевка луговая и клевер ползучий', ecoBonus: 18, cost: 240, comment: 'Бобовые фиксируют атмосферный азот, укрепляя корнеобитаемый слой.' },
      { label: 'Ручной разброс семян однолетних газонных трав', ecoBonus: 6, cost: 90, comment: 'Однолетники вымерзают первой зимой в ХМАО.' }
    ]
  },
  {
    step: 5,
    code: 'ЭТАП 05 / ЛЕСОВОССТАНОВЛЕНИЕ И МОНИТОРИНГ',
    title: 'Высадка хвойных пород и спутниковый контроль NDVI',
    desc: 'Финальный этап: возвращение участка в лесной фонд Югры.',
    choices: [
      { label: 'Высадка 2-летних сеянцев сибирского кедра и сосны с закрытой корневой системой (ЗКС) + датчики почвы', ecoBonus: 25, cost: 480, comment: 'Приживаемость сеянцев ЗКС в условиях Югры достигает 96%!' },
      { label: 'Самосев от соседнего массива леса без посадок', ecoBonus: 4, cost: 0, comment: 'Естественное зарастание займёт более 35 лет.' }
    ]
  }
];

export default function ReclamationSim({ user, onComplete }) {
  const [mode, setMode] = useState('reclamation'); // 'reclamation' | 'enterprise'
  const [stepIdx, setStepIdx] = useState(0);
  const [ecoHealth, setEcoHealth] = useState(15);
  const [spentBudget, setSpentBudget] = useState(0);
  const [lastFeedback, setLastFeedback] = useState(null);
  const [finished, setFinished] = useState(false);

  // Состояние симулятора управления предприятием (enterprise.html)
  const [quarter, setQuarter] = useState(1);
  const [entState, setEntState] = useState({
    budgetMln: 120,
    esgScore: 72,
    apgUtil: 92.5,
    co2Quota: 100
  });

  const handleChoice = async (choice) => {
    const nextHealth = Math.min(100, Math.max(0, ecoHealth + choice.ecoBonus));
    setEcoHealth(nextHealth);
    setSpentBudget((prev) => prev + choice.cost);
    setLastFeedback(choice.comment);

    if (stepIdx < RECLAMATION_STEPS.length - 1) {
      setStepIdx((prev) => prev + 1);
    } else {
      setFinished(true);
      await api.saveTestResult({
        user_id: user?.id || 'demo',
        activity_type: 'reclamation_simulator',
        score: 100,
        max_score: 100,
        passed: true,
        badge: 'Инженер рекультивации'
      });
      if (onComplete) onComplete(100);
    }
  };

  const resetReclamation = () => {
    setStepIdx(0);
    setEcoHealth(15);
    setSpentBudget(0);
    setLastFeedback(null);
    setFinished(false);
  };

  const applyEnterpriseDecision = async (action) => {
    const nextQ = quarter + 1;
    setQuarter(nextQ);
    setEntState((prev) => ({
      budgetMln: prev.budgetMln + action.budgetDelta,
      esgScore: Math.min(100, prev.esgScore + action.esgDelta),
      apgUtil: Math.min(99.5, Number((prev.apgUtil + action.apgDelta).toFixed(1))),
      co2Quota: Math.max(0, prev.co2Quota + action.co2Delta)
    }));
    if (nextQ > 4 && onComplete) {
      await api.addRewards(80, 200, 'Директор по устойчивому развитию');
      onComplete(80);
    }
  };

  return (
    <div className="space-y-6">
      {/* Переключатель между Симулятором рекультивации и Симулятором предприятия */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('reclamation')}
            className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest border transition-all ${
              mode === 'reclamation'
                ? 'border-[#00C853] bg-[#00C853]/15 text-[#00C853]'
                : 'border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            01 / Симулятор рекультивации (5 шагов)
          </button>
          <button
            onClick={() => setMode('enterprise')}
            className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest border transition-all ${
              mode === 'enterprise'
                ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00]'
                : 'border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            02 / Управление эко-предприятием (ESG-стратегия)
          </button>
        </div>

        <div className="font-mono text-xs text-zinc-400">
          Индекс здоровья биоценоза: <strong className="text-[#00C853]">{ecoHealth}%</strong> · Инвестиции: <strong className="text-[#FFAA00]">{spentBudget} тыс. ₽</strong>
        </div>
      </div>

      {mode === 'reclamation' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 arch-grid">
          {/* Визуальный разрез участка тайги */}
          <div className="lg:col-span-5 arch-card p-7 flex flex-col justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#00C853] mb-2">
                Цифровой двойник участка рекультивации
              </div>
              <h3 className="text-lg font-medium text-white">Кустовая площадка №14 · Юганское Приобье</h3>
            </div>

            <div className="my-6 p-6 border border-white/[0.06] bg-[#070b15] relative overflow-hidden">
              <svg className="w-full h-44" viewBox="0 0 320 150">
                {/* Небо и солнце */}
                <circle cx="275" cy="30" r="14" fill="#FFAA00" opacity={0.3 + ecoHealth / 150} />
                {/* Рельеф почвы, меняющий цвет от бурого шламового до изумрудного */}
                <path
                  d="M0 115 Q80 95 160 110 T320 105 L320 150 L0 150 Z"
                  fill={ecoHealth < 40 ? '#2b1d14' : ecoHealth < 75 ? '#1b3b2b' : '#0b4f30'}
                />
                {/* Пятна нефти на ранних шагах */}
                {stepIdx < 2 && (
                  <ellipse cx="130" cy="118" rx="45" ry="8" fill="#09090d" stroke="#FFAA00" strokeDasharray="3 3" />
                )}
                {/* Травяной покров на шаге 4+ */}
                {stepIdx >= 3 && (
                  <path d="M10 112 L310 106" stroke="#00C853" strokeWidth="4" strokeDasharray="4 6" />
                )}
                {/* Деревья (кедры и сосны) на финальном этапе */}
                {(stepIdx >= 4 || finished) &&
                  [45, 95, 155, 210, 265].map((x, idx) => (
                    <g key={idx} transform={`translate(${x}, 68)`}>
                      <line x1="0" y1="22" x2="0" y2="42" stroke="#FFAA00" strokeWidth="2.5" />
                      <polygon points="0,0 -14,26 14,26" fill="#00C853" opacity="0.85" />
                      <polygon points="0,-10 -10,12 10,12" fill="#34D399" />
                    </g>
                  ))}
              </svg>

              <div className="flex justify-between font-mono text-[10px] text-zinc-400 pt-3 border-t border-white/5">
                <span>КИСЛОТНОСТЬ: pH {(5.1 + ecoHealth * 0.014).toFixed(1)}</span>
                <span>NDVI ИНДЕКС: {(0.12 + ecoHealth * 0.007).toFixed(2)}</span>
              </div>
            </div>

            {/* Прогресс 5 шагов */}
            <div className="grid grid-cols-5 gap-1.5">
              {RECLAMATION_STEPS.map((s, i) => (
                <div
                  key={s.step}
                  className={`h-1.5 transition-all ${
                    i < stepIdx || finished
                      ? 'bg-[#00C853] shadow-[0_0_8px_#00C853]'
                      : i === stepIdx
                      ? 'bg-[#FFAA00]'
                      : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Панель принятия инженерных решений */}
          <div className="lg:col-span-7 arch-card p-7 flex flex-col justify-between">
            {!finished ? (
              <div className="space-y-6">
                <div>
                  <div className="font-mono text-xs text-[#FFAA00] uppercase tracking-widest">
                    {RECLAMATION_STEPS[stepIdx].code}
                  </div>
                  <h3 className="text-2xl font-light text-white mt-1">
                    {RECLAMATION_STEPS[stepIdx].title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    {RECLAMATION_STEPS[stepIdx].desc}
                  </p>
                </div>

                <div className="space-y-3">
                  {RECLAMATION_STEPS[stepIdx].choices.map((c, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleChoice(c)}
                      className="w-full p-5 text-left border border-white/10 bg-[#080c17] hover:border-[#00C853] transition-all group"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500 mb-1.5">
                        <span className="group-hover:text-[#00C853]">ТЕХНОЛОГИЧЕСКОЕ РЕШЕНИЕ 0{idx + 1}</span>
                        <span className="text-[#FFAA00]">БЮДЖЕТ: {c.cost} тыс. ₽</span>
                      </div>
                      <div className="text-sm font-medium text-white group-hover:text-[#00C853] transition-colors">
                        {c.label}
                      </div>
                    </button>
                  ))}
                </div>

                {lastFeedback && (
                  <div className="p-3.5 border border-white/10 bg-white/[0.02] font-mono text-xs text-zinc-300">
                    <span className="text-[#FFAA00]">Вердикт эко-инспекции:</span> {lastFeedback}
                  </div>
                )}
              </div>
            ) : (
              <div className="my-auto text-center space-y-4 py-8">
                <div className="eyebrow eyebrow-emerald justify-center">Цикл рекультивации завершён</div>
                <h3 className="text-3xl font-extralight text-white">
                  Участок сдан комиссии Природнадзора Югры!
                </h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                  Итоговый индекс восстановления экосистемы составил <strong>{ecoHealth}%</strong>. В профиль начислено <strong>+100 XP</strong>, <strong>+150 NEFTCOIN</strong> и открыт знак отличия «Инженер рекультивации».
                </p>
                <button
                  onClick={resetReclamation}
                  className="px-6 py-3 border border-[#FFAA00] text-[#FFAA00] hover:bg-[#FFAA00] hover:text-[#050810] font-mono text-xs uppercase tracking-widest transition-all"
                >
                  Запустить новый полигон
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* СИМУЛЯТОР УПРАВЛЕНИЯ ЭКО-ПРЕДПРИЯТИЕМ */
        <div className="border border-white/[0.06] bg-[#050810] p-7 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="eyebrow mb-1">Экономико-экологический тренажёр</div>
              <h3 className="text-2xl font-light text-white">
                Управление нефтегазовым предприятием · Квартал {Math.min(4, quarter)} из 4
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <div className="px-3 py-2 border border-white/10 bg-[#080c17]">
                Бюджет: <strong className="text-[#FFAA00]">{entState.budgetMln} млн ₽</strong>
              </div>
              <div className="px-3 py-2 border border-white/10 bg-[#080c17]">
                ESG-Рейтинг: <strong className="text-[#00C853]">{entState.esgScore}/100</strong>
              </div>
              <div className="px-3 py-2 border border-white/10 bg-[#080c17]">
                ПНГ: <strong className="text-[#22D3EE]">{entState.apgUtil}%</strong>
              </div>
            </div>
          </div>

          {quarter <= 4 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 arch-grid">
              {[
                {
                  title: 'Модернизация компрессорной станции ПНГ',
                  desc: 'Инвестировать 25 млн ₽ в строительство дожимной компрессорной станции для сдачи газа на Южно-Балыкский ГПЗ.',
                  budgetDelta: -25,
                  esgDelta: 12,
                  apgDelta: 2.5,
                  co2Delta: -20
                },
                {
                  title: 'Внедрение системы «Умная каска» на всех кустах',
                  desc: 'Оснастить 150 буровиков IoT-касками с газоанализаторами MQ-4/MQ-7 и сетью LoRaWAN.',
                  budgetDelta: -12,
                  esgDelta: 9,
                  apgDelta: 0.8,
                  co2Delta: -8
                },
                {
                  title: 'Форсированная добыча без эко-модернизации',
                  desc: 'Увеличить дебит скважин на старом оборудовании (+35 млн ₽ выручки, но рост штрафов за ПНГ).',
                  budgetDelta: 35,
                  esgDelta: -14,
                  apgDelta: -2.0,
                  co2Delta: 25
                }
              ].map((act, i) => (
                <div key={i} className="arch-card p-6 flex flex-col justify-between">
                  <div>
                    <div className="font-mono text-[10px] text-[#FFAA00] uppercase mb-2">Стратегия 0{i + 1}</div>
                    <h4 className="text-base font-medium text-white mb-2">{act.title}</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-6">{act.desc}</p>
                  </div>
                  <button
                    onClick={() => applyEnterpriseDecision(act)}
                    className="w-full py-2.5 border border-white/15 hover:border-[#00C853] hover:text-[#00C853] font-mono text-[10px] uppercase tracking-widest transition-all"
                  >
                    Утвердить решение →
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 border border-[#00C853]/40 bg-[#00C853]/5 text-center space-y-3">
              <div className="font-mono text-xs uppercase text-[#00C853]">Годовой отчёт устойчивого развития утверждён</div>
              <div className="text-2xl font-light text-white">
                Итоговый ESG-индекс предприятия: {entState.esgScore} баллов · Утилизация ПНГ: {entState.apgUtil}%
              </div>
              <button
                onClick={() => {
                  setQuarter(1);
                  setEntState({ budgetMln: 120, esgScore: 72, apgUtil: 92.5, co2Quota: 100 });
                }}
                className="px-5 py-2 bg-[#FFAA00] text-[#050810] font-mono text-xs font-semibold uppercase tracking-widest"
              >
                Новый финансовый год
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}