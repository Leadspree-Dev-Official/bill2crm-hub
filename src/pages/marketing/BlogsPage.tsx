import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  BookOpen,
  Clock,
  ArrowRight,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BLOG_POSTS } from './data/blogsData'
import { MarketingNav } from './sections/MarketingNav'
import { MarketingFooter } from './sections/MarketingFooter'

const CATEGORIES = ['All', 'GST & Tax', 'Retail Tech', 'Business Growth', 'Data Security'] as const

export default function BlogsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const filteredPosts = useMemo(() => {
    return BLOG_POSTS.filter((post) => {
      const matchesCategory =
        selectedCategory === 'All' || post.category === selectedCategory
      const matchesSearch =
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  const featuredPost = BLOG_POSTS[0]

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <MarketingNav />

      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-surface/50 via-background to-background pt-14 pb-12 sm:pt-20 sm:pb-16 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3.5 py-1 text-xs font-medium text-primary shadow-xs">
            <Sparkles className="size-3.5" />
            <span>Guides, Tax Laws &amp; SME Playbooks</span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl text-foreground">
            Knowledge Hub for Modern Bharat
          </h1>

          <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Practical, actionable advice to help Indian retailers, manufacturers, and small business owners streamline billing, optimize inventory, and grow profitably.
          </p>

          {/* Search & Filter Bar */}
          <div className="mt-8 mx-auto max-w-xl">
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search articles on GST, POS, inventory, WhatsApp billing..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 text-sm bg-surface rounded-xl border-border shadow-xs"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface-muted'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Lead Post (Only when no search is active) */}
      {!searchQuery && selectedCategory === 'All' && featuredPost && (
        <section className="py-10 border-b border-border bg-surface-muted/30">
          <div className="mx-auto max-w-6xl px-4 sm:px-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Featured Guide
            </div>

            <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-xs grid gap-6 lg:grid-cols-12 items-center">
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="border-primary/40 text-primary font-medium">
                    {featuredPost.category}
                  </Badge>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {featuredPost.readTime}
                  </span>
                  <span>•</span>
                  <span>{featuredPost.publishedAt}</span>
                </div>

                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground hover:text-primary transition-colors">
                  <Link to={`/blogs/${featuredPost.slug}`}>{featuredPost.title}</Link>
                </h2>

                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {featuredPost.description}
                </p>

                <div className="pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={featuredPost.author.avatar}
                      alt={featuredPost.author.name}
                      className="size-8 rounded-full object-cover border border-border"
                    />
                    <div>
                      <div className="text-xs font-semibold text-foreground">{featuredPost.author.name}</div>
                      <div className="text-[11px] text-muted-foreground">{featuredPost.author.role}</div>
                    </div>
                  </div>

                  <Button asChild size="sm" className="bg-[#138808] hover:bg-[#16a34a] text-white text-xs">
                    <Link to={`/blogs/${featuredPost.slug}`}>
                      Read Article
                      <ArrowRight className="ml-1.5 size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-4 hidden lg:block">
                <div className="rounded-xl border border-border/80 bg-surface-muted p-5 space-y-2 text-xs">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <BookOpen className="size-4 text-primary" /> Key Takeaways
                  </div>
                  <ul className="space-y-1.5 text-muted-foreground text-[11px]">
                    {featuredPost.content.keyTakeaways.slice(0, 3).map((item) => (
                      <li key={item} className="line-clamp-2">
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Article Grid */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {selectedCategory === 'All' ? 'Latest Articles & Guides' : `${selectedCategory} Articles`}
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              {filteredPosts.length} article{filteredPosts.length === 1 ? '' : 's'}
            </span>
          </div>

          {filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">No articles match your current search.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-xs"
                onClick={() => {
                  setSelectedCategory('All')
                  setSearchQuery('')
                }}
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map((post) => (
                <article
                  key={post.slug}
                  className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xs hover:border-primary/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-3">
                      <Badge variant="outline" className="border-border text-foreground font-medium text-[10px]">
                        {post.category}
                      </Badge>
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="size-3 text-muted-foreground" />
                        {post.readTime}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-foreground hover:text-primary transition-colors line-clamp-2">
                      <Link to={`/blogs/${post.slug}`}>{post.title}</Link>
                    </h3>

                    <p className="mt-2.5 text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {post.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={post.author.avatar}
                        alt={post.author.name}
                        className="size-7 rounded-full object-cover border border-border"
                      />
                      <span className="text-xs text-foreground font-medium">{post.author.name}</span>
                    </div>

                    <Link
                      to={`/blogs/${post.slug}`}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      Read
                      <ChevronRight className="size-3" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Newsletter / Free Updates */}
      <section className="border-t border-border bg-surface-muted/40 py-12 sm:py-16 text-center">
        <div className="mx-auto max-w-xl px-4 sm:px-5">
          <Badge variant="outline" className="border-primary/40 text-primary text-xs font-mono mb-2">
            Weekly SME Briefing
          </Badge>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Stay Ahead of Indian Tax &amp; Business Changes
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
            Get GST notification alerts, retail operating hacks, and business growth playbooks delivered once a week.
          </p>

          <div className="mt-5 flex gap-2 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="Enter your business email"
              className="h-10 text-xs bg-surface rounded-lg"
            />
            <Button size="sm" className="bg-[#138808] hover:bg-[#16a34a] text-white text-xs h-10 px-4">
              Subscribe
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
