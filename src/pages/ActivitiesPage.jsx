import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase, logActivityAndAwardXp } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Badge, Modal, EmptyState, Skeleton, useToast } from '../components/ui/DesignSystem';
import EcoMap from '../components/EcoMap/EcoMap';

const projectSchema = z.object({
  title: z.string().min(5, 'Название должно содержать минимум 5 символов'),
  category: z.string().min(1),
  impact_metric: z.string().min(2, 'Укажите целевой KPI (например, -30% CO₂)'),
  description: z.string().min(20, 'Опишите технологическое решение подробнее (мин. 20 символов)')
});

export default function ActivitiesPage() {
  const [view, setView] = useState('projects'); // 'projects' | 'map'
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewProject, setReviewProject] = useState(null);
  const [juryScore, setJuryScore] = useState(45);
  const [juryComment, setJuryComment] = useState('');

  const { user, profile, hasRole, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isJury = hasRole(['jury', 'admin']);

  const form = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: { category: 'reclamation', impact_metric: '-30% выбросов CO₂' }
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, profiles!projects_author_id_fkey(username, full_name), organizations(name), project_reviews(score, comment)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values) => {
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          title: values.title,
          description: values.description,
          category: values.category,
          impact_metric: values.impact_metric,
          author_id: user.id,
          org_id: profile?.org_id || null,
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
      queryClient.invalidateQueries({ queryKey: ['projects_list'] });
      refreshProfile();
      setCreateOpen(false);
      form.reset();
      toast('Проект опубликован в базе данных (+75 XP)!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('project_reviews').upsert([{
        project_id: reviewProject.id,
        jury_id: user.id,
        score: juryScore,
        comment: juryComment || 'Проект рекомендован к внедрению на промыслах ХМАО.'
      }]);
      if (error) throw error;
      await logActivityAndAwardXp(user.id, {
        action: 'reviewed_project',
        entity: 'project_review',
        entityId: reviewProject.id,
        xpDelta: 40
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects_list'] });
      setReviewProject(null);
      setJuryComment('');
      toast('Оценка жюри сохранена! Автору отправлено уведомление.', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  const joinTeamMutation = useMutation({
    mutationFn: async (proj) => {
      const currentTeam = Array.isArray(proj.team_members) ? proj.team_members : [];
      if (currentTeam.includes(user.id)) throw new Error('Вы уже состоите в команде этого проекта');
      const { error } = await supabase
        .from('projects')
        .update({ team_members: [...currentTeam, user.id] })
        .eq('id', proj.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects_list'] });
      toast('Вы присоединились к проектной команде!', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="eyebrow mb-2">Проектная мастерская и ГИС-мониторинг</div>
          <h1 className="text-3xl font-extralight text-white">
            Активности, Проекты и <strong className="font-semibold text-[#FFAA00]">Оценка жюри</strong>
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={view === 'projects' ? 'gold' : 'outline'} onClick={() => setView('projects')}>
            01 / Проекты и Защита
          </Button>
          <Button size="sm" variant={view === 'map' ? 'gold' : 'outline'} onClick={() => setView('map')}>
            02 / ГИС-Карта ХМАО
          </Button>
          <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>
            + Подать проект
          </Button>
        </div>
      </div>

      {view === 'map' ? (
        <EcoMap />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="В базе данных пока нет проектов"
          description="Предложите первую экологическую инициативу по утилизации ПНГ, биорекультивации или солнечной энергетике для месторождений Югры."
          actionLabel="+ Создать первый проект"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((p) => (
            <Card key={p.id} glow className="flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <Badge color="emerald">KPI: {p.impact_metric}</Badge>
                  <Badge color="gold">Балл жюри: {p.jury_score || 'Не оценён'} / 50</Badge>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">{p.title}</h3>
                <p className="text-xs text-[#8A93A6] leading-relaxed mb-4">{p.description}</p>

                {p.project_reviews?.length > 0 && (
                  <div className="p-3 border border-[#FFAA00]/30 bg-[#050810] text-xs space-y-1">
                    <span className="font-mono text-[10px] text-[#FFAA00] uppercase">Рецензия эксперта жюри:</span>
                    <p className="text-zinc-300">{p.project_reviews[0].comment}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono text-[11px] text-[#8A93A6]">
                  Автор: <strong className="text-[#FFAA00]">{p.profiles?.username || '@author'}</strong> · Команда: {(p.team_members?.length || 0) + 1} чел.
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => joinTeamMutation.mutate(p)}>
                    В команду
                  </Button>
                  {isJury && (
                    <Button size="sm" variant="gold" onClick={() => setReviewProject(p)}>
                      Оценить (Жюри)
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Модальное окно создания проекта */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Подача экологического проекта">
        <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
          <Input
            label="Название проекта"
            placeholder="Сфагновый биосорбент для очистки кустовых площадок"
            error={form.formState.errors.title?.message}
            {...form.register('title')}
          />
          <Input
            label="Целевой экологический эффект (KPI)"
            placeholder="-35% времени биодеструкции нефти"
            error={form.formState.errors.impact_metric?.message}
            {...form.register('impact_metric')}
          />
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1">
              Описание технологии и применимости в ХМАО
            </label>
            <textarea
              rows={4}
              {...form.register('description')}
              className="w-full bg-[#050810] border border-white/10 p-3 text-sm text-white focus:outline-none focus:border-[#FFAA00]"
            />
            {form.formState.errors.description && (
              <p className="font-mono text-[10px] text-red-400 mt-1">{form.formState.errors.description.message}</p>
            )}
          </div>
          <Button type="submit" disabled={createMutation.isPending} className="w-full">
            {createMutation.isPending ? 'Публикация...' : 'Опубликовать проект (+75 XP)'}
          </Button>
        </form>
      </Modal>

      {/* Модальное окно оценки для роли JURY */}
      <Modal
        isOpen={Boolean(reviewProject)}
        onClose={() => setReviewProject(null)}
        eyebrow="Аттестационная комиссия (Роль: JURY)"
        title={`Оценка проекта: ${reviewProject?.title || ''}`}
      >
        <div className="space-y-4">
          <div>
            <div className="flex justify-between font-mono text-xs mb-2">
              <span className="text-[#8A93A6]">Итоговый балл (от 1 до 50):</span>
              <span className="text-[#FFAA00] font-bold">{juryScore} / 50</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={juryScore}
              onChange={(e) => setJuryScore(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1">
              Экспертное заключение жюри
            </label>
            <textarea
              rows={3}
              value={juryComment}
              onChange={(e) => setJuryComment(e.target.value)}
              placeholder="Укажите сильные стороны работы и рекомендации к внедрению..."
              className="w-full bg-[#050810] border border-white/10 p-3 text-sm text-white"
            />
          </div>
          <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending} className="w-full">
            Утвердить протокол оценки
          </Button>
        </div>
      </Modal>
    </div>
  );
}