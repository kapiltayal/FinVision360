import { ArrowLeft, ArrowUpRight, Clock3 } from "lucide-react";
import { Link, useParams } from "wouter";
import { PublicPageLayout } from "@/components/public-page-layout";
import { useSEO } from "@/hooks/use-seo";
import { blogArticles, formatBlogDate, getBlogArticle } from "@/lib/blog-articles";

export default function BlogArticlePage() {
  const params = useParams<{ slug: string }>();
  const article = params.slug ? getBlogArticle(params.slug) : undefined;

  useSEO({
    title: article ? `${article.title} — FinVision360 Journal` : "Story not found — FinVision360 Journal",
    description: article?.excerpt ?? "Explore practical, thoughtful perspectives on household finances in the FinVision360 Journal.",
  });

  if (!article) {
    return (
      <PublicPageLayout>
        <section className="mx-auto flex min-h-[52vh] max-w-xl flex-col items-center justify-center py-16 text-center">
          <span className="font-serif text-7xl leading-none text-primary/25">404</span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Page not found</p>
          <h1 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">This story has wandered off.</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">The link may be out of date, or the story may have moved. Find your way back to the journal.</p>
          <Link href="/blog" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to the journal
          </Link>
        </section>
      </PublicPageLayout>
    );
  }

  const related = blogArticles.filter(item => item.slug !== article.slug).slice(0, 2);

  return (
    <PublicPageLayout>
      <article className="mx-auto max-w-3xl">
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          All stories
        </Link>

        <header className="pb-8 pt-9 sm:pt-12">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-primary">
            <span>{article.category}</span>
            {article.isSample && (
              <>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-primary/50" />
                <span className="rounded-full bg-[#f6e9c9] px-2.5 py-1 text-[10px] tracking-[0.1em] text-[#785b26] dark:bg-[#5a4827] dark:text-[#f1d99c]">Sample article</span>
              </>
            )}
          </div>
          <h1 className="mt-5 max-w-3xl font-serif text-4xl leading-[1.08] tracking-[-0.045em] sm:text-6xl">{article.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{article.excerpt}</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border/70 py-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{article.author}</span>
            <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-muted-foreground/50 sm:block" />
            <time dateTime={article.publishedAt}>{formatBlogDate(article.publishedAt)}</time>
            <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-muted-foreground/50 sm:block" />
            <span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden="true" className="h-3.5 w-3.5" />{article.readingTimeMinutes} min read</span>
          </div>
        </header>

        <figure className="overflow-hidden rounded-2xl bg-primary/[0.07]">
          <img src={article.thumbnail} alt={article.thumbnailAlt} className="aspect-[16/8] w-full object-cover" />
        </figure>

        <div className="mx-auto max-w-[42rem] pb-12 pt-10 sm:pt-14">
          <div className="mb-9 border-l-2 border-primary/60 pl-5 text-sm leading-7 text-muted-foreground">
            A practical read from FinVision360. Use what fits your life, and remember that personal circumstances vary.
          </div>
          <div className="space-y-10">
            {article.sections.map((section, index) => (
              <section key={`${section.heading}-${index}`} id={`section-${index + 1}`} className="scroll-mt-24">
                <h2 className="font-serif text-2xl leading-tight tracking-[-0.025em] sm:text-3xl">{section.heading}</h2>
                <div className="mt-4 space-y-4">
                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex} className="text-[15px] leading-[1.9] text-foreground/85 sm:text-base">{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12 rounded-xl border border-primary/15 bg-primary/[0.045] p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">A note on financial wellbeing</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">This article is for general educational purposes and is not personalized financial, investment, tax, or legal advice. Consider your own circumstances before making financial decisions.</p>
          </div>
        </div>

        {related.length > 0 && (
          <footer className="border-t border-border/70 pb-4 pt-9">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Keep exploring</p>
                <h2 className="mt-1 font-serif text-2xl">Another point of view</h2>
              </div>
              <Link href="/blog" className="hidden items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex">All stories <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {related.map(item => (
                <Link key={item.slug} href={`/blog/${item.slug}`} className="group rounded-xl border border-border/80 bg-card p-5 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{item.category}</span>
                  <span className="mt-2 block font-serif text-xl leading-snug">{item.title}</span>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">Read more <ArrowUpRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
                </Link>
              ))}
            </div>
          </footer>
        )}
      </article>
    </PublicPageLayout>
  );
}
