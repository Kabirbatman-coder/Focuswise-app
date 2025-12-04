-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- User Tokens Table
create table if not exists user_tokens (
  user_id text primary key, -- Using text to match Google User ID string, or uuid if mapping internal users
  access_token text,
  refresh_token text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Calendar Events Table
create table if not exists calendar_events (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null references user_tokens(user_id) on delete cascade,
  google_event_id text unique not null,
  summary text,
  description text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  location text,
  html_link text,
  status text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexes
create index if not exists idx_calendar_events_user_id on calendar_events(user_id);
create index if not exists idx_calendar_events_start_time on calendar_events(start_time);

