-- Esquema de la demo en Supabase.
-- Todas las operaciones de escritura pasan por la API de Vercel.
begin;

create table public.portal_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  email text not null unique,
  role text not null check (role in ('owner','editor','approver')),
  active boolean not null default true
);

create table public.portal_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 140),
  summary text not null check (length(summary) between 1 and 280),
  body text not null check (length(body) between 1 and 8000),
  category text not null check (category in ('Clases','Evaluaciones','Salas','Convocatorias','General')),
  priority text not null default 'normal' check (priority in ('normal','urgent')),
  status text not null default 'draft' check (status in ('draft','pending','rejected','published','archived')),
  "eventDate" text not null default '',
  "authorId" uuid references public.portal_profiles(id),
  "authorName" text not null default 'Ejemplo inicial',
  "reviewerId" uuid references public.portal_profiles(id),
  "rejectionNote" text not null default '',
  "submittedAt" timestamptz,
  "publishedAt" timestamptz,
  "updatedAt" timestamptz not null default now(),
  demo boolean not null default false
);

create index portal_announcements_public on public.portal_announcements ("publishedAt" desc) where status='published';
create index portal_announcements_author on public.portal_announcements ("authorId");
create index portal_announcements_reviewer on public.portal_announcements ("reviewerId");

create table public.portal_email_subscriptions (
  email text primary key,
  categories text[] not null,
  confirmed boolean not null default false,
  "confirmToken" text unique,
  "unsubscribeToken" text not null unique,
  "updatedAt" timestamptz not null default now()
);

create table public.portal_push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  categories text[] not null,
  "updatedAt" timestamptz not null default now()
);

create table public.portal_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.portal_announcements(id) on delete cascade,
  channel text not null check (channel in ('email','push')),
  recipient text not null,
  state text not null default 'pending' check (state in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now(),
  unique (announcement_id,channel,recipient)
);
create index portal_delivery_pending on public.portal_delivery_jobs (announcement_id,state);

alter table public.portal_profiles enable row level security;
alter table public.portal_announcements enable row level security;
alter table public.portal_email_subscriptions enable row level security;
alter table public.portal_push_subscriptions enable row level security;
alter table public.portal_delivery_jobs enable row level security;
revoke all on public.portal_profiles, public.portal_announcements, public.portal_email_subscriptions, public.portal_push_subscriptions, public.portal_delivery_jobs from anon, authenticated;
grant select,insert,update,delete on public.portal_profiles, public.portal_announcements, public.portal_email_subscriptions, public.portal_push_subscriptions, public.portal_delivery_jobs to service_role;

-- Flujo editorial:
-- editor = Secretaría. Puede crear, editar, publicar directamente o solicitar revisión.
-- approver = Aprobador. Solo interviene cuando Secretaría envía un aviso a revisión.
-- owner = Administración. Gestiona cuentas y puede intervenir en el contenido.
create function public.portal_edit_notice(actor uuid, notice_id uuid, action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  person public.portal_profiles;
  item public.portal_announcements;
  reviewer boolean;
  publisher boolean;
  owns_notice boolean;
  reviewed_publish boolean;
begin
  select * into person from public.portal_profiles where id=actor and active;
  if person.id is null then raise exception 'Acceso no autorizado' using errcode='42501'; end if;

  reviewer := person.role in ('owner','approver');
  publisher := person.role in ('owner','editor');

  if action='create' then
    if not publisher then raise exception 'Acción no permitida en el estado actual' using errcode='42501'; end if;
    insert into public.portal_announcements (title,summary,body,category,priority,"eventDate","authorId","authorName")
    values (payload->>'title',payload->>'summary',payload->>'body',payload->>'category',payload->>'priority',coalesce(payload->>'eventDate',''),actor,person.name)
    returning * into item;
    return to_jsonb(item);
  end if;

  select * into item from public.portal_announcements where id=notice_id for update;
  if item.id is null then raise exception 'Aviso no encontrado' using errcode='P0002'; end if;
  owns_notice := item."authorId"=actor;

  if action='edit' and publisher and (owns_notice or person.role='owner') and item.status in ('draft','rejected') then
    update public.portal_announcements
      set title=payload->>'title', summary=payload->>'summary', body=payload->>'body', category=payload->>'category', priority=payload->>'priority', "eventDate"=coalesce(payload->>'eventDate',''), status='draft', "rejectionNote"='', "updatedAt"=now()
      where id=notice_id returning * into item;

  elsif action='submit' and publisher and (owns_notice or person.role='owner') and item.status in ('draft','rejected') then
    update public.portal_announcements
      set status='pending', "submittedAt"=now(), "updatedAt"=now(), "rejectionNote"=''
      where id=notice_id returning * into item;

  elsif action='approve' and (
      (publisher and (owns_notice or person.role='owner') and item.status in ('draft','rejected'))
      or (publisher and owns_notice and item.status='pending')
      or (reviewer and not owns_notice and item.status='pending')
    ) then
    reviewed_publish := item.status='pending' and reviewer and not owns_notice;
    update public.portal_announcements
      set status='published',
          "reviewerId"=case when reviewed_publish then actor else null end,
          "publishedAt"=now(),
          "updatedAt"=now(),
          "rejectionNote"=''
      where id=notice_id returning * into item;
    insert into public.portal_delivery_jobs (announcement_id,channel,recipient)
      select item.id,'email',email from public.portal_email_subscriptions where confirmed and item.category=any(categories)
      union all
      select item.id,'push',endpoint from public.portal_push_subscriptions where item.category=any(categories)
      on conflict do nothing;

  elsif action='reject' and reviewer and not owns_notice and item.status='pending' and length(trim(coalesce(payload->>'note',''))) between 1 and 500 then
    update public.portal_announcements
      set status='rejected', "reviewerId"=actor, "rejectionNote"=trim(payload->>'note'), "updatedAt"=now()
      where id=notice_id returning * into item;

  elsif action='archive' and (person.role='owner' or (person.role='editor' and owns_notice)) and item.status='published' then
    update public.portal_announcements set status='archived', "updatedAt"=now() where id=notice_id returning * into item;

  elsif action='delete' and (person.role='owner' or (person.role='editor' and owns_notice)) and item.status in ('draft','rejected') then
    delete from public.portal_announcements where id=notice_id;
    return jsonb_build_object('deleted',true);

  else
    raise exception 'Acción no permitida en el estado actual' using errcode='42501';
  end if;

  return to_jsonb(item);
end;
$$;

revoke all on function public.portal_edit_notice(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.portal_edit_notice(uuid,uuid,text,jsonb) to service_role;
commit;