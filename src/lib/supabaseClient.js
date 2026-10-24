import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Внимание: Задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в переменных окружения (.env / Vercel)!');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Клиентский Rate-Limiter (защита от спама в чат и формы)
const throttleMap = new Map();
export function checkRateLimit(actionKey, limitMs = 2000) {
  const now = Date.now();
  const last = throttleMap.get(actionKey) || 0;
  if (now - last < limitMs) {
    const waitSec = Math.ceil((limitMs - (now - last)) / 1000);
    throw new Error(`Подождите ${waitSec} сек. перед повторным действием.`);
  }
  throttleMap.set(actionKey, now);
}

// Валидация загружаемых файлов (Безопасность п. 8)
export function validateUploadFile(file, { maxMb = 5, allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] } = {}) {
  if (!file) throw new Error('Файл не выбран');
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Недопустимый формат файла (${file.type}). Разрешены: JPG, PNG, WEBP, PDF.`);
  }
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > maxMb) {
    throw new Error(`Размер файла (${sizeMb.toFixed(1)} МБ) превышает лимит ${maxMb} МБ.`);
  }
  return true;
}

// Загрузка файла в Supabase Storage и получение ссылки
export async function uploadFileToStorage(bucket, userId, file) {
  validateUploadFile(file);
  const ext = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Запись действия в журнал аудита activity_log + начисление XP
export async function logActivityAndAwardXp(userId, { action, entity, entityId = '', meta = {}, xpDelta = 0, newBadge = null }) {
  if (!userId) return;
  await supabase.from('activity_log').insert([{
    user_id: userId,
    action,
    entity,
    entity_id: String(entityId),
    meta
  }]);

  if (xpDelta > 0 || newBadge) {
    const { data: prof } = await supabase.from('profiles').select('xp, badges').eq('id', userId).single();
    if (prof) {
      const updatedBadges = Array.isArray(prof.badges) ? [...prof.badges] : [];
      if (newBadge && !updatedBadges.includes(newBadge)) updatedBadges.push(newBadge);
      await supabase
        .from('profiles')
        .update({ xp: (prof.xp || 0) + xpDelta, badges: updatedBadges })
        .eq('id', userId);
    }
  }
}

export default supabase;