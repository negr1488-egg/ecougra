import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, logActivityAndAwardXp } from '../../lib/supabaseClient';
import { Button, Card, Badge, Input, useToast } from '../ui/DesignSystem';

export default function GreenFootprint({ user, onProjectSubmitted, onNavigateDefense }) {
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState('');
  const [description, setDescription] = useState('');
  const [impactMetric, setImpactMetric] = useState('-30% выбросов CO₂');
  const [showForm, setShowForm] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects_workshop'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('*, profiles!projects_author_id_fkey(username, full_name)')
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Авторизуйтесь для публикации');
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          title,
          description,
          impact_metric: impactMetric,
          author_id: user.id,
          status: 'approved'
        }])
        .select()
        .single();
      if (error) throw error;

      await logActivityAndAwardXp(user.id, {
        action: 'created_project',
        entity: 'project',
        entityId: data.id,
        xpDelta: 75,
        newBadge: 'Автор эко-проекта'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects_workshop'] });
      setTitle('');
      setProblem('');
      setDescription('');
      setShowForm(false);
      toast('Проект сохранён в базе данных Supabase! (+75 XP)', 'success');
      if (onProjectSubmitted) onProjectSubmitted();
    },
    onError: (e) => toast(e.message, 'error')
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="eyebrow mb-2">Проектная мастерская Югры</div>
          <h1 className="text-3xl font-extralight text-white">
            Банк инициатив <strong className="font-semibold text-[#00C853]">«Зелёный след»</strong>
          </h1>
        </div>
        <Button variant="gold" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Скрыть форму' : '+ Подать проект'}
        </Button>
      </div>

      {showForm && (
        <Card className="p-6 space-y-4">
          <Input label="Название проекта" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Input label="Целевой показатель (KPI)" value={impactMetric} onChange={(e) => setImpactMetric(e.target.value)} required />
          <div>
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">Описание инициативы</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#050810] border border-white/10 p-3 text-xs text-white focus:outline-none"
              required
            />
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            Сохранить в БД (+75 XP)
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <Card key={p.id} glow className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge color="emerald">KPI: {p.impact_metric}</Badge>
              <span className="font-mono text-[10px] text-[#FFAA00]">{p.profiles?.username || '@author'}</span>
            </div>
            <h3 className="text-base font-medium text-white">{p.title}</h3>
            <p className="text-xs text-[#8A93A6]">{p.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}