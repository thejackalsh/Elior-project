import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { apiPing } from '../services/authService'

const SECURE_KEYS = {
  token: 'elior_auth_token',
  userId: 'elior_auth_user_id',
}

const STORAGE_KEYS = {
  name: '@elior_auth_name',
  email: '@elior_auth_email',
  visionStatus: '@elior_auth_vision_status',
}

export type VisionStatus = 'buta_total' | 'low_vision' | 'tidak_ada'

interface AuthState {
  token: string | null
  userId: string | null
  name: string | null
  email: string | null
  visionStatus: VisionStatus | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  setAuth: (token: string, userId: string, name: string) => Promise<void>
  updateProfile: (fields: { name?: string; email?: string; visionStatus?: VisionStatus }) => Promise<void>
  clearAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    userId: null,
    name: null,
    email: null,
    visionStatus: null,
    loading: true,
  })

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(SECURE_KEYS.token),
      SecureStore.getItemAsync(SECURE_KEYS.userId),
      AsyncStorage.multiGet([STORAGE_KEYS.name, STORAGE_KEYS.email, STORAGE_KEYS.visionStatus]),
    ]).then(([token, userId, entries]) => {
      const m = Object.fromEntries(entries) as Record<string, string | null>
      if (token) apiPing(token)
      setState({
        token,
        userId,
        name: m[STORAGE_KEYS.name] ?? null,
        email: m[STORAGE_KEYS.email] ?? null,
        visionStatus: (m[STORAGE_KEYS.visionStatus] as VisionStatus | null) ?? null,
        loading: false,
      })
    })
  }, [])

  const setAuth = async (token: string, userId: string, name: string) => {
    await Promise.all([
      SecureStore.setItemAsync(SECURE_KEYS.token, token),
      SecureStore.setItemAsync(SECURE_KEYS.userId, userId),
      AsyncStorage.setItem(STORAGE_KEYS.name, name),
    ])
    setState(s => ({ ...s, token, userId, name, loading: false }))
  }

  const updateProfile = async (fields: { name?: string; email?: string; visionStatus?: VisionStatus }) => {
    const pairs: [string, string][] = []
    if (fields.name != null) pairs.push([STORAGE_KEYS.name, fields.name])
    if (fields.email != null) pairs.push([STORAGE_KEYS.email, fields.email])
    if (fields.visionStatus != null) pairs.push([STORAGE_KEYS.visionStatus, fields.visionStatus])
    if (pairs.length) await AsyncStorage.multiSet(pairs)
    setState(s => ({
      ...s,
      name: fields.name ?? s.name,
      email: fields.email ?? s.email,
      visionStatus: fields.visionStatus ?? s.visionStatus,
    }))
  }

  const clearAuth = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_KEYS.token),
      SecureStore.deleteItemAsync(SECURE_KEYS.userId),
      AsyncStorage.multiRemove([STORAGE_KEYS.name, STORAGE_KEYS.email, STORAGE_KEYS.visionStatus]),
    ])
    setState({ token: null, userId: null, name: null, email: null, visionStatus: null, loading: false })
  }

  return (
    <AuthContext.Provider value={{ ...state, setAuth, updateProfile, clearAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
