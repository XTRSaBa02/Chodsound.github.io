-- ==============================================================================
-- Comprehensive Supabase Schema for ChodSound
-- ==============================================================================

-- 1. Profiles Table
create table profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  first_name text,
  last_name text,
  avatar_url text,
  cover_url text,
  updated_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check ((select auth.uid()) = id);
create policy "Users can update own profile." on profiles for update using ((select auth.uid()) = id);

-- 2. Tracks Table
create table tracks (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  artist text,
  cover text,
  duration integer, -- in seconds
  audio_url text not null,
  genre text,
  plays_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table tracks enable row level security;
create policy "Tracks are viewable by everyone." on tracks for select using (true);
create policy "Users can insert their own tracks." on tracks for insert with check ((select auth.uid()) = profile_id);
create policy "Users can update their own tracks." on tracks for update using ((select auth.uid()) = profile_id);
create policy "Users can delete their own tracks." on tracks for delete using ((select auth.uid()) = profile_id);

-- 3. Comments Table
create table comments (
  id uuid default gen_random_uuid() primary key,
  track_id uuid references tracks(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  timestamp float default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table comments enable row level security;
create policy "Comments are viewable by everyone." on comments for select using (true);
create policy "Users can insert comments." on comments for insert with check ((select auth.uid()) = profile_id);
create policy "Users can delete own comments." on comments for delete using ((select auth.uid()) = profile_id);

-- 4. Likes Table (for finding Liked Tracks and counts)
create table likes (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade not null,
  track_id uuid references tracks(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(profile_id, track_id)
);

alter table likes enable row level security;
create policy "Likes are viewable by everyone." on likes for select using (true);
create policy "Users can insert own likes." on likes for insert with check ((select auth.uid()) = profile_id);
create policy "Users can delete own likes." on likes for delete using ((select auth.uid()) = profile_id);

-- 5. Followers Table (for user relationships)
create table followers (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(follower_id, following_id)
);

alter table followers enable row level security;
create policy "Followers are viewable by everyone." on followers for select using (true);
create policy "Users can follow others." on followers for insert with check ((select auth.uid()) = follower_id);
create policy "Users can unfollow others." on followers for delete using ((select auth.uid()) = follower_id);

-- 6. Playlists Table
create table playlists (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  cover_url text,
  is_public boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table playlists enable row level security;
create policy "Public playlists are viewable by everyone." on playlists for select using (is_public = true);
create policy "Users can view own private playlists." on playlists for select using ((select auth.uid()) = profile_id);
create policy "Users can manage own playlists." on playlists for insert with check ((select auth.uid()) = profile_id);
create policy "Users can update own playlists." on playlists for update using ((select auth.uid()) = profile_id);
create policy "Users can delete own playlists." on playlists for delete using ((select auth.uid()) = profile_id);

-- 7. Playlist Tracks Table (mapping tracks to playlists)
create table playlist_tracks (
  id uuid default gen_random_uuid() primary key,
  playlist_id uuid references playlists(id) on delete cascade not null,
  track_id uuid references tracks(id) on delete cascade not null,
  added_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(playlist_id, track_id)
);

alter table playlist_tracks enable row level security;
create policy "Playlist tracks are viewable based on playlist visibility." on playlist_tracks for select using (
  exists (
    select 1 from playlists p
    where p.id = playlist_tracks.playlist_id
    and (p.is_public = true or p.profile_id = (select auth.uid()))
  )
);
create policy "Users can add to own playlists." on playlist_tracks for insert with check (
  exists (select 1 from playlists p where p.id = playlist_id and p.profile_id = (select auth.uid()))
);
create policy "Users can remove from own playlists." on playlist_tracks for delete using (
  exists (select 1 from playlists p where p.id = playlist_id and p.profile_id = (select auth.uid()))
);

-- 8. Functions & RPCs
create or replace function increment_plays(track_id uuid)
returns void as $$
begin
  update tracks
  set plays_count = plays_count + 1
  where id = track_id;
end;
$$ language plpgsql security definer;

-- ==============================================================================
-- Storage Setup
-- ==============================================================================

insert into storage.buckets (id, name, public) values ('audio', 'audio', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('covers', 'covers', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;

create policy "Audio files are public" on storage.objects for select using ( bucket_id = 'audio' );
create policy "Covers are public" on storage.objects for select using ( bucket_id = 'covers' );
create policy "Avatars are public" on storage.objects for select using ( bucket_id = 'avatars' );

create policy "Authenticated users can upload files" on storage.objects for insert with check ( auth.role() = 'authenticated' );
create policy "Users can update their own files" on storage.objects for update using ( auth.uid() = owner );
create policy "Users can delete their own files" on storage.objects for delete using ( auth.uid() = owner );
