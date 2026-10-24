import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Avatar, Badge, Skeleton } from '../components/ui/DesignSystem';
import AchievementTree from '../components/Dashboard/AchievementTree';
import { Trophy, Flame, Award } from 'lucide-react';

const ALL_BADGES = [
  { id: 'first_login', title: 'Пионер Экосистемы', desc: 'Регистрация в цифровой среде «Зелёная Югра»' },
  { id: 'Аудитор CO₂', title: 'Аудитор CO₂', desc: 'Выполнен расчёт выбросов Scope 1 & 2' },
  { id: 'Инженер рекультивации', title: 'Инженер рекультивации', desc: 'Пройдены все 5 этапов восстановления тайги' },
  { id: 'Знаток ПДК и ПНГ', title: 'Знаток ПДК и ПНГ', desc: 'Успешная сдача сертификационного эко-квеста' },
  { id: 'Автор эко-проекта', title: 'Автор эко-проекта', desc: 'Публикация собственной инициативы в БД' }
];

export default function GamificationPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCertModal, setShowCertModal] = useState(false);

  const { data: leaders = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, status, xp, streak_days, organizations(name)')
        .order('xp', { ascending: false })
        .limit(15);
      return data || [];
    }
  });

  // Realtime обновление лидерборда при изменении XP любого участника
  useEffect(() => {
    const channel = supabase
      .channel('realtime_leaderboard')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [queryClient]);

  const userLevel = Math.min(5, 1 + Math.floor((profile?.xp || 100) / 100));

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="eyebrow mb-2">Соревновательный контур ХМАО-Югры</div>
          <h1 className="text-3xl font-extralight text-white">
            Дерево достижений, Бейджи и <strong className="font-semibold text-[#FFAA00]">Realtime-Лидерборд</strong>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Badge color="gold">
            <Flame size={13} className="fill-[#FFAA00]" /> Ваш Streak: {profile?.streak_days || 1} дн.
          </Badge>
          <Badge color="emerald">Ваш опыт: {profile?.xp || 100} XP</Badge>
        </div>
      </div>

      {/* ДЕРЕВО ДОСТИЖЕНИЙ */}
      <AchievementTree
        user={{ ...profile, green_points: profile?.xp || 100, tree_level: userLevel }}
        onActionClick={() => navigate('/learn')}
        showCertModal={showCertModal}
        setShowCertModal={setShowCertModal}
      />

      {/* ВИТРИНА БЕЙДЖЕЙ */}
      <div className="space-y-4">
        <div className="eyebrow flex items-center gap-2">
          <Award size={14} /> Коллекция знаков отличия
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ALL_BADGES.map((b) => {
            const unlocked = Array.isArray(profile?.badges) && profile.badges.includes(b.id);
            return (
              <Card key={b.id} className={unlocked ? 'border-[#00C853]/50' : 'opacity-45'}>
                <div className="font-mono text-[10px] uppercase text-[#FFAA00] mb-1">
                  {unlocked ? '✦ РАЗБЛОКИРОВАН' : '🔒 ЗАКРЫТ'}
                </div>
                <div className="text-sm font-medium text-white mb-1">{b.title}</div>
                <p className="text-[11px] text-[#8A93A6]">{b.desc}</p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* REALTIME ЛИДЕРБОРД */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00] flex items-center gap-2">
            <Trophy size={15} /> Лидерборд реального времени (Топ исследователей Югры)
          </div>
          <Badge color="emerald">Supabase Realtime</Badge>
        </div>

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 font-mono text-[10px] uppercase text-[#8A93A6]">
                  <th className="py-3 px-4">Ранг</th>
                  <th className="py-3 px-4">Участник</th>
                  <th className="py-3 px-4">Организация</th>
                  <th className="py-3 px-4">Streak</th>
                  <th className="py-3 px-4 text-right">Опыт (XP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {leaders.map((u, idx) => (
                  <tr
                    key={u.id}
                    onClick={() => navigate(`/profile/${u.username.replace('@', '')}`)}
                    className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-[#FFAA00] font-bold">#{idx + 1}</td>
                    <td className="py-3.5 px-4 flex items-center gap-3">
                      <Avatar src={u.avatar_url} username={u.username} status={u.status} size="sm" />
                      <div>
                        <div className="font-mono text-[#FFAA00] font-semibold">{u.username}</div>
                        <div className="text-white">{u.full_name}</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#8A93A6]">{u.organizations?.name || 'ХМАО — Югра'}</td>
                    <td className="py-3.5 px-4 font-mono text-[#FFAA00]">🔥 {u.streak_days || 1} дн.</td>
                    <td className="py-3.5 px-4 font-mono text-sm font-bold text-[#34D399] text-right">
                      {u.xp} XP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}