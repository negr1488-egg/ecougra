import React, { useState } from 'react';
import { supabase, logActivityAndAwardXp } from '../../lib/supabaseClient';
import { Card, Button, Badge, useToast } from '../ui/DesignSystem';
import { Droplets, Cpu, Sun, Share2, RotateCcw, FastForward, CheckCircle2 } from 'lucide-react';

const PRODUCTION_CHOICES = [
  { id: 'small', tons: 5000, title: 'Малый участок (5 000 тонн/мес)', desc: 'Небольшая автономная скважина в тайге.' },
  { id: 'medium', tons: 15000, title: 'Средний куст скважин (15 000 тонн/мес)', desc: 'Стандартная площадка Мамонтовского месторождения.' },
  { id: 'large', tons: 30000, title: 'Крупный промысел (30 000 тонн/мес)', desc: 'Мощный комплекс Приобского месторождения.' }
];

const EQUIPMENT_CHOICES = [
  { id: 'legacy', coeff: 1.3, title: '⚙️ Старые насосы (без автоматики)', desc: 'Тратят много электричества и сжигают часть газа на факеле.' },
  { id: 'modern', coeff: 0.9, title: '⚡ Энергоэффективные насосы', desc: 'Умные датчики подстраивают мощность и экономят до 25% энергии.' },
  { id: 'hybrid', coeff: 0.65, title: '🚀 Современный смарт-комплекс (ПНГ 98%)', desc: 'Попутный газ не сжигается впустую, а даёт промыслу свет и тепло.' }
];

const RES_CHOICES = [
  { id: 0, share: 0, title: '🔌 0% — Только обычная электросеть', desc: 'Вся энергия идёт от стандартных генераторов.' },
  { id: 20, share: 20, title: '☀️ 20% — Солнечные панели для автоматики', desc: 'Датчики и связь питаются от солнца.' },
  { id: 40, share: 40, title: '🌿 40% — Гибридная зелёная энергия (ВИЭ + микротурбины)', desc: 'Максимальное снижение выбросов углекислого газа.' }
];

const STEP_FACTS = [
  'Если не сжигать попутный нефтяной газ на факеле, а направлять его в газотурбинную станцию, промысел обеспечивает себя чистой энергией.',
  'Умные насосы с частотным приводом сами снижают обороты, когда приток жидкости уменьшается, экономя тысячи киловатт-часов.',
  'Даже зимой в солнечные дни в Югре солнечные батареи успешно питают кустовую телеметрию и связь.'
];

export default function Co2Calculator({ user, onSaved }) {
  const [step, setStep] = useState(1); // 1, 2, 3, 4 (result)
  const [prodChoice, setProdChoice] = useState(PRODUCTION_CHOICES[1]);
  const [eqChoice, setEqChoice] = useState(EQUIPMENT_CHOICES[1]);
  const [resChoice, setResChoice] = useState(RES_CHOICES[1]);
  const { toast } = useToast();

  const baselineCo2 = Math.round(prodChoice.tons * 0.28 * 1.3);
  const currentCo2 = Math.round(prodChoice.tons * 0.28 * eqChoice.coeff * (1 - resChoice.share / 100));
  const savedCo2 = Math.max(0, baselineCo2 - currentCo2);
  const dropPercent = Math.round((savedCo2 / baselineCo2) * 100);

  const handleFinish = async (selectedRes) => {
    const finalRes = selectedRes || resChoice;
    setResChoice(finalRes);
    setStep(4);

    const finalCo2 = Math.round(prodChoice.tons * 0.28 * eqChoice.coeff * (1 - finalRes.share / 100));
    const finalSaved = Math.max(0, baselineCo2 - finalCo2);

    try {
      await supabase.from('co2_calculations').insert([{
        user_id: user?.id,
        field_name: prodChoice.title,
        oil_production_tons: prodChoice.tons,
        apg_utilization_rate: eqChoice.id === 'hybrid' ? 98 : 95.5,
        equipment_type: eqChoice.id,
        res_share: finalRes.share,
        calculated_emissions_tons: finalCo2,
        saved_emissions_tons: finalSaved
      }]);

      if (user?.id) {
        await supabase.rpc('award_xp_secure', {
          p_action: 'co2_calculation',
          p_entity: 'calculator',
          p_xp_delta: 60,
          p_badge: 'Аудитор CO₂'
        });
        await logActivityAndAwardXp(user.id, {
          action: 'co2_calculation',
          entity: 'calculator',
          xpDelta: 60,
          newBadge: 'Аудитор CO₂'
        });
      }
      toast('Расчёт сохранён! +60 XP', 'success');
      if (onSaved) onSaved();
    } catch (e) {
      console.error(e);
    }
  };

  if (step === 4) {
    return (
      <Card className="p-8 max-w-2xl mx-auto space-y-6 text-center border-[#FFAA00]/40">
        <Badge color="gold">Расчёт завершён · +60 XP и бейдж «Аудитор CO₂»</Badge>
        <h2 className="text-2xl sm:text-3xl font-light text-white">
          Выбросы CO₂ составят: <strong className="text-[#34D399] font-mono">{currentCo2.toLocaleString()} тонн</strong>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          <div className="p-4 border border-white/10 bg-[#050810]">
            <div className="font-mono text-[10px] uppercase text-[#8A93A6]">Предотвращено выбросов</div>
            <div className="text-2xl font-mono font-bold text-[#00C853] mt-1">
              -{savedCo2.toLocaleString()} т ({dropPercent}%)
            </div>
          </div>
          <div className="p-4 border border-white/10 bg-[#050810]">
            <div className="font-mono text-[10px] uppercase text-[#8A93A6]">Эквивалент посаженного леса</div>
            <div className="text-2xl font-mono font-bold text-[#FFAA00] mt-1">
              🌲 {(savedCo2 * 45).toLocaleString()} деревьев
            </div>
          </div>
        </div>

        {/* Простые советы */}
        <div className="p-4 border border-[#00C853]/40 bg-[#00C853]/10 text-left space-y-2 text-xs sm:text-sm text-zinc-200">
          <div className="font-mono text-[11px] uppercase text-[#34D399] font-bold">Простые советы для промысла:</div>
          <p>
            ✅ {resChoice.share < 40
              ? 'Если увеличить долю солнечных панелей и ВИЭ до 40%, выбросы упадут ещё на 20–25%!'
              : 'Отличный выбор! Вы используете максимум чистой энергии ВИЭ.'}
          </p>
          <p>
            ✅ {eqChoice.id !== 'hybrid'
              ? 'Переход на смарт-комплекс с утилизацией ПНГ 98% сэкономит промыслу до 1,5 млн рублей в месяц.'
              : 'Смарт-оборудование работает на максимальной эффективности!'}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              navigator.clipboard?.writeText(`Мой расчёт на платформе Зелёная Югра: снижение выбросов CO₂ на ${dropPercent}% (-${savedCo2} тонн)!`);
              toast('Скопировано для отправки!', 'success');
            }}
          >
            <Share2 size={15} /> Поделиться результатом
          </Button>
          <Button variant="outline" onClick={() => setStep(1)}>
            <RotateCcw size={15} /> Рассчитать заново
          </Button>
        </div>
      </Card>
    );
  }

  const progressPct = Math.round((step / 3) * 100);

  return (
    <Card className="p-6 sm:p-8 max-w-2xl mx-auto space-y-6">
      {/* Прогресс-бар */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge color="gold">Калькулятор CO₂ · Шаг {step} из 3</Badge>
          <button
            onClick={() => handleFinish(RES_CHOICES[2])}
            className="px-2.5 py-1 border border-white/10 font-mono text-[10px] uppercase text-[#8A93A6] hover:text-white flex items-center gap-1"
          >
            <FastForward size={12} /> Пропустить
          </button>
        </div>
        <div className="w-full h-2 bg-[#050810] border border-white/10">
          <div className="h-full bg-[#FFAA00] transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Droplets size={26} className="text-[#FFAA00]" />
            <div>
              <h2 className="text-xl font-medium text-white">Выберите объём добычи на участке</h2>
              <p className="text-xs text-[#8A93A6]">Что произойдёт: от размера промысла зависит базовый расход энергии.</p>
            </div>
          </div>

          <div className="space-y-3">
            {PRODUCTION_CHOICES.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setProdChoice(c);
                  setStep(2);
                }}
                className="w-full min-h-[60px] p-4 border border-white/15 bg-[#050810] hover:border-[#FFAA00] text-left transition-all"
              >
                <div className="text-sm font-medium text-white">{c.title}</div>
                <div className="text-xs text-[#8A93A6] mt-0.5">{c.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Cpu size={26} className="text-[#00C853]" />
            <div>
              <h2 className="text-xl font-medium text-white">Какое оборудование установим?</h2>
              <p className="text-xs text-[#8A93A6]">Что произойдёт: современные насосы и турбины резко снижают сжигание газа.</p>
            </div>
          </div>

          <div className="space-y-3">
            {EQUIPMENT_CHOICES.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setEqChoice(c);
                  setStep(3);
                }}
                className="w-full min-h-[60px] p-4 border border-white/15 bg-[#050810] hover:border-[#00C853] text-left transition-all"
              >
                <div className="text-sm font-medium text-white">{c.title}</div>
                <div className="text-xs text-[#8A93A6] mt-0.5">{c.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Sun size={26} className="text-[#22D3EE]" />
            <div>
              <h2 className="text-xl font-medium text-white">Какую долю чистой энергии (ВИЭ) подключим?</h2>
              <p className="text-xs text-[#8A93A6]">Что произойдёт: солнечные панели заменят часть дизельных генераторов.</p>
            </div>
          </div>

          <div className="space-y-3">
            {RES_CHOICES.map((c) => (
              <button
                key={c.id}
                onClick={() => handleFinish(c)}
                className="w-full min-h-[60px] p-4 border border-white/15 bg-[#050810] hover:border-[#22D3EE] text-left transition-all flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-white">{c.title}</div>
                  <div className="text-xs text-[#8A93A6] mt-0.5">{c.desc}</div>
                </div>
                <CheckCircle2 size={18} className="text-[#00C853] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-3.5 border border-[#FFAA00]/30 bg-[#FFAA00]/5 text-xs text-zinc-200">
        💡 <strong className="text-[#FFAA00]">Знаете ли вы?</strong> {STEP_FACTS[step - 1]}
      </div>
    </Card>
  );
}