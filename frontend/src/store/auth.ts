import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../lib/types'
import { setToken, clearToken, authApi } from '../lib/api'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const res = await authApi.login(email, password)
        const token = res.data.access_token
        setToken(token)
        set({ token, isAuthenticated: true })
        await get().fetchMe()
      },

      register: async (email, password, name) => {
        const res = await authApi.register(email, password, name)
        const token = res.data.access_token
        setToken(token)
        set({ token, isAuthenticated: true })
        await get().fetchMe()
      },

      logout: () => {
        clearToken()
        set({ user: null, token: null, isAuthenticated: false })
      },

      fetchMe: async () => {
        try {
          const res = await authApi.me()
          set({ user: res.data })
        } catch {
          get().logout()
        }
      },
    }),
    {
      name: 'synapse-auth',
      partialize: (state) => ({ token: state.token, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          setToken(state.token)
          state.fetchMe()
        }
      },
    }
  )
)
