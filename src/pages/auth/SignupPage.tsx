import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAuth } from '@/lib/auth-context'
import { AuthLayout } from '@/components/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Loader2, MailCheck } from 'lucide-react'

const schema = z.object({
  businessName: z.string().min(2, 'Enter your business name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
})

type FormValues = z.infer<typeof schema>

/** Mirrors provision_tenant_for_new_user() in 20260821213300_signup_trigger.sql, which is what
 *  actually assigns the subdomain. That collapses each run of non-alphanumerics to a single
 *  hyphen and trims hyphens from the ends; stripping them outright (as this preview used to)
 *  promised "sharmatraders" to someone the database would then place on "sharma-traders". */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { businessName: '', email: '', password: '' },
  })

  const subdomain = slugify(form.watch('businessName'))

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    const { error, needsEmailConfirmation } = await signUp(values.email, values.password, values.businessName)
    setSubmitting(false)

    if (error) {
      form.setError('email', { message: error })
      return
    }
    // The live control plane has email confirmation on, so there is no session yet. Sending the
    // user to /dashboard here would hit RequireAuth, find no session and bounce them to /login
    // with nothing on screen explaining that their workspace is waiting on a click in their
    // inbox — which is what every production signup did before this branch.
    if (needsEmailConfirmation) {
      setAwaitingConfirmation(values.email)
      return
    }
    setSubmitted(true)
    setTimeout(() => navigate('/dashboard'), 300)
  }

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Three fields, no card, no plan to pick. Your 7-day trial starts the moment you submit."
      footer={
        <>
          Already have a workspace?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {awaitingConfirmation ? (
        <div className="rounded-lg border border-accent/30 bg-accent-soft p-5">
          <MailCheck className="size-5 text-accent" />
          <p className="mt-3 text-sm font-medium">Confirm your email to finish</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            We sent a confirmation link to <span className="font-medium text-foreground">{awaitingConfirmation}</span>.
            Click it and your 7-day trial workspace opens straight away. Check spam before writing to support.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setAwaitingConfirmation(null)}>
            Use a different email
          </Button>
        </div>
      ) : submitted ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Setting up your workspace…
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Sharma Traders" autoComplete="organization" {...field} />
                  </FormControl>
                  {/* Names the workspace, not a hostname. Which server a tenant lands on is
                      decided at signup by free capacity, and each server hosts all of its
                      tenants on one address — so there is no per-tenant URL to promise here,
                      and the old `{slug}.{ROOT_DOMAIN}` preview pointed at a host that does
                      not resolve. The real address is shown on the dashboard once assigned. */}
                  {subdomain ? (
                    <p className="font-mono text-[11px] text-muted-foreground">Workspace ID: {subdomain}</p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@business.com" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Start 7-day free trial'}
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              By creating a workspace you agree to the terms of service and privacy policy. We will never charge a
              card without you raising an upgrade request.
            </p>
          </form>
        </Form>
      )}
    </AuthLayout>
  )
}
