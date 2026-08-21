import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { LogOut, ShieldCheck } from 'lucide-react'

export function AppNav({ title }: { title: string }) {
  const { signOut, isSuperAdmin, user } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-sm text-primary-foreground">
            B2
          </span>
          {title}
        </Link>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin">
                <ShieldCheck className="size-4" /> Admin
              </Link>
            </Button>
          )}
          <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
          >
            <LogOut className="size-4" /> Log out
          </Button>
        </div>
      </div>
    </header>
  )
}
