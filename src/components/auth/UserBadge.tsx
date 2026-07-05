import { useAuthStore } from '@/stores/authStore'
import { getUserAvatarColor, getUserInitials } from '@/lib/userAvatar'
import { cn } from '@/lib/utils'

interface UserBadgeProps {
  className?: string
  showEmail?: boolean
  size?: 'sm' | 'md'
  avatarOnly?: boolean
}

export function UserBadge({
  className,
  showEmail = false,
  size = 'md',
  avatarOnly = false,
}: UserBadgeProps) {
  const user = useAuthStore((s) => s.user)
  if (!user) return null

  const initials = getUserInitials(user.username)
  const avatarClass =
    size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-9 w-9 text-sm'

  const avatar = (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-inner',
        avatarClass,
      )}
      style={{ backgroundColor: getUserAvatarColor(user.username) }}
      title={user.username}
      aria-label={user.username}
    >
      {initials}
    </div>
  )

  if (avatarOnly) {
    return <div className={className}>{avatar}</div>
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      {avatar}
      <div className="min-w-0">
        <p
          className={cn(
            'truncate font-medium text-zinc-200',
            size === 'sm' ? 'text-xs' : 'text-sm',
          )}
        >
          {user.username}
        </p>
        {showEmail && user.email && (
          <p className="truncate text-[10px] text-zinc-500">{user.email}</p>
        )}
      </div>
    </div>
  )
}
