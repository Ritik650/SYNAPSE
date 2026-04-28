import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/auth'

export function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('aarav@synapse.demo')
  const [password, setPassword] = useState('synapse-demo-2024')
  const [name, setName] = useState('Aarav Shah')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, name)
      }
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent mx-auto flex items-center justify-center mb-4">
            <span className="text-white font-mono text-xl font-semibold">S</span>
          </div>
          <h1 className="text-text-primary font-semibold text-xl">Synapse</h1>
          <p className="text-text-secondary text-sm mt-1">Your biology, finally understood.</p>
        </div>

        <div className="card p-6">
          {/* Mode toggle */}
          <div className="flex rounded-md bg-bg-elevated p-1 mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors capitalize ${
                  mode === m
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-text-secondary text-xs mb-1.5 block">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field w-full"
                  placeholder="Your name"
                  required
                />
              </div>
            )}
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field w-full"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field w-full"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <p className="text-text-secondary text-xs text-center">
              Demo: <span className="font-mono text-text-primary">aarav@synapse.demo</span> /{' '}
              <span className="font-mono text-text-primary">synapse-demo-2024</span>
            </p>
          </div>
        </div>

        <p className="text-text-secondary text-xs text-center mt-6 px-4">
          Synapse is informational only and is not a medical device. Always consult a licensed clinician for medical decisions.
        </p>
      </motion.div>
    </div>
  )
}
