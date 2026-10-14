import { ArrowUpRight, BookOpen, Clock3, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { PublicPageLayout } from "@/components/public-page-layout";
import { useSEO } from "@/hooks/use-seo";
import { blogArticles, formatBlogDate } from "@/lib/blog-articles";

export default function BlogPage() {
  useSEO({
    title: "The FinVision360 Journal — Clearer money, one step at a time",
    description: "Thoughtful, practical guidance for understanding your household finances and building healthier money habits.",
  });

  return (
    <PublicPageLayout>
      <div className="mx-auto max-w-5xl">
        <section className="relative isolate overflow-hidden rounded-xl border-b border-primary/15 bg-gradient-to-r from-primary/[0.07] via-primary/[0.035] to-background px-6 py-5 text-foreground sm:px-10 sm:py-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full border border-primary/10 sm:right-0 sm:top-1/2 sm:h-56 sm:w-56 sm:-translate-y-1/2" />
          <div aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full border border-primary/10 sm:right-14 sm:h-40 sm:w-40" />
          <div className="relative max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-primary dark:bg-background/45">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              THE FINVISION360 JOURNAL
            </div>
            <h1 className="font-serif text-[2.5rem] leading-[1.02] tracking-[-0.045em] sm:text-5xl">
              A clearer view of
              <br />
              <span className="italic text-primary">your money.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Small, thoughtful ways to make sense of the whole picture—and feel more at home in your finances.
            </p>
            <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground sm:text-sm">
              <span className="h-px w-10 shrink-0 bg-primary/45" />
              A little clarity goes a long way
            </div>
          </div>
        </section>

        <section aria-labelledby="stories-heading" className="mx-auto mt-8 max-w-5xl">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Ideas for everyday money</p>
              <h2 id="stories-heading" className="mt-1 font-serif text-2xl tracking-tight sm:text-3xl">The journal</h2>
            </div>
            <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <BookOpen aria-hidden="true" className="h-4 w-4" />
              {blogArticles.length} {blogArticles.length === 1 ? "story" : "stories"}
            </span>
          </div>

          {blogArticles.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {blogArticles.map(article => (
                <article key={article.slug} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card transition-transform duration-300 hover:-translate-y-1">
                  <div className="relative aspect-[16/9] overflow-hidden bg-primary/[0.07]">
                    <img src={article.thumbnail} alt={article.thumbnailAlt} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    {article.isSample && <span className="absolute left-3 top-3 rounded-full bg-[#f6e9c9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#785b26]">Sample article</span>}
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
                      <span className="text-primary">{article.category}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={article.publishedAt}>{formatBlogDate(article.publishedAt)}</time>
                    </div>
                    <h3 className="mt-3 font-serif text-2xl leading-snug tracking-tight">{article.title}</h3>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">{article.excerpt}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                      <span className="text-xs text-muted-foreground">{article.author}</span>
                      <Link
                        href={`/blog/${article.slug}`}
                        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        Read More
                        <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
              <BookOpen aria-hidden="true" className="mx-auto h-8 w-8 text-primary/70" />
              <h3 className="mt-4 font-serif text-2xl">A fresh page is on its way</h3>
              <p className="mt-2 text-sm text-muted-foreground">There are no stories to read just yet. Check back soon.</p>
            </div>
          )}
        </section>

        <aside className="mt-14 flex items-center gap-4 rounded-xl border border-border/70 bg-muted/40 px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Clock3 aria-hidden="true" className="h-5 w-5" /></span>
          <p className="text-sm leading-6 text-muted-foreground">Good money habits are built at your own pace. Take what helps, leave what doesn’t.</p>
        </aside>
      </div>
    </PublicPageLayout>
  );
}
