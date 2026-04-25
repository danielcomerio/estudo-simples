'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
  revalidatePath('/', 'layout');
  redirect(next);
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const password2 = String(formData.get('password2') || '');

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

  // Se a confirmação de email estiver desligada no Supabase, já vem session.
  if (data.session) {
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
