create extension if not exists "uuid-ossp";

-- 1. Пользователи и прогресс эко-дерева
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  school text,
  green_points int default 0,
  tree_level int default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Результаты тестов и симулятора
create table if not exists public.test_results (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  activity_type text check (activity_type in ('quest', 'reclamation_simulator')),
  score int not null,
  max_score int not null,
  passed boolean default false,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Расчеты углеродного следа (Калькулятор CO2)
create table if not exists public.co2_calculations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  oil_production_tons numeric not null,
  apg_utilization_rate numeric not null,
  equipment_type text not null,
  res_share numeric not null,
  calculated_emissions_tons numeric not null,
  saved_emissions_tons numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Мастерская проектов «Зеленый след»
create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  author_name text not null,
  description text not null,
  category text check (category in ('reclamation', 'energy_efficiency', 'biodiversity', 'apg_processing')),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  likes_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Телеметрия умной каски (MQ-4 / MQ-7)
create table if not exists public.gas_telemetry (
  id uuid default uuid_generate_v4() primary key,
  device_id text not null,
  methane_ppm numeric not null,
  co_ppm numeric not null,
  status text check (status in ('normal', 'warning', 'danger')) not null,
  recorded_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Триггер автоматической прокачки уровней Дерева достижений
create or replace function public.handle_points_and_tree()
returns trigger as $$
begin
  update public.users
  set 
    green_points = green_points + new.score,
    tree_level = least(5, 1 + floor((green_points + new.score) / 100))
  where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_test_submitted
after insert on public.test_results
for each row execute procedure public.handle_points_and_tree();

-- RLS
alter table public.users enable row level security;
alter table public.test_results enable row level security;
alter table public.co2_calculations enable row level security;
alter table public.projects enable row level security;
alter table public.gas_telemetry enable row level security;

create policy "Users can read own profile" on public.users for select using (auth.uid() = id);
create policy "Users can insert own test results" on public.test_results for insert with check (auth.uid() = user_id);
create policy "Anyone can read telemetry" on public.gas_telemetry for select using (true);
create policy "Anyone can read approved projects" on public.projects for select using (status = 'approved');
create policy "Users can insert projects" on public.projects for insert with check (auth.uid() = user_id);