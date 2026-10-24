import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, logActivityAndAwardXp } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Button, useToast } from '../components/ui/DesignSystem';
import Co2Calculator from '../components/Calculator/Co2Calculator';
import ReclamationSim from '../components/Simulator/ReclamationSim';
import EcoQuests from '../components/Simulator/EcoQuests';
import HelmetTelemetry from '../components/Monitoring/HelmetTelemetry';

export default function LearnPage() {
  const [moduleTab, setModuleTab] = useState('co2'); // 'co2' | 'reclamation' | 'quests' | 'helmet'
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveResultMutation = useMutation({
    mutationFn: async ({ testId, score, maxScore = 100, badge = null }) => {
      if (!user) return;
      const { error } = await supabase.from('test_results').insert([{
        user_id: user.id,
        test_id: testId,
        score,
        max_score: maxScore,
        answers: { completed_by: profile?.username }
      }]);
      if (error) throw error;

      await logActivityAndAwardXp(user.id, {
        action: `completed_${testId}`,
        entity: 'learn',
        entityId: testId,
        xpDelta: score,
        newBadge: badge
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home_dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      refreshProfile();
      toast('Результат сохранён в Supabase! Начислены баллы XP.', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="eyebrow mb-2">Образовательно-симуляционный контур</div>
          <h1 className="text-3xl font-extralight text-white">
            Тренажёры, Калькулятор CO₂ и <strong className="font-semibold text-[#00C853]">IoT-Лаборатория</strong>
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'co2', label: '01 / Калькулятор CO₂' },
            { id: 'reclamation', label: '02 / Симулятор рекультивации' },
            { id: 'quests', label: '03 / Сертификационный тест' },
            { id: 'helmet', label: '04 / Умная каска (MQ-4/7)' }
          ].map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={moduleTab === t.id ? 'gold' : 'outline'}
              onClick={() => setModuleTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {moduleTab === 'co2' && (
        <Co2Calculator
          user={profile}
          onSaved={() => saveResultMutation.mutate({ testId: 'co2_audit', score: 50, badge: 'Аудитор CO₂' })}
        />
      )}

      {moduleTab === 'reclamation' && (
        <ReclamationSim
          user={profile}
          onComplete={() => saveResultMutation.mutate({ testId: 'reclamation_sim', score: 100, badge: 'Инженер рекультивации' })}
        />
      )}

      {moduleTab === 'quests' && (
        <EcoQuests
          user={profile}
          onComplete={(score) => saveResultMutation.mutate({ testId: 'eco_quest_main', score: score || 80, badge: 'Знаток ПДК и ПНГ' })}
        />
      )}

      {moduleTab === 'helmet' && <HelmetTelemetry />}
    </div>
  );
}