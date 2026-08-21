import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { findUserByEmail, grantSuperAdmin, revokeSuperAdmin } from '@/lib/api/admin'
import type { SuperAdmin } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Super admins</h1>

      <div className="flex max-w-md gap-2">
        <Input placeholder="email@business.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button onClick={handleGrant} disabled={granting || !email}>
          {granting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Grant
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.user_id}>
                  <TableCell className="font-mono text-xs">{admin.user_id}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(admin.granted_at).toLocaleDateString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right">
                    {admin.user_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRevoke(admin.user_id)}
                      >
                        <UserMinus className="size-4" /> Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
