import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { readRecoveryFlag, useAuth, writeRecoveryFlag } from '@/lib/auth-context'
import { AuthLayout } from '@/components/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Loader2, ShieldAlert } from 'lucide-react'

const schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(8, 'At least 8 characters'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

type Status = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { isPasswordRecovery } = useAuth()
  const [status, setStatus] = useState<Status>('checking')
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    let active = true

    // Supabase parses the recovery hash and establishes the session during createClient(), which
    // runs at module import — before this component (or even React) mounts. The
    // PASSWORD_RECOVERY event is emitted once, to whoever is listening at that moment, and
    // Supabase strips the hash on its way through. So a listener attached here routinely misses
    // the event AND finds an empty hash: the earlier implementation then declared a perfectly
    // valid reset link "invalid or expired" after 2.5s. Three sources are consulted instead,
    // in the order they become reliable.
    //
    //   1. AuthProvider's listener is registered at app mount and persists the event in
    //      sessionStorage, so `isPasswordRecovery` survives both the race and a page reload.
    //   2. The hash, if it somehow has not been consumed yet.
    //   3. A late event, for the case where this component mounts first.
    if (isPasswordRecovery || readRecoveryFlag() || window.location.hash.includes('type=recovery')) {
      setStatus('ready')
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setStatus('ready')
    })

    // Only after giving the async client initialisation a chance to finish do we conclude the
    // link is bad — and we require an actual absence of a session to say so, rather than
    // inferring it from a hash Supabase has already cleaned up.
    const timeout = setTimeout(async () => {
      if (!active) return
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!active) return
      setStatus((current) => {
        if (current !== 'checking') return current
        return isPasswordRecovery || readRecoveryFlag() || session ? 'ready' : 'invalid'
      })
    }, 2500)

    return () => {
      active = false
      sub.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [isPasswordRecovery])

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: values.password })

    if (error) {
      setSubmitting(false)
      toast.error('Could not update password', { description: error.message })
      return
    }

    // Force a fresh sign-in with the new password rather than dropping them straight into the
    // dashboard on the recovery session.
    writeRecoveryFlag(false)
    await supabase.auth.signOut()
    setSubmitting(false)
    toast.success('Password updated', { description: 'Sign in with your new password.' })
    navigate('/login', { replace: true })
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a new password for your account. You'll need to sign in again once it's set."
      footer={
        <>
          Remembered your old one?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {status === 'checking' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Verifying your reset link…
        </div>
      )}

      {status === 'invalid' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
          <ShieldAlert className="size-5 text-destructive" />
          <p className="mt-3 text-sm font-medium">This link is invalid or has expired</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Reset links stay valid for one hour. Request a new one and try again.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      )}

      {status === 'ready' && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Update password'}
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  )
}
