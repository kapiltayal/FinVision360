import articles from "../../../blog_articles.json";

export type BlogArticle = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  category: string;
  author: string;
  readingTimeMinutes: number;
  thumbnail: string;
  thumbnailAlt: string;
  isSample?: boolean;
  sections: { heading: string; paragraphs: string[] }[];
};

export function sortBlogArticles<T extends { publishedAt: string }>(posts: readonly T[]): T[] {
  return [...posts].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export const blogArticles = sortBlogArticles<BlogArticle>(articles);

export function getBlogArticle(slug: string): BlogArticle | undefined {
  return blogArticles.find(article => article.slug === slug);
}

export function formatBlogDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}
