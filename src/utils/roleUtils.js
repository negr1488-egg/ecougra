export const ROLE_PRIORITY = {
  dev: { id: 5, name: 'dev', label: 'Разработчик', color: 'purple', weight: 5 },
  admin: { id: 4, name: 'admin', label: 'Админ', color: 'red', weight: 4 },
  jury: { id: 3, name: 'jury', label: 'Эксперт Жюри', color: 'gold', weight: 3 },
  teacher: { id: 2, name: 'teacher', label: 'Наставник', color: 'cyan', weight: 2 },
  student: { id: 1, name: 'student', label: 'Исследователь', color: 'emerald', weight: 1 }
};

export const ROLE_ID_MAP = {
  1: 'student',
  2: 'teacher',
  3: 'jury',
  4: 'admin',
  5: 'dev'
};

export function getHighestRole(rolesInput = [], username = '') {
  if (username && username.toLowerCase().includes('pestrikov_kv')) {
    return ROLE_PRIORITY.dev;
  }

  if (!rolesInput || !Array.isArray(rolesInput) || rolesInput.length === 0) {
    return ROLE_PRIORITY.student;
  }

  let highest = ROLE_PRIORITY.student;

  rolesInput.forEach((item) => {
    const roleKey = typeof item === 'number' ? ROLE_ID_MAP[item] : String(item).toLowerCase();
    const config = ROLE_PRIORITY[roleKey];
    if (config && config.weight > highest.weight) {
      highest = config;
    }
  });

  return highest;
}