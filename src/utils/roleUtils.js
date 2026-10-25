export const ROLE_PRIORITY = {
  dev: { label: 'Разработчик', color: 'purple', weight: 5 },
  admin: { label: 'Админ', color: 'red', weight: 4 },
  jury: { label: 'Жюри', color: 'gold', weight: 3 },
  teacher: { label: 'Наставник', color: 'cyan', weight: 2 },
  student: { label: 'Студент', color: 'emerald', weight: 1 }
};

export function getHighestRole(rolesArray = []) {
  if (!rolesArray || rolesArray.length === 0) return { name: 'student', label: 'Студент', color: 'emerald' };
  
  let highest = { name: 'student', label: 'Студент', color: 'emerald', weight: 0 };
  
  rolesArray.forEach((rName) => {
    const config = ROLE_PRIORITY[rName];
    if (config && config.weight > highest.weight) {
      highest = { name: rName, ...config };
    }
  });
  
  return highest;
}