import React, { useState } from 'react';
import { supabase, logActivityAndAwardXp } from '../../lib/supabaseClient';
import { Button, Card, Badge, useToast } from '../ui/DesignSystem';

const STAGES = [
  {
    step: 1,
    title: 'Технический этап: Локализация и сбор нефтепродуктов',
    desc: 'Установка боновых заграждений, сбор свободной нефти нефтесборщиками (скиммерами) и откачка в автоцистерны.',
    action: 'Запустить откачку и локализацию',
    soilState: 'Загрязнение нефтью: 120 г/кг'
  },
  {
    step: 2,
    title: 'Агротехнический этап: Планировка и рыхление',
    desc: 'Механическое выравнивание рельефа, внесение торфо-минеральных смесей и рыхление для аэрации горизонта.',
    action: 'Внести торф и провести вспашку',
    soilState: 'Остаток УВ: 45 г/кг (Грунт разрыхлен)'
  },
  {
    step: 3,
    title: 'Биотехнологический этап: Внесение бактерий-деструкторов',
    desc: 'Распыление криофильного биопрепарата на основе штаммов Rhodococcus с азотно-фосфорными удобрениями.',
    action: 'Внести аборигенные бактерии',
    soilState: 'Остаток УВ: 12 г/кг (Идет биодеградация)'
  },
  {
    step: 4,
    title: 'Фитомелиорация: Гидропосев злаковых трав',
    desc: 'Посев смеси многолетних злаков (овсяница луговая, тимофеевка) методом гидропосева со стимулятором роста.',
    action: 'Выполнить гидропосев трав',
    soilState: 'Плотный травяной покров (Корневая ремедиация)'
  },
  {
    step: 5,
    title: 'Лесохозяйственный этап: Высадка сеянцев кедра',
    desc: 'Посадка двухлетних сеянцев сосны сибирской кедровой (Pinus sibirica) с закрытой корневой системой (1:1).',
    action: 'Завершить высадку таёжного кедра',
    soilState: 'Биоценоз восстановлен (Норма ХМАО соблюдена)'
  }
];

export default function ReclamationSim({ user, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completed, setCompleted] = useState(false);
  const { toast } = useToast();

  const handleNextStage = async () => {
    if (currentStep < STAGES.length) {
      setCurrentStep((prev) => prev + 1);
      if (user?.id) {
        await logActivityAndAwardXp(user.id, {
          action: `reclamation_step_${currentStep}`,
          entity: 'simulator',
          xpDelta: 20
        });
      }
    } else {
      setCompleted(true);
      if (user?.id) {
        await logActivityAndAwardXp(user.id, {
          action: 'completed_reclamation_full',
          entity: 'simulator',
          xpDelta: 100,
          newBadge: 'Инженер рекультивации'
        });
      }
      toast('Полный цикл рекультивации завершён! +100 XP начислено.', 'success');
      if (onComplete) onComplete();
    }
  };

  const stage = STAGES[currentStep - 1];

  return (
    <Card className="p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <Badge color="emerald">Интерактивный симулятор рекультивации почв ХМАО</Badge>
          <h2 className="text-xl font-light text-white mt-2">
            Этап 0{currentStep} из 05: {stage.title}
          </h2>
        </div>
        <div className="font-mono text-sm text-[#FFAA00] font-bold">
          Прогресс: {Math.round(((currentStep - 1) / STAGES.length) * 100)}%
        </div>
      </div>

      <div className="p-5 border border-white/10 bg-[#050810] space-y-3">
        <p className="text-xs text-zinc-300 leading-relaxed">{stage.desc}</p>
        <div className="font-mono text-xs text-[#34D399]">Статус горизонта: {stage.soilState}</div>
      </div>

      {!completed ? (
        <Button variant="gold" onClick={handleNextStage} className="w-full">
          {stage.action} →
        </Button>
      ) : (
        <div className="text-center py-4 space-y-3">
          <div className="text-2xl font-light text-[#00C853]">Участок тайги успешно восстановлен!</div>
          <Button variant="outline" onClick={() => { setCurrentStep(1); setCompleted(false); }}>
            Пройти симуляцию заново
          </Button>
        </div>
      )}
    </Card>
  );
}