import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Copy,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { BLOG_POSTS } from './data/blogsData'
import { MarketingNav } from './sections/MarketingNav'
import { MarketingFooter } from './sections/MarketingFooter'

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()

  const post = BLOG_POSTS.find((p) => p.slug === slug)

  if (!post) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
        <MarketingNav />
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground">Article Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The article you are looking for does not exist or has been moved.
          </p>
          <Button asChild className="mt-6 text-xs" variant="outline">
            <Link to="/blogs">
              <ArrowLeft className="mr-2 size-3.5" /> Back to Knowledge Hub
            </Link>
          </Button>
        </div>
        <MarketingFooter />
      </div>
    )
  }

  // Related posts (excluding current)
  const relatedPosts = BLOG_POSTS.filter((p) => p.slug !== slug).slice(0, 3)

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Article link copied to clipboard!')
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <MarketingNav />

      {/* Article Header & Breadcrumbs */}
      <article className="pt-10 pb-16 sm:pt-14 sm:pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-5">
          
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <span>/</span>
            <Link to="/blogs" className="hover:text-foreground">Blogs</Link>
            <span>/</span>
            <span className="text-foreground font-medium truncate max-w-[200px]">
              {post.category}
            </span>
          </nav>

          {/* Category & Metadata */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4">
            <Badge variant="outline" className="border-primary/40 text-primary font-medium text-xs">
              {post.category}
            </Badge>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {post.readTime}
            </span>
            <span>•</span>
            <span>{post.publishedAt}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight text-pretty">
            {post.title}
          </h1>

          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
            {post.description}
          </p>

          {/* Author Strip & Share Button */}
          <div className="mt-6 pt-5 border-t border-border flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={post.author.avatar}
                alt={post.author.name}
                className="size-10 rounded-full object-cover border border-border"
              />
              <div>
                <div className="text-xs sm:text-sm font-semibold text-foreground">{post.author.name}</div>
                <div className="text-xs text-muted-foreground">{post.author.role}</div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="text-xs h-8 gap-1.5"
            >
              <Copy className="size-3.5" />
              <span>Share Link</span>
            </Button>
          </div>

          {/* Executive Summary / Key Takeaways Box */}
          <div className="mt-10 rounded-2xl border border-primary/30 bg-primary-soft/20 p-5 sm:p-6">
            <div className="flex items-center gap-2 font-semibold text-foreground text-sm mb-3">
              <BookOpen className="size-4 text-primary" />
              <span>Executive Summary &amp; Key Takeaways</span>
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-foreground/90">
              {post.content.keyTakeaways.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-[#138808] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Main Article Content */}
          <div className="mt-10 space-y-8 text-sm sm:text-base leading-relaxed text-foreground/90">
            <p className="text-base sm:text-lg leading-relaxed text-foreground font-normal">
              {post.content.intro}
            </p>

            {post.content.sections.map((sec) => (
              <div key={sec.heading} className="space-y-3 pt-4">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {sec.heading}
                </h2>
                {sec.body.map((p, idx) => (
                  <p key={idx} className="text-muted-foreground whitespace-pre-line leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            ))}

            {/* Conclusion */}
            <div className="mt-8 rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-2xs">
              <h3 className="font-bold text-foreground text-base mb-2">Final Thoughts</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {post.content.conclusion}
              </p>
            </div>
          </div>

          {/* In-article CTA Banner */}
          <div className="mt-12 rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-muted p-6 sm:p-8 text-center shadow-sm">
            <Badge variant="outline" className="border-primary/40 text-primary text-xs mb-2">
              Made for Indian SMEs
            </Badge>
            <h3 className="text-lg sm:text-2xl font-bold text-foreground">
              Run Your Business with Full GST Compliance
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto">
              Ready to replace disconnected accounting apps and spreadsheets with Bill2CRM?
              Start your free 7-day trial in under 60 seconds.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button asChild size="sm" className="bg-[#138808] hover:bg-[#16a34a] text-white text-xs px-5">
                <Link to="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link to="/pricing">View Plans</Link>
              </Button>
            </div>
          </div>

        </div>
      </article>

      {/* Related Articles Strip */}
      <section className="border-t border-border bg-surface-muted/30 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Related Guides &amp; Insights</h2>
            <Link to="/blogs" className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {relatedPosts.map((r) => (
              <div
                key={r.slug}
                className="rounded-xl border border-border bg-surface p-4 shadow-2xs hover:border-primary/40 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1.5">
                    {r.category}
                  </div>
                  <h3 className="font-bold text-sm text-foreground hover:text-primary transition-colors line-clamp-2">
                    <Link to={`/blogs/${r.slug}`}>{r.title}</Link>
                  </h3>
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {r.description}
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>{r.readTime}</span>
                  <Link to={`/blogs/${r.slug}`} className="text-primary font-medium hover:underline">
                    Read →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
