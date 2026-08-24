import { serviceConfig } from '../config'

export interface AuthUser {
  access_token: string
  user_id: string
  name: string
  is_new?: boolean
}

export async function apiLogin(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${serviceConfig.authUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const code = (err as any).code
    if (code === 'akun_dibanned') throw Object.assign(new Error('Akun kamu dinonaktifkan oleh admin.'), { code })
    throw new Error((err as any).detail ?? 'Login gagal')
  }
  return res.json()
}

export async function apiRegister(name: string, email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${serviceConfig.authUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const code = (err as any).code
    if (code === 'registrasi_ditutup') throw Object.assign(new Error('Pendaftaran sedang ditutup sementara. Coba lagi nanti.'), { code })
    throw new Error((err as any).detail ?? 'Registrasi gagal')
  }
  return res.json()
}

export async function apiUpdateName(token: string, name: string): Promise<void> {
  const res = await fetch(`${serviceConfig.authUrl}/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).detail ?? 'Gagal update nama')
  }
}

export type VisionStatus = 'buta_total' | 'low_vision' | 'tidak_ada'

export async function apiUpdateVisionStatus(token: string, visionStatus: VisionStatus): Promise<void> {
  const res = await fetch(`${serviceConfig.authUrl}/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ vision_status: visionStatus }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).detail ?? 'Gagal menyimpan status penglihatan')
  }
}

export async function apiPing(token: string): Promise<void> {
  fetch(`${serviceConfig.authUrl}/me/ping`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}

export async function apiGoogleLogin(accessToken: string): Promise<AuthUser> {
  const res = await fetch(`${serviceConfig.authUrl}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const code = (err as any).code
    if (code === 'akun_dibanned') throw Object.assign(new Error('Akun kamu dinonaktifkan oleh admin.'), { code })
    if (code === 'registrasi_ditutup') throw Object.assign(new Error('Pendaftaran sedang ditutup sementara. Coba lagi nanti.'), { code })
    throw new Error((err as any).detail ?? 'Google login gagal')
  }
  return res.json()
}
