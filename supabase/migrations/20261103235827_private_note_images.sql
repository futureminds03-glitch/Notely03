insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-images',
  'note-images',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload images into their own note folders"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'note-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users read images from their own note folders"
on storage.objects for select to authenticated
using (
  bucket_id = 'note-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users delete images from their own note folders"
on storage.objects for delete to authenticated
using (
  bucket_id = 'note-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
