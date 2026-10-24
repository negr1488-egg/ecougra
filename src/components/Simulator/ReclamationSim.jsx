import React, { useState } from 'react';
import { supabase, logActivityAndAwardXp } from '../../lib/supabaseClient';
import { Card, Button, Badge, useToast } from '../ui/DesignSystem';
import { Shovel, Tractor, Sprout, TreePine, Volume2, VolumeX, Share2, RotateCcw, FastForward } from 'lucide-react';

const STEPS = [
  {
    step: 1,
    title: 'Снять загрязнённый и сохранить плодородный слой',
    question: 'На участке произошёл разлив. Что делаем в первую очередь, чтобы спасти землю?',
    icon: Shovel,
    fact: 'Знаете ли вы? Всего 1 литр разлитой нефти может лишить кислорода до 40 тысяч литров грунтовых вод.',
    options: [
      {
        label: '🚜 Собрать нефть и аккуратно снять верхний слой почвы',
        isCorrect: true,
        feedback: '✅ Верно! Сначала убираем нефть скиммерами и спасаем верхний слой земли, чтобы грязь не ушла вглубь.'
      },
      {
        label: '🔥 Сразу поджечь разлившуюся нефть на земле',
        isCorrect: false,
        feedback: '❌ Неверно. Огонь уничтожит живые бактерии в почве и оставит токсичную корку.'
      },
      {
        label: '💧 Залить участок обычной водой из реки',
        isCorrect: false,
        feedback: '❌ Неверно. Вода только разнесёт нефтяное пятно на соседние участки леса.'
      }
    ]
  },
  {
    step: 2,
    title: 'Выровнять участок и взрыхлить землю',
    question: 'Нефть убрана, но земля твёрдая и слежавшаяся. Как подготовить её для растений?',
    icon: Tractor,
    fact: 'Знаете ли вы? Торф впитывает нефть как губка и помогает полезным таёжным микробам дышать.',
    options: [
      {
        label: '🌱 Выровнять землю трактором, взрыхлить и добавить торф',
        isCorrect: true,
        feedback: '✅ Верно! Рыхлая земля с торфом даёт корням и полезным бактериям воздух для жизни.'
      },
      {
        label: '🧱 Засыпать участок бетоном и щебнем',
        isCorrect: false,
        feedback: '❌ Неверно. Под щебнем и бетоном лес никогда не сможет вырасти.'
      },
      {
        label: '❄️ Оставить всё как есть до следующей зимы',
        isCorrect: false,
        feedback: '❌ Неверно. Без рыхления дожди размоют почву и образуются овраги.'
      }
    ]
  },
  {
    step: 3,
    title: 'Посеять устойчивые многолетние травы',
    question: 'Почва готова и дышит! Чем засеять поле, чтобы укрепить землю в первый год?',
    icon: Sprout,
    fact: 'Знаете ли вы? Корни луговых трав образуют плотную сетку, которая держит грунт даже в сильный паводок.',
    options: [
      {
        label: '🌾 Посеять северные луговые травы (овсяницу и тимофеевку)',
        isCorrect: true,
        feedback: '✅ Верно! Эти травы не боятся морозов Югры и быстро создают зелёный ковёр.'
      },
      {
        label: '🌴 Посадить тропические цветы и пальмы',
        isCorrect: false,
        feedback: '❌ Неверно. Южные растения погибнут при первых же заморозках в ХМАО.'
      },
      {
        label: '🏜️ Ничего не сеять — само зарастёт через 20 лет',
        isCorrect: false,
        feedback: '❌ Неверно. Без травы ветер и вода быстро разрушат подготовленный слой почвы.'
      }
    ]
  },
  {
    step: 4,
    title: 'Высадить молодые сибирские кедры и сосны',
    question: 'Трава укрепила землю! Какой финальный шаг вернёт сюда настоящую тайгу?',
    icon: TreePine,
    fact: 'Знаете ли вы? В Югре действует правило «1 к 1»: за каждый гектар рубки нефтяники высаживают гектар нового леса.',
    options: [
      {
        label: '🌲 Высадить саженцы сибирского кедра и сосны с комом земли',
        isCorrect: true,
        feedback: '✅ Верно! Саженцы с закрытыми корнями приживаются почти на 95% и возвращают зверям и птицам дом.'
      },
      {
        label: '🪓 Вырубить деревья вокруг участка',
        isCorrect: false,
        feedback: '❌ Неверно. Наша задача — восстановить лес, а не уменьшить его.'
      },
      {
        label: '🌵 Посадить искусственные пластиковые деревья',
        isCorrect: false,
        feedback: '❌ Неверно. Природе нужны живые деревья, которые дают кислород и шишки.'
      }
    ]
  }
];

export default function ReclamationSim({ user, onComplete }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const [finished, setFinished] = useState(false);
  const { toast } = useToast();

  const playFeedbackEffect = (isCorrect) => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(isCorrect ? [40] : [80, 40, 80]);
      }
      if (!soundOn) return;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = isCorrect ? 660 : 220;
      gain.gain.value = 0.08;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore audio restrictions
    }
  };

  const handleSelectOption = (opt) => {
    setSelectedOpt(opt);
    playFeedbackEffect(opt.isCorrect);
  };

  const handleNext = async () => {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx((p) => p + 1);
      setSelectedOpt(null);
    } else {
      await finishSim();
    }
  };

  const finishSim = async () => {
    setFinished(true);
    if (user?.id) {
      await supabase.rpc('award_xp_secure', {
        p_action: 'reclamation_sim',
        p_entity: 'simulator',
        p_xp_delta: 80,
        p_badge: 'Мастер рекультивации'
      });
      await logActivityAndAwardXp(user.id, {
        action: 'completed_reclamation_sim',
        entity: 'simulator',
        xpDelta: 80,
        newBadge: 'Мастер рекультивации'
      });
    }
    toast('Симулятор пройден! Начислено +80 XP', 'success');
    if (onComplete) onComplete();
  };

  const handleShare = () => {
    const shareText = 'Я восстановил участок тайги за 4 шага в симуляторе «Зелёная Югра» и получил +80 XP! 🌲';
    navigator.clipboard?.writeText(shareText);
    toast('Результат скопирован в буфер обмена!', 'success');
  };

  if (finished) {
    return (
      <Card className="p-8 text-center space-y-6 max-w-2xl mx-auto border-[#00C853]/40">
        <div className="w-16 h-16 mx-auto rounded-full bg-[#00C853]/20 border border-[#00C853] flex items-center justify-center">
          <TreePine size={32} className="text-[#34D399]" />
        </div>
        <Badge color="gold">Награда получена: 🏆 Мастер рекультивации (+80 XP)</Badge>
        <h2 className="text-2xl sm:text-3xl font-light text-white">
          Участок тайги полностью восстановлен!
        </h2>
        <p className="text-sm text-zinc-300 max-w-md mx-auto leading-relaxed">
          Вы правильно провели все 4 этапа: убрали загрязнение, подготовили почву, посеяли травы и высадили молодой кедровый лес.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button variant="primary" onClick={handleShare}>
            <Share2 size={15} /> Поделиться результатом
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setStepIdx(0);
              setSelectedOpt(null);
              setFinished(false);
            }}
          >
            <RotateCcw size={15} /> Попробовать ещё раз
          </Button>
        </div>
      </Card>
    );
  }

  const current = STEPS[stepIdx];
  const IconComp = current.icon;
  const progressPct = Math.round(((stepIdx + 1) / STEPS.length) * 100);

  return (
    <Card className="p-6 sm:p-8 max-w-2xl mx-auto space-y-6">
      {/* Верхняя панель: Прогресс-бар + Шаг X из 4 + Кнопка Пропустить */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge color="emerald">Шаг {stepIdx + 1} из {STEPS.length}</Badge>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundOn(!soundOn)}
              className="p-2 border border-white/10 text-[#8A93A6] hover:text-white"
              title="Звук"
            >
              {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button
              onClick={finishSim}
              className="px-2.5 py-1.5 border border-white/10 font-mono text-[10px] uppercase text-[#8A93A6] hover:text-[#FFAA00] flex items-center gap-1"
            >
              <FastForward size={12} /> Пропустить
            </button>
          </div>
        </div>

        <div className="w-full h-2 bg-[#050810] border border-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00C853] to-[#FFAA00] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Заголовок и вопрос простыми словами */}
      <div className="flex items-start gap-4">
        <div className="p-3.5 bg-[#00C853]/15 border border-[#00C853]/40 text-[#34D399] shrink-0">
          <IconComp size={28} />
        </div>
        <div>
          <h2 className="text-xl font-medium text-white">{current.title}</h2>
          <p className="text-sm text-zinc-300 mt-1">{current.question}</p>
        </div>
      </div>

      {/* Крупные карточки-кнопки выбора (min 48px) */}
      <div className="space-y-3">
        {current.options.map((opt, idx) => {
          const isSelected = selectedOpt?.label === opt.label;
          let borderStyle = 'border-white/15 bg-[#050810] hover:border-[#FFAA00]';
          if (isSelected) {
            borderStyle = opt.isCorrect
              ? 'border-[#00C853] bg-[#00C853]/15 text-white'
              : 'border-red-500 bg-red-500/15 text-white';
          }
          return (
            <button
              key={idx}
              onClick={() => handleSelectOption(opt)}
              className={`w-full min-h-[56px] p-4 border text-left text-sm font-medium text-zinc-100 transition-all flex items-center justify-between ${borderStyle}`}
            >
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Мгновенная обратная связь + Знаете ли вы? */}
      {selectedOpt && (
        <div className="space-y-4 pt-2 animate-fadeIn">
          <div
            className={`p-4 border text-sm ${
              selectedOpt.isCorrect
                ? 'border-[#00C853]/50 bg-[#00C853]/10 text-[#34D399]'
                : 'border-red-500/50 bg-red-500/10 text-red-300'
            }`}
          >
            {selectedOpt.feedback}
          </div>

          <div className="p-3.5 border border-[#FFAA00]/30 bg-[#FFAA00]/5 text-xs text-zinc-200">
            💡 <strong className="text-[#FFAA00]">Знаете ли вы?</strong> {current.fact.replace('Знаете ли вы? ', '')}
          </div>

          {selectedOpt.isCorrect && (
            <Button variant="gold" onClick={handleNext} className="w-full min-h-[48px]">
              {stepIdx < STEPS.length - 1 ? 'Следующий шаг →' : 'Завершить и забрать +80 XP →'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}