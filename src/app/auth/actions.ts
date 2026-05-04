'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

const GUEST_COOKIE = 'es-guest';
const MIGRATE_COOKIE = 'es-migrate-guest';

export type AuthState = { error: string | null; message: string | null };

const initial: AuthState = { error: null, message: null };

function safeNext(input: FormDataEntryValue | null): string {
  const s = typeof input === 'string' ? input : '';
  // só permite paths internos
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  return '/';
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const next = safeNext(formData.get('next'));

  if (!email || !password) {
    return { ...initial, error: 'Preencha email e senha.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ...initial, error: traduzirErroAuth(error.message) };
  }
  // Login pra conta existente: NUNCA migra dados de visitante (user
  // pediu explicitamente — risco de poluir conta com lixo de demos).
  // Limpa flag de visitante pra hydrate detectar troca e zerar local.
  const c = await cookies();
  c.delete(GUEST_COOKIE);
  c.delete(MIGRATE_COOKIE);
  revalidatePath('/', 'layout');
  redirect(next);
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const password2 = String(formData.get('password2') || '');
  const wantsMigrate = formData.get('migrate') === '1';

  if (!email || !password) return { ...initial, error: 'Preencha email e senha.' };
  if (password.length < 8) return { ...initial, error: 'Senha deve ter ao menos 8 caracteres.' };
  if (password !== password2) return { ...initial, error: 'Senhas não coincidem.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo:
        (process.env.NEXT_PUBLIC_SITE_URL || '') + '/auth/callback',
    },
  });
  if (error) return { ...initial, error: traduzirErroAuth(error.message) };

  const c = await cookies();
  // Se confirmação de email estiver desligada, já vem session → auto-login.
  if (data.session) {
    if (wantsMigrate) {
      // Sinaliza pro StoreProvider migrar dados do guest local pra
      // nova conta (lê via document.cookie no client; expires curto).
      c.set(MIGRATE_COOKIE, '1', {
        path: '/',
        maxAge: 60 * 5,
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    } else {
      // User pediu pra NÃO migrar — limpa cookie guest pra hydrate
      // detectar troca e zerar local.
      c.delete(GUEST_COOKIE);
    }
    revalidatePath('/', 'layout');
    redirect('/');
  }
  return {
    ...initial,
    message:
      'Conta criada. Confira seu email para confirmar o cadastro e depois faça login.',
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // limpa também o flag de visitante (caso esteja setado)
  const c = await cookies();
  c.delete(GUEST_COOKIE);
  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * Entra como visitante: seta cookie e redireciona pra home.
 * Os dados ficam só no navegador (IDB + localStorage). Sync desligado.
 * O cookie expira em 365 dias (o usuário ainda pode "sair" pra limpar).
 */
export async function enterAsGuest() {
  const c = await cookies();
  c.set(GUEST_COOKIE, '1', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false, // pode ser lido pelo client se quisermos
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function exitGuest() {
  const c = await cookies();
  c.delete(GUEST_COOKIE);
  revalidatePath('/', 'layout');
  redirect('/login');
}

function traduzirErroAuth(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Credenciais inválidas.';
  if (m.includes('user already registered')) return 'Email já cadastrado. Use a tela de login.';
  if (m.includes('email not confirmed')) return 'Confirme o email antes de fazer login.';
  if (m.includes('rate limit')) return 'Muitas tentativas; aguarde alguns segundos.';
  if (m.includes('password should be at least')) return 'Senha muito curta (mín. 8 caracteres).';
  return msg;
}
