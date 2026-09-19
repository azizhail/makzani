create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'مستخدم',
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null default 'trial',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'cashier')),
  created_at timestamptz not null default now(),
  unique (shop_id, user_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  sku text,
  category text,
  price numeric(12,2) not null default 0,
  stock numeric(12,2) not null default 0,
  threshold numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text,
  city text,
  total_orders integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text,
  category text,
  balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric(12,2) not null default 0,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid numeric(12,2) not null default 0,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  sale_type text default 'مبيع',
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  quantity numeric(12,2) not null default 0,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null default 0,
  category text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.cash_flow (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  type text not null check (type in ('إيداع', 'سحب')),
  amount numeric(12,2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_shop_id uuid;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'مستخدم'))
  on conflict (id) do nothing;

  insert into public.shops (name, owner_id)
  values ('متجر ' || coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), new.id)
  returning id into new_shop_id;

  insert into public.shop_members (shop_id, user_id, role)
  values (new_shop_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.current_user_shop_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select shop_id
  from public.shop_members
  where user_id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.purchases enable row level security;
alter table public.expenses enable row level security;
alter table public.cash_flow enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (id = auth.uid());

create policy "Profiles can be updated by self"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Shop members can read shops"
  on public.shops for select
  using (id in (select public.current_user_shop_ids()));

create policy "Owner can create shop"
  on public.shops for insert
  with check (owner_id = auth.uid());

create policy "Shop owner or manager can update shop"
  on public.shops for update
  using (owner_id = auth.uid() or id in (
    select shop_id from public.shop_members where user_id = auth.uid() and role in ('owner','manager')
  ));

create policy "Shop members can read memberships"
  on public.shop_members for select
  using (shop_id in (select public.current_user_shop_ids()));

create policy "Owner can manage memberships"
  on public.shop_members for all
  using (shop_id in (
    select shop_id from public.shop_members where user_id = auth.uid() and role = 'owner'
  ))
  with check (shop_id in (
    select shop_id from public.shop_members where user_id = auth.uid() and role = 'owner'
  ));

create policy "Users can read all tenant data"
  on public.products for select
  using (shop_id in (select public.current_user_shop_ids()));

create policy "Users can insert all tenant data"
  on public.products for insert
  with check (shop_id in (select public.current_user_shop_ids()));

create policy "Users can update all tenant data"
  on public.products for update
  using (shop_id in (select public.current_user_shop_ids()))
  with check (shop_id in (select public.current_user_shop_ids()));

create policy "Users can delete all tenant data"
  on public.products for delete
  using (shop_id in (select public.current_user_shop_ids()));

create policy "Users can read customers"
  on public.customers for select
  using (shop_id in (select public.current_user_shop_ids()));
create policy "Users can insert customers"
  on public.customers for insert
  with check (shop_id in (select public.current_user_shop_ids()));
create policy "Users can update customers"
  on public.customers for update
  using (shop_id in (select public.current_user_shop_ids()))
  with check (shop_id in (select public.current_user_shop_ids()));
create policy "Users can delete customers"
  on public.customers for delete
  using (shop_id in (select public.current_user_shop_ids()));

create policy "Users can read suppliers"
  on public.suppliers for select
  using (shop_id in (select public.current_user_shop_ids()));
create policy "Users can insert suppliers"
  on public.suppliers for insert
  with check (shop_id in (select public.current_user_shop_ids()));
create policy "Users can update suppliers"
  on public.suppliers for update
  using (shop_id in (select public.current_user_shop_ids()))
  with check (shop_id in (select public.current_user_shop_ids()));
create policy "Users can delete suppliers"
  on public.suppliers for delete
  using (shop_id in (select public.current_user_shop_ids()));

create policy "Users can read sales"
  on public.sales for select
  using (shop_id in (select public.current_user_shop_ids()));
create policy "Users can insert sales"
  on public.sales for insert
  with check (shop_id in (select public.current_user_shop_ids()));
create policy "Users can update sales"
  on public.sales for update
  using (shop_id in (select public.current_user_shop_ids()))
  with check (shop_id in (select public.current_user_shop_ids()));
create policy "Users can delete sales"
  on public.sales for delete
  using (shop_id in (select public.current_user_shop_ids()));

create policy "Users can read purchases"
  on public.purchases for select
  using (shop_id in (select public.current_user_shop_ids()));
create policy "Users can insert purchases"
  on public.purchases for insert
  with check (shop_id in (select public.current_user_shop_ids()));
create policy "Users can update purchases"
  on public.purchases for update
  using (shop_id in (select public.current_user_shop_ids()))
  with check (shop_id in (select public.current_user_shop_ids()));
create policy "Users can delete purchases"
  on public.purchases for delete
  using (shop_id in (select public.current_user_shop_ids()));

create policy "Users can read expenses"
  on public.expenses for select
  using (shop_id in (select public.current_user_shop_ids()));
create policy "Users can insert expenses"
  on public.expenses for insert
  with check (shop_id in (select public.current_user_shop_ids()));
create policy "Users can update expenses"
  on public.expenses for update
  using (shop_id in (select public.current_user_shop_ids()))
  with check (shop_id in (select public.current_user_shop_ids()));
create policy "Users can delete expenses"
  on public.expenses for delete
  using (shop_id in (select public.current_user_shop_ids()));

create policy "Users can read cash flow"
  on public.cash_flow for select
  using (shop_id in (select public.current_user_shop_ids()));
create policy "Users can insert cash flow"
  on public.cash_flow for insert
  with check (shop_id in (select public.current_user_shop_ids()));
create policy "Users can update cash flow"
  on public.cash_flow for update
  using (shop_id in (select public.current_user_shop_ids()))
  with check (shop_id in (select public.current_user_shop_ids()));
create policy "Users can delete cash flow"
  on public.cash_flow for delete
  using (shop_id in (select public.current_user_shop_ids()));

create index if not exists idx_products_shop_id on public.products(shop_id);
create index if not exists idx_sales_shop_id on public.sales(shop_id);
create index if not exists idx_purchases_shop_id on public.purchases(shop_id);
create index if not exists idx_expenses_shop_id on public.expenses(shop_id);
create index if not exists idx_cash_flow_shop_id on public.cash_flow(shop_id);
create index if not exists idx_customers_shop_id on public.customers(shop_id);
create index if not exists idx_suppliers_shop_id on public.suppliers(shop_id);
create index if not exists idx_shop_members_shop_id on public.shop_members(shop_id);

create or replace view public.shop_summary as
select
  s.id as shop_id,
  s.name as shop_name,
  count(distinct sm.user_id) as members_count,
  count(distinct p.id) as products_count,
  count(distinct c.id) as customers_count,
  coalesce(sum(case when sa.total is not null then sa.total else 0 end), 0) as total_revenue
from public.shops s
left join public.shop_members sm on sm.shop_id = s.id
left join public.products p on p.shop_id = s.id
left join public.customers c on c.shop_id = s.id
left join public.sales sa on sa.shop_id = s.id
group by s.id, s.name;
