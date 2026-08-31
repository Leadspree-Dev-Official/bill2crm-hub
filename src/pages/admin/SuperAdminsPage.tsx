import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { findUserByEmail, grantSuperAdmin, revokeSuperAdmin } from '@/lib/api/admin'
import type { SuperAdmin } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { toast } from 'sonner'
import { Loader2, UserMinus, UserPlus } from 'lucide-react'

export default function SuperAdminsPage() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState<SuperAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [granting, setGranting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('super_admins').select('*').order('granted_at', { ascending: false })
    if (error) toast.error('Could not load super admins', { description: error.message })
    setAdmins((data as SuperAdmin[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleGrant() {
    if (!email) return
    setGranting(true)
    const { data, error } = await findUserByEmail(email)
    if (error || !data || data.length === 0) {
      toast.error('No user with that email', { description: error ?? 'They need to sign up first.' })
      setGranting(false)
      return
    }
    const { error: grantError } = await grantSuperAdmin(data[0].user_id)
    setGranting(false)
    if (grantError) {
      toast.error('Could not grant access', { description: grantError })
      return
    }
    toast.success(`${email} is now a super admin`)
    setEmail('')
    void load()
  }

  async function handleRevoke(userId: string) {
    const { error } = await revokeSuperAdmin(userId)
    if (error) {
      toast.error('Could not revoke access', { description: error })
      return
    }
    toast.success('Access revoked')
    void load()
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Super admins"
        description="Full access to every tenant, plan and app link. Grant sparingly."
        actions={
          <div className="flex max-w-md gap-2">
            <Input placeholder="email@business.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 w-56 text-[13px]" />
            <Button size="sm" onClick={handleGrant} disabled={granting || !email}>
              {granting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Grant
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>User ID</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => {
                const isYou = admin.user_id === user?.id
                return (
                  <TableRow key={admin.user_id}>
                    <TableCell className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                      {admin.user_id}
                      {isYou && (
                        <span className="rounded-sm border border-border-strong bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          you
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {new Date(admin.granted_at).toLocaleDateString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isYou && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRevoke(admin.user_id)}>
                          <UserMinus className="size-4" /> Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {admins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                    No super admins yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
