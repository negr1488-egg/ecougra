import React, { useState } from 'react';
import { ECO_QUESTS } from '../../data/questsData';
import { supabase, logActivityAndAwardXp } from '../../lib/supabaseClient';
import { Button, Card, Badge, useToast } from '../ui/DesignSystem';

export default function EcoQuests({ user, onComplete }) {
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const { toast } = useToast();

  const handleAnswer = async (selectedIdx) => {
    const isCorrect = selectedIdx === ECO_QUESTS[qIdx].correct;
    const addedScore = isCorrect ? 10 : 0;
    const newTotal = score + addedScore;

    if (qIdx < ECO_QUESTS.length - 1) {
      setScore(newTotal);
      setQIdx((prev) => prev + 1);
    } else {
      setScore(newTotal);
      setFinished(true);
      if (user?.id) {
        await supabase.from('test_results').insert([{
          user_id: user.id,
          test_id: 'eco_quest_main',
          score: newTotal,
          max_score: ECO_QUESTS.length * 10
        }]);

        await logActivityAndAwardXp(user.id, {
          action: 'completed_eco_quests',
          entity: 'test',
          xpDelta: newTotal,
          newBadge: newTotal >= 70 ? 'Знаток ПДК и ПНГ' : null
        });
      }
      toast(`Тестирование завершено! Набрано ${newTotal} баллов.`, 'success');
      if (onComplete) onComplete(newTotal);
    }
  };

  const curr = ECO_QUESTS[qIdx] || ECO_QUESTS[0];

  return (
    <Card className="p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <Badge color="gold">Сертификационный эко-квест Югры</Badge>
        <span className="font-mono text-xs text-[#8A93A6]">
          Вопрос {qIdx + 1} из {ECO_QUESTS.length}
        </span>
      </div>

      {!finished ? (
        <div className="space-y-5">
          <h3 className="text-base font-medium text-white leading-snug">{curr.question}</h3>
          <div className="space-y-2">
            {curr.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className="w-full text-left p-3.5 border border-white/10 bg-[#050810] hover:border-[#FFAA00] text-xs text-zinc-300 transition-colors"
              >
                <span className="font-mono text-[#FFAA00] mr-2">0{i + 1}.</span> {opt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 space-y-4">
          <div className="text-3xl font-light text-[#00C853]">{score} из {ECO_QUESTS.length * 10} баллов</div>
          <p className="text-xs text-[#8A93A6]">
            {score >= 70 ? 'Норматив сертификации успешно сдан!' : 'Рекомендуется повторить материалы по утилизации ПНГ и ПДК.'}
          </p>
          <Button variant="outline" onClick={() => { setQIdx(0); setScore(0); setFinished(false); }}>
            Пройти тест заново
          </Button>
        </div>
      )}
    </Card>
  );
}