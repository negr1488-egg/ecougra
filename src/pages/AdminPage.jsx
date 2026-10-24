import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, logActivityAndAwardXp } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Skeleton, useToast } from '../components/ui/DesignSystem';

const ROLE_MAP = [
  { id: 1, name: 'student' },
  { id: 2, name: 'teacher' },
  { id: 3, name: 'jury' },
  { id: 4, name: 'admin' },
  { id: 5, name: 'dev' }
];

export default function AdminPage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isDev = hasRole('dev');

  const { data: usersList = [], isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, xp, organizations(name), user_roles(role_id, roles(name))')
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ targetUserId, roleId, hasIt }) => {
      if (hasIt) {
        await supabase.from('user_roles').delete().eq('user_id', targetUserId).eq('role_id', roleId);
      } else {
        await supabase.from('user_roles').insert([{ user_id: targetUserId, role_id: roleId, granted_by: user.id }]);
      }
      await logActivityAndAwardXp(user.id, {
        action: hasIt ? 'revoke_role' : 'grant_role',
        entity: 'user_roles',
        entityId: targetUserId,
        meta: { roleId }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast('Роли пользователя обновлены и записаны в activity_log', 'success');
    },
    onError: (e) => toast(e.message, 'error')
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-8">
      <div className="border-b border-white/10 pb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow">Центр управления доступом и аудита (RBAC M2M)</div>
          <h1 className="text-3xl font-extralight text-white">
            Панель <strong className="font-semibold text-[#FFAA00]">Администратора {isDev ? '& Dev' : ''}</strong>
          </h1>
        </div>
        <Badge color="red">Protected by RoleGuard</Badge>
      </div>

      <Card className="space-y-4">
        <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00]">
          Управление ролями пользователей (Многие-ко-многим)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 font-mono text-[10px] uppercase text-[#8A93A6]">
                <th className="py-3 px-4">Пользователь</th>
                <th className="py-3 px-4">Организация</th>
                <th className="py-3 px-4">Назначенные роли (клик для переключения)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {usersList.map((u) => {
                const activeRoleIds = (u.user_roles || []).map((r) => r.role_id);
                return (
                  <tr key={u.id}>
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-[#FFAA00] font-bold">{u.username}</div>
                      <div className="text-white">{u.full_name}</div>
                    </td>
                    <td className="py-3.5 px-4 text-[#8A93A6]">{u.organizations?.name || '—'}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {ROLE_MAP.map((r) => {
                          const hasIt = activeRoleIds.includes(r.id);
                          return (
                            <Button
                              key={r.id}
                              size="sm"
                              variant={hasIt ? 'primary' : 'outline'}
                              onClick={() =>
                                toggleRoleMutation.mutate({ targetUserId: u.id, roleId: r.id, hasIt })
                              }
                            >
                              {hasIt ? '✓ ' : '+ '}{r.name}
                            </Button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}