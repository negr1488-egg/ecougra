import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getLevelInfo } from '../data/levelsData';
import { Card, Button, Badge, Input, Modal, Skeleton, useToast } from '../components/ui/DesignSystem';
import { Trophy, School, Plus, Flame, Award, Users } from 'lucide-react';

export default function GamificationPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [orgTypeFilter, setOrgTypeFilter] = useState('all'); // all | school | university | company
  const [addSchoolModal, setAddSchoolModal] = useState(false);
  const [schoolForm, setSchoolForm] = useState({ name: '', type: 'school', city: '', region: 'ХМАО — Югра' });

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard_top100'],
    queryFn: async () => {
      const [profRes, orgsRes, projRes] = await Promise.all([
        supabase.from('profiles').select('id, username, full_name, xp, streak_days, org_id, avatar_url').order('xp', { ascending: false }).limit(100),
        supabase.from('organizations').select('*'),
        supabase.from('projects').select('id, org_id, author_id')
      ]);

      const profiles = profRes.data || [];
      const orgs = (orgsRes.data || []).filter((o) => o.status !== 'rejected');
      const projects = projRes.data || [];

      const orgStats = orgs.map((o) => {
        const members = profiles.filter((p) => p.org_id === o.id);
        const totalXp = members.reduce((sum, m) => sum + (m.xp || 100), 0);
        const orgProjects = projects.filter((pr) => pr.org_id === o.id || members.some((m) => m.id === pr.author_id));
        return {
          ...o,
          membersCount: members.length,
          projectsCount: orgProjects.length,
          totalXp
        };
      }).sort((a, b) => b.totalXp - a.totalXp);

      return { profiles, orgStats };
    }
  });

  const addSchoolMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      const { error } = await supabase.from('organizations').insert([{
        name: schoolForm.name.trim(),
        type: schoolForm.type,
        city: schoolForm.city.trim(),
        region: schoolForm.region.trim(),
        status: 'approved',
        created_by: user?.id
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard_top100'] });
      setAddSchoolModal(false);
      setSchoolForm({ name: '', type: 'school', city: '', region: 'ХМАО — Югра' });
      toast('Образовательная организация добавлена в рейтинг!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const myLevel = getLevelInfo(profile?.xp || 100);
  const filteredOrgs = (data?.orgStats || []).filter(
    (o) => orgTypeFilter === 'all' || o.type === orgTypeFilter
  );

  return (
    <div className="space-y-8">
      {/* Мой уровень из 50 */}
      <Card className="p-6 sm:p-8 border-[#00C853]/30 bg-gradient-to-r from-[#07121e] to-[#050810]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Badge color="gold">Система 50 уровней · Рамка: {myLevel.frameName}</Badge>
            <h1 className="text-2xl sm:text-3xl font-light text-white">
              Уровень {myLevel.level} / 50: <strong className="font-semibold text-[#34D399]">{myLevel.title}</strong>
            </h1>
            <p className="text-xs text-[#8A93A6]">
              Баланс: <strong className="text-white font-mono">{myLevel.xp} XP</strong> · Следующий ранг на {myLevel.nextLevelXp} XP
            </p>
          </div>
          <div className="w-full md:w-72 space-y-1.5">
            <div className="flex justify-between font-mono text-xs text-[#FFAA00]">
              <span>Прогресс ранга</span>
              <span>{myLevel.progressPct}%</span>
            </div>
            <div className="w-full h-3 bg-[#050810] border border-white/10">
              <div className="h-full bg-gradient-to-r from-[#00C853] to-[#FFAA00]" style={{ width: `${myLevel.progressPct}%` }} />
            </div>
          </div>
        </div>
      </Card>

      {/* Лидерборд ТОП-100 Школ и ВУЗов */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="eyebrow">Рейтинг учебных заведений ХМАО-Югры</div>
            <h2 className="text-2xl font-light text-white flex items-center gap-2 mt-1">
              <School size={22} className="text-[#FFAA00]" /> Топ-100 Школ и ВУЗов по сумме XP
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'Все' },
              { id: 'school', label: 'Школы' },
              { id: 'university', label: 'ВУЗы' },
              { id: 'company', label: 'Компании' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setOrgTypeFilter(f.id)}
                className={`px-3 py-1.5 font-mono text-xs uppercase border ${
                  orgTypeFilter === f.id
                    ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00]'
                    : 'border-white/10 text-[#8A93A6]'
                }`}
              >
                {f.label}
              </button>
            ))}

            <Button size="sm" variant="gold" onClick={() => setAddSchoolModal(true)}>
              <Plus size={14} /> Добавить свою школу
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrgs.map((org, idx) => (
            <Card key={org.id} className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded bg-[#FFAA00]/10 border border-[#FFAA00]/40 flex items-center justify-center font-mono text-base font-bold text-[#FFAA00]">
                  #{idx + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-white">{org.name}</h3>
                    <Badge color="emerald">{org.city}</Badge>
                  </div>
                  <div className="text-xs text-[#8A93A6] mt-1 flex items-center gap-3 font-mono">
                    <span><Users size={11} className="inline mr-1" /> Участников: {org.membersCount}</span>
                    <span>Проектов: {org.projectsCount}</span>
                  </div>
                </div>
              </div>
              <div className="text-right font-mono">
                <div className="text-base font-bold text-[#34D399]">{org.totalXp.toLocaleString()} XP</div>
                <div className="text-[10px] text-[#8A93A6]">Суммарный вклад</div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Индивидуальный рейтинг исследователей */}
      <Card className="space-y-4">
        <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00] flex items-center gap-2">
          <Trophy size={15} /> Личный зачёт исследователей
        </div>
        <div className="space-y-2">
          {(data?.profiles || []).map((p, idx) => {
            const lvl = getLevelInfo(p.xp);
            return (
              <div key={p.id} className="p-3.5 border border-white/5 bg-[#050810] flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[#FFAA00] font-bold w-6">#{idx + 1}</span>
                  <div>
                    <span className="font-mono text-white font-semibold mr-2">{p.username}</span>
                    <span className="text-[#8A93A6]">{p.full_name}</span>
                  </div>
                  <Badge color="emerald">LVL {lvl.level} · {lvl.title}</Badge>
                </div>
                <div className="font-mono text-[#34D399] font-bold">{p.xp || 100} XP</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Modal isOpen={addSchoolModal} onClose={() => setAddSchoolModal(false)} title="Добавить школу или ВУЗ в лидерборд">
        <form onSubmit={(e) => addSchoolMutation.mutate(e)} className="space-y-4">
          <Input
            label="Официальное название учебного заведения"
            placeholder="Например: МБОУ «СОШ № 2»"
            value={schoolForm.name}
            onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Город / Населённый пункт"
              placeholder="г. Нефтеюганск"
              value={schoolForm.city}
              onChange={(e) => setSchoolForm({ ...schoolForm, city: e.target.value })}
              required
            />
            <div>
              <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">Тип организации</label>
              <select
                value={schoolForm.type}
                onChange={(e) => setSchoolForm({ ...schoolForm, type: e.target.value })}
                className="w-full bg-[#050810] border border-white/15 px-3 py-2 text-xs text-white"
              >
                <option value="school">Школа / Лицей</option>
                <option value="university">ВУЗ / Колледж</option>
                <option value="company">Предприятие-партнёр</option>
              </select>
            </div>
          </div>
          <Button type="submit" variant="gold" className="w-full">Отправить и добавить в список</Button>
        </form>
      </Modal>
    </div>
  );
}