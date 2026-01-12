-- SQL for Admin Role Detection and Dashboard Visibility Fixes
-- Run these commands in your Supabase SQL Editor

-- 1. Create user_roles table if not exists
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  unique (user_id, role)
);

-- 2. Trigger function to insert default role
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Only insert if not already present
  if not exists (
    select 1 from public.user_roles where user_id = new.id and role = 'student'
  ) then
    insert into public.user_roles (user_id, role) values (new.id, 'student');
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 3. Trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 4. Enable RLS on tutor_applications
alter table public.tutor_applications enable row level security;

-- 5. Admin Policy (see all)
create policy "Admins can view all applications"
on public.tutor_applications
for select
using (
  exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  )
);

-- 6. Student Policy (see own)
create policy "Students can view their own applications"
on public.tutor_applications
for select
using (
  user_id = auth.uid()
);

-- 7. Verification Query: Check roles exist
-- select * from public.user_roles;