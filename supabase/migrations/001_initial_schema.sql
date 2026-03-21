-- Colorado Home Search — Database Schema
-- Run this in the Supabase SQL editor to set up all tables

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  display_name text,
  avatar_url text,
  is_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PROPERTIES (core listing data)
-- ============================================================
create table public.properties (
  id uuid default uuid_generate_v4() primary key,

  -- Location
  address text not null,
  city text not null,
  state text default 'CO',
  zip text,
  neighborhood text,
  latitude double precision,
  longitude double precision,

  -- Listing details
  price numeric(10,2),
  price_previous numeric(10,2),
  bedrooms integer,
  bathrooms numeric(3,1),
  sqft integer,
  lot_size_acres numeric(6,4),
  lot_size_sqft integer,
  year_built integer,

  -- Key features
  property_type text, -- 'single_family', 'townhome', 'condo', 'apartment', 'duplex'
  dogs_allowed boolean,
  dogs_policy text, -- 'allowed', 'restricted', 'not_allowed', 'unknown'
  has_backyard boolean,
  backyard_details text,
  has_garage boolean,
  garage_spaces integer,

  -- Images
  images jsonb default '[]'::jsonb, -- [{url, alt, source, width, height}]
  thumbnail_url text,

  -- Source
  source text not null, -- 'zillow', 'craigslist', 'redfin', 'manual', etc.
  source_url text,
  source_listing_id text,

  -- Dates
  date_posted timestamptz,
  date_updated timestamptz,
  availability_date date,

  -- Scoring
  match_score integer default 0, -- 0-100
  score_breakdown jsonb default '{}'::jsonb,

  -- Status
  status text default 'active', -- 'active', 'pending', 'rented', 'removed'
  is_price_drop boolean default false,

  -- Metadata
  raw_data jsonb default '{}'::jsonb, -- Original data from source
  inferred_fields jsonb default '[]'::jsonb, -- Which fields were estimated

  -- Dedup
  address_hash text, -- normalized address for dedup

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Constraints
  unique(address_hash, source)
);

-- Indexes
create index idx_properties_city on public.properties(city);
create index idx_properties_price on public.properties(price);
create index idx_properties_score on public.properties(match_score desc);
create index idx_properties_status on public.properties(status);
create index idx_properties_source on public.properties(source);
create index idx_properties_created on public.properties(created_at desc);
create index idx_properties_address_hash on public.properties(address_hash);
create index idx_properties_location on public.properties(latitude, longitude);

alter table public.properties enable row level security;

-- Properties are readable by all authenticated users
create policy "Authenticated users can view properties"
  on public.properties for select using (auth.role() = 'authenticated');

-- Only service role can insert/update (via serverless functions)
create policy "Service role can manage properties"
  on public.properties for all using (auth.role() = 'service_role');

-- Authenticated users can insert (for manual import)
create policy "Authenticated users can insert properties"
  on public.properties for insert with check (auth.role() = 'authenticated');

-- ============================================================
-- USER_PROPERTIES (per-user favorites, notes, hidden)
-- ============================================================
create table public.user_properties (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,

  is_favorite boolean default false,
  is_hidden boolean default false,
  notes text,
  tags text[] default '{}',

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, property_id)
);

create index idx_user_properties_user on public.user_properties(user_id);
create index idx_user_properties_favorite on public.user_properties(user_id, is_favorite) where is_favorite = true;

alter table public.user_properties enable row level security;

create policy "Users can manage own property data"
  on public.user_properties for all using (auth.uid() = user_id);

-- ============================================================
-- SCORING_WEIGHTS (configurable per user)
-- ============================================================
create table public.scoring_weights (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique not null,

  weights jsonb default '{
    "dogs_allowed": 15,
    "backyard": 15,
    "garage": 10,
    "bedrooms": 10,
    "lot_size": 15,
    "property_type": 10,
    "privacy_proxy": 10,
    "value_score": 10,
    "density": 5
  }'::jsonb,

  -- Exclusion toggles
  exclude_no_dogs boolean default true,
  exclude_no_backyard boolean default true,
  exclude_no_garage boolean default true,
  exclude_under_3br boolean default true,

  -- Filter defaults
  min_price numeric(10,2),
  max_price numeric(10,2) default 4000,
  min_bedrooms integer default 3,
  cities text[] default '{"Parker","Castle Pines","Castle Rock","Highlands Ranch"}',
  property_types text[] default '{"single_family","townhome"}',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.scoring_weights enable row level security;

create policy "Users can manage own weights"
  on public.scoring_weights for all using (auth.uid() = user_id);

-- ============================================================
-- SOURCE_CONFIG (admin: toggle sources, store API config)
-- ============================================================
create table public.source_config (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,

  source_name text not null, -- 'craigslist', 'rapidapi_realtor', etc.
  is_enabled boolean default true,
  config jsonb default '{}'::jsonb, -- source-specific config (search URLs, etc.)
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_count integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, source_name)
);

alter table public.source_config enable row level security;

create policy "Users can manage own source config"
  on public.source_config for all using (auth.uid() = user_id);

-- ============================================================
-- ALERTS (new listings, price drops, status changes)
-- ============================================================
create table public.alerts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,

  alert_type text not null, -- 'new_listing', 'price_drop', 'status_change'
  message text,
  metadata jsonb default '{}'::jsonb, -- e.g., {old_price, new_price}
  is_read boolean default false,

  created_at timestamptz default now()
);

create index idx_alerts_user on public.alerts(user_id, is_read, created_at desc);

alter table public.alerts enable row level security;

create policy "Users can manage own alerts"
  on public.alerts for all using (auth.uid() = user_id);

-- ============================================================
-- SYNC_LOG (audit trail for automated sync)
-- ============================================================
create table public.sync_log (
  id uuid default uuid_generate_v4() primary key,

  source text not null,
  status text not null, -- 'success', 'partial', 'error'
  listings_found integer default 0,
  listings_new integer default 0,
  listings_updated integer default 0,
  listings_excluded integer default 0,
  error_message text,
  duration_ms integer,

  created_at timestamptz default now()
);

-- No RLS on sync_log — only service role writes, users can read
alter table public.sync_log enable row level security;

create policy "Authenticated users can view sync log"
  on public.sync_log for select using (auth.role() = 'authenticated');

create policy "Service role can manage sync log"
  on public.sync_log for all using (auth.role() = 'service_role');

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Normalize address for dedup
create or replace function normalize_address(addr text)
returns text as $$
begin
  return lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(addr, '\s+', ' ', 'g'),  -- collapse whitespace
        '[.,#]', '', 'g'                          -- remove punctuation
      ),
      '\m(street|st|avenue|ave|boulevard|blvd|drive|dr|lane|ln|road|rd|court|ct|circle|cir|place|pl|way)\M',
      '', 'gi'                                    -- remove street suffixes
    )
  );
end;
$$ language plpgsql immutable;

-- Auto-set address_hash on insert/update
create or replace function set_address_hash()
returns trigger as $$
begin
  new.address_hash := normalize_address(new.address || ' ' || new.city || ' ' || coalesce(new.zip, ''));
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger properties_set_hash
  before insert or update on public.properties
  for each row execute function set_address_hash();

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger user_properties_updated
  before update on public.user_properties
  for each row execute function update_updated_at();

create trigger scoring_weights_updated
  before update on public.scoring_weights
  for each row execute function update_updated_at();

create trigger source_config_updated
  before update on public.source_config
  for each row execute function update_updated_at();
