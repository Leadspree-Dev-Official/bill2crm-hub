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
import { Loader2 } from 'lucide-react'

const schema = z.object({
  businessName: z.string().min(2, 'Enter your business name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
})

type FormValues = z.infer<typeof schema>

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)
}

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { businessName: '', email: '', password: '' },
  })

  const subdomain = slugify(form.watch('businessName'))

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    const { error } = await signUp(values.email, values.password, values.businessName)
    setSubmitting(false)

    if (error) {
      form.setError('email', { message: error })
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
      {submitted ? (
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
                  {subdomain ? (
                    <p className="font-mono text-[11px] text-muted-foreground">Instance: {subdomain}.bill2crm.in</p>
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
