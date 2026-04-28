import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { Dashboard } from './pages/Dashboard'
import { Auth } from './pages/Auth'
import { Placeholder } from './pages/Placeholder'
import { Timeline } from './pages/Timeline'
import { Patterns } from './pages/Patterns'
import { Whispers } from './pages/Whispers'
import { BodyTwin } from './pages/BodyTwin'
import { Sleep } from './pages/Sleep'
import { Recovery } from './pages/Recovery'
import { Mind } from './pages/Mind'
import { Meals } from './pages/Meals'
import { Symptoms } from './pages/Symptoms'
import { Labs } from './pages/Labs'
import { Medications } from './pages/Medications'
import { Simulator } from './pages/Simulator'
import { DoctorMode } from './pages/DoctorMode'
import { CareCircle } from './pages/CareCircle'
import { Settings } from './pages/Settings'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/timeline" element={<RequireAuth><Timeline /></RequireAuth>} />
      <Route path="/patterns" element={<RequireAuth><Patterns /></RequireAuth>} />
      <Route path="/whispers" element={<RequireAuth><Whispers /></RequireAuth>} />
      <Route path="/body" element={<RequireAuth><BodyTwin /></RequireAuth>} />
      <Route path="/sleep" element={<RequireAuth><Sleep /></RequireAuth>} />
      <Route path="/recovery" element={<RequireAuth><Recovery /></RequireAuth>} />
      <Route path="/mind" element={<RequireAuth><Mind /></RequireAuth>} />
      <Route path="/meals" element={<RequireAuth><Meals /></RequireAuth>} />
      <Route path="/symptoms" element={<RequireAuth><Symptoms /></RequireAuth>} />
      <Route path="/labs" element={<RequireAuth><Labs /></RequireAuth>} />
      <Route path="/medications" element={<RequireAuth><Medications /></RequireAuth>} />
      <Route path="/simulate" element={<RequireAuth><Simulator /></RequireAuth>} />
      <Route path="/doctor" element={<RequireAuth><DoctorMode /></RequireAuth>} />
      <Route path="/care-circle" element={<RequireAuth><CareCircle /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
