import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Skeleton } from '../components/ui/DesignSystem';
import { Sparkles, Flame, ArrowUpRight, Activity, FolderKanban, Award } from 'lucide-react';

export default function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Загружаем статистику и ленту активности через React Query (без localStorage)
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['home_dashboard', profile?.id],
    staleTime: 30000,
    queryFn: async () => {
      const [projRes, testsRes, logsRes] = await Promise.all([
        supabase.from('projects').select('id, title, impact_metric, status, created_at').order('created_at', { ascending: false }).limit(4),
        supabase.from('test_results').select('*').eq('user_id', profile?.id),
        supabase.from('activity_log').select('*, profiles(username, full_name)').order('created_at', { ascending: false }).limit(6)
      ]);
      return {
        projects: projRes.data || [],
        myTests: testsRes.data || [],
        feed: logsRes.data || []
      };
    }
  });

  // ИИ-рекомендации активностей на основе истории пользователя (п. 9)
  const getAiRecommendations = () => {
    const completedIds = (dashboardData?.myTests || []).map((t) => t.test_id);
    const recs = [];
    if (!completedIds.includes('co2_audit')) {
      recs.push({
        title: 'Выполнить инженерный аудит выбросов CO₂ (Scope 1 & 2)',
        reason: 'ИИ-наставник заметил, что вы ещё не сохраняли расчёт декарбонизации промысла.',
        xp: '+50 XP',
        to: '/learn'
      });
    }
    if (!completedIds.includes('reclamation_sim')) {
      recs.push({
        title: 'Пройти 5-этапный симулятор биорекультивации тайги',
        reason: 'Позволит повысить уровень вашего Дерева достижений и получить бейдж «Страж Тайги».',
        xp: '+100 XP',
        to: '/learn'
      });
    }
    recs.push({
      title: 'Присоединиться к командному проекту в «Зелёном следе»',
      reason: 'В вашей организации открыт набор в проектные команды к форуму «Шаг в будущее».',
      xp: '+75 XP',
      to: '/activities'
    });
    return recs.slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const aiRecs = getAiRecommendations();

  return (
    <div className="space-y-8">
      {/* HERO & STREAK БАННЕР */}
      <Card className="p-8 border-white/10 bg-gradient-to-r from-[#070b14] via-[#091322] to-[#050810]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="emerald">ЦОС «ЮГРА.НЕФТЬ» · 2026</Badge>
              <Badge color="gold">
                <Flame size={12} className="fill-[#FFAA00]" /> Серия входов: {profile?.streak_days || 1} дн.
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extralight text-white tracking-tight">
              Добро пожаловать, <strong className="font-semibold text-[#34D399]">{profile?.full_name || profile?.username}</strong>
            </h1>
            <p className="text-xs sm:text-sm text-[#8A93A6] max-w-2xl leading-relaxed">
              Организация: <span className="text-white">{profile?.organizations?.name || 'МБОУ «СОШ № 1» пгт. Пойковский'}</span>.
              Ваш текущий баланс: <strong className="text-[#FFAA00] font-mono">{profile?.xp || 100} XP</strong>.
            </p>
          </div>

          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-2.5">
            <Button onClick={() => navigate('/learn')} className="w-full justify-between">
              <span>Перейти к симуляторам</span>
              <ArrowUpRight size={15} />
            </Button>
            <Button variant="outline" onClick={() => navigate('/activities')} className="w-full justify-between">
              <span>Проекты и Карта ХМАО</span>
              <ArrowUpRight size={15} />
            </Button>
          </div>
        </div>
      </Card>

      {/* ИИ-РЕКОМЕНДАЦИИ АКТИВНОСТЕЙ (П. 9) */}
      <div className="space-y-3">
        <div className="eyebrow flex items-center gap-2">
          <Sparkles size={13} /> Персональные ИИ-рекомендации «Роман Иванович»
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aiRecs.map((rec, i) => (
            <Card key={i} glow onClick={() => navigate(rec.to)} className="cursor-pointer flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge color="cyan">AI Рекомендация</Badge>
                  <span className="font-mono text-xs text-[#34D399] font-bold">{rec.xp}</span>
                </div>
                <h3 className="text-base font-medium text-white mb-1">{rec.title}</h3>
                <p className="text-xs text-[#8A93A6] leading-relaxed">{rec.reason}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 font-mono text-[10px] uppercase text-[#FFAA00] flex items-center justify-between">
                <span>Начать выполнение</span>
                <span>→</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* ЛЕНТА НОВОСТЕЙ И ЖИВОЙ ЖУРНАЛ СОБЫТИЙ ЭКОСИСТЕМЫ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00] flex items-center gap-2">
              <Activity size={14} /> Живая лента событий ХМАО-Югры
            </div>
            <Badge color="emerald">Realtime</Badge>
          </div>

          <div className="space-y-3">
            {dashboardData?.feed?.length === 0 ? (
              <div className="text-xs text-[#8A93A6] font-mono py-6 text-center">
                Лента обновляется по мере выполнения заданий участниками.
              </div>
            ) : (
              dashboardData.feed.map((item) => (
                <div key={item.id} className="p-3.5 border border-white/5 bg-[#050810] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-[#FFAA00] font-semibold mr-2">
                      {item.profiles?.username || '@researcher'}
                    </span>
                    <span className="text-zinc-300">
                      выполнил действие <strong className="text-white">{item.action}</strong> в модуле {item.entity}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[#4A5464]">
                    {new Date(item.created_at).toLocaleTimeString().slice(0, 5)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="font-mono text-xs uppercase tracking-widest text-[#34D399] flex items-center gap-2">
              <FolderKanban size={14} /> Новые проекты «Зелёный след»
            </div>
            <button onClick={() => navigate('/activities')} className="font-mono text-[10px] text-[#FFAA00] hover:underline">
              Все →
            </button>
          </div>

          <div className="space-y-3">
            {dashboardData?.projects?.length === 0 ? (
              <div className="text-xs text-[#8A93A6] font-mono py-6 text-center">
                Проектов пока нет. Создайте первый в разделе «Активности»!
              </div>
            ) : (
              dashboardData.projects.map((p) => (
                <div key={p.id} className="p-3.5 border border-white/5 bg-[#050810] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white truncate">{p.title}</span>
                    <Badge color="emerald">{p.impact_metric}</Badge>
                  </div>
                  <div className="font-mono text-[10px] text-[#8A93A6]">Статус: {p.status}</div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}