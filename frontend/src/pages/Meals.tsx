import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Shell } from '../components/layout/Shell'
import { Card } from '../components/ui/Card'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { recordsApi } from '../lib/api'
import { Camera } from 'lucide-react'

interface MealRecord {
  id: string
  ts: string
  photo_url?: string
  calories_est?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
  notes?: string
  analysis?: {
    items_identified?: string[]
    what_is_great?: string
    what_is_missing?: string
    next_meal_balance?: string
    glycemic_load_estimate?: string
  }
}

function MacroBar({ label, value, max, color }: { label: string; value?: number; max: number; color: string }) {
  const pct = Math.min(100, ((value ?? 0) / max) * 100)
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="font-mono text-text-primary">{Math.round(value ?? 0)}g</span>
      </div>
      <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function MealCard({ meal }: { meal: MealRecord }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card border border-border-subtle overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Photo placeholder */}
          <div className="w-16 h-16 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0 overflow-hidden">
            {meal.photo_url ? (
              <img src={meal.photo_url} alt="Meal" className="w-full h-full object-cover" />
            ) : (
              <Camera size={20} className="text-text-secondary" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="text-text-secondary text-xs">
                {format(new Date(meal.ts), 'MMM d, yyyy · h:mm a')}
              </div>
              {meal.calories_est && meal.calories_est > 0 && (
                <span className="font-mono text-sm text-text-primary font-semibold">
                  {Math.round(meal.calories_est)} kcal
                </span>
              )}
            </div>

            {meal.analysis?.items_identified?.length ? (
              <div className="flex flex-wrap gap-1 mb-2">
                {meal.analysis.items_identified.slice(0, 5).map((item, i) => (
                  <span key={i} className="text-xs bg-bg-elevated text-text-secondary px-2 py-0.5 rounded-full">
                    {item}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Macros */}
            {(meal.protein_g || meal.carbs_g || meal.fat_g) && (
              <div className="grid grid-cols-3 gap-3 mt-2">
                <MacroBar label="Protein" value={meal.protein_g} max={80} color="#3B82F6" />
                <MacroBar label="Carbs" value={meal.carbs_g} max={120} color="#F59E0B" />
                <MacroBar label="Fat" value={meal.fat_g} max={60} color="#EF4444" />
              </div>
            )}
          </div>
        </div>

        {/* AI insights */}
        {meal.analysis?.what_is_great && (
          <div className="mt-3 pt-3 border-t border-border-subtle space-y-1">
            <p className="text-xs text-success">✓ {meal.analysis.what_is_great}</p>
            {meal.analysis.what_is_missing && (
              <p className="text-xs text-warn">↑ {meal.analysis.what_is_missing}</p>
            )}
            {meal.analysis.next_meal_balance && (
              <p className="text-xs text-accent-soft">→ Next: {meal.analysis.next_meal_balance}</p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function Meals() {
  const { data: meals, isLoading } = useQuery({
    queryKey: ['meals'],
    queryFn: () => recordsApi.meals.list().then(r => r.data as MealRecord[]),
  })

  const totalCals = meals?.reduce((sum, m) => sum + (m.calories_est ?? 0), 0) ?? 0
  const avgCals = meals?.length ? Math.round(totalCals / meals.length) : 0

  return (
    <Shell title="Meals">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Stats */}
        {meals?.length ? (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Meals logged', value: meals.length },
              { label: 'Avg calories', value: `${avgCals} kcal` },
              { label: 'AI analysed', value: meals.filter(m => m.analysis).length },
            ].map(({ label, value }) => (
              <div key={label} className="card p-4 text-center">
                <div className="font-mono text-2xl text-text-primary font-semibold">{value}</div>
                <div className="text-text-secondary text-xs mt-1">{label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Meals list */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Shimmer key={i} className="h-32 rounded-lg" />)}
          </div>
        ) : meals?.length === 0 ? (
          <div className="text-center py-16 text-text-secondary">
            <Camera size={36} className="mx-auto mb-3" />
            <p className="text-sm">No meals logged yet.</p>
            <p className="text-xs mt-1">Upload a meal photo via the API to see AI nutrition analysis.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {meals?.map(m => <MealCard key={m.id} meal={m} />)}
          </div>
        )}

        <p className="safety-footer text-center">
          Calorie and macro estimates are approximate. Consult a dietitian for precise nutrition planning.
        </p>
      </div>
    </Shell>
  )
}
