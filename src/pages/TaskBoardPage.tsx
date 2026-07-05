import { useMemo, useState } from 'react'
import { Plus, CheckCircle2, Circle, Trash2, Clock, Star } from 'lucide-react'
import { format, isValid } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'
import { getPriorityLabel, getPriorityColor } from '@/services/aiScheduler'
import { DisciplineBanner } from '@/components/discipline/DisciplineBanner'
import { PlanningDatePicker } from '@/components/discipline/PlanningDatePicker'
import { useDisciplineForDate } from '@/hooks/useDisciplineForDate'
import { DISCIPLINE_LOCK_MSG, isTodayDateKey } from '@/lib/disciplineMode'

export function TaskBoardPage() {
  const selectedDate = useAppStore((s) => s.selectedDate)
  const allTasks = useAppStore((s) => s.tasks)
  const notes = useAppStore((s) => s.notes)
  const addTask = useAppStore((s) => s.addTask)
  const updateTask = useAppStore((s) => s.updateTask)
  const deleteTask = useAppStore((s) => s.deleteTask)
  const upsertNote = useAppStore((s) => s.upsertNote)

  const [newTitle, setNewTitle] = useState('')
  const [disciplineHint, setDisciplineHint] = useState<string | null>(null)

  const {
    disciplineModeEnabled,
    locked,
    lockedAt,
    lockPlanForDate,
  } = useDisciplineForDate(selectedDate)

  const tasks = useMemo(
    () => allTasks.filter((t) => t.date === selectedDate),
    [allTasks, selectedDate],
  )

  const note = useMemo(
    () => notes.find((n) => n.date === selectedDate),
    [notes, selectedDate],
  )

  const dateObj = new Date(`${selectedDate}T12:00:00`)
  const formattedDate = isValid(dateObj)
    ? format(dateObj, 'yyyy年M月d日 EEEE', { locale: zhCN })
    : format(new Date(), 'yyyy年M月d日 EEEE', { locale: zhCN })

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    if (locked) {
      setDisciplineHint(DISCIPLINE_LOCK_MSG)
      return
    }
    const created = addTask({
      title: newTitle.trim(),
      date: selectedDate,
      estimatedMinutes: 30,
      importance: 3,
      urgency: 3,
    })
    if (!created) {
      setDisciplineHint(DISCIPLINE_LOCK_MSG)
      return
    }
    setDisciplineHint(null)
    setNewTitle('')
  }

  function handleToggleCompleteSimple(
    taskId: string,
    status: 'pending' | 'in-progress' | 'completed',
  ) {
    if (locked && status === 'completed') {
      setDisciplineHint('已完成任务不可改回待办（自律模式）')
      return
    }
    updateTask(taskId, {
      status: status === 'completed' ? 'pending' : 'completed',
    })
    setDisciplineHint(null)
  }

  const completed = tasks.filter((t) => t.status === 'completed').length

  return (
    <div className="space-y-6">
      <PlanningDatePicker />

      <DisciplineBanner
        planningDate={selectedDate}
        disciplineEnabled={disciplineModeEnabled}
        locked={locked}
        lockedAt={lockedAt}
        canLock={
          disciplineModeEnabled && isTodayDateKey(selectedDate) && !locked && tasks.length > 0
        }
        onLock={() => {
          if (!lockPlanForDate()) {
            setDisciplineHint('自律模式下仅可锁定今天的计划')
            return
          }
          setDisciplineHint(null)
        }}
      />

      {disciplineHint && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {disciplineHint}
        </p>
      )}

      {/* Date banner */}
      <div className="rounded-2xl glass-panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-400">
              今日焦点
            </p>
            <h3 className="mt-1 text-2xl font-bold text-white">{formattedDate}</h3>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{tasks.length}</p>
              <p className="text-xs text-zinc-500">全部任务</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{completed}</p>
              <p className="text-xs text-zinc-500">已完成</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">{tasks.length - completed}</p>
              <p className="text-xs text-zinc-500">待完成</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Task list */}
        <div className="space-y-4 lg:col-span-3">
          {!locked && (
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="添加今日待办..."
                className="flex-1 rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/30"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-500"
              >
                <Plus className="h-4 w-4" />
                添加
              </button>
            </form>
          )}

          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
                <Circle className="mx-auto h-8 w-8 text-zinc-600" />
                <p className="mt-3 text-sm text-zinc-500">还没有任务，添加第一条吧</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl glass-panel-light px-4 py-3 transition hover:border-white/10',
                    task.status === 'completed' && 'opacity-60',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleCompleteSimple(task.id, task.status)}
                    className="shrink-0 text-zinc-400 transition hover:text-success"
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm font-medium text-zinc-100',
                        task.status === 'completed' && 'line-through',
                      )}
                    >
                      {task.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-zinc-500">
                      {task.scheduledStart && task.scheduledEnd && (
                        <span className="tabular-nums text-zinc-400">
                          {task.scheduledStart}–{task.scheduledEnd}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {task.estimatedMinutes} 分钟
                      </span>
                      <span className={cn('flex items-center gap-1', getPriorityColor(task.priority))}>
                        <Star className="h-3 w-3" />
                        {getPriorityLabel(task.priority)}
                      </span>
                    </div>
                  </div>

                  {!locked && (
                    <button
                      type="button"
                      onClick={() => deleteTask(task.id)}
                      className="shrink-0 text-zinc-600 opacity-0 transition group-hover:opacity-100 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Daily note */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl glass-panel p-5">
            <h4 className="mb-3 text-sm font-semibold text-zinc-200">今日记事</h4>
            <textarea
              value={note?.content ?? ''}
              onChange={(e) => upsertNote(selectedDate, e.target.value)}
              placeholder="记录灵感、备忘、心情..."
              rows={12}
              className="w-full resize-none rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-accent-500/50"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
