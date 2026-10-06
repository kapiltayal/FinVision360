import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { blogArticles, formatBlogDate, getBlogArticle, sortBlogArticles } from "./blog-articles";

test("sorts newest first without changing the source array", () => {
  const posts = [
    { slug: "older", publishedAt: "2026-01-01" },
    { slug: "newest", publishedAt: "2026-10-03" },
    { slug: "middle", publishedAt: "2026-05-01" },
  ];
  assert.deepEqual(sortBlogArticles(posts).map(post => post.slug), ["newest", "middle", "older"]);
  assert.deepEqual(posts.map(post => post.slug), ["older", "newest", "middle"]);
});

test("finds the saved article and returns no article for an unknown slug", () => {
  assert.equal(getBlogArticle(blogArticles[0].slug), blogArticles[0]);
  assert.equal(getBlogArticle("nonexistent-article"), undefined);
});

test("formats date-only values consistently across time zones", () => {
  assert.equal(formatBlogDate("2026-10-03"), "October 3, 2026");
});

test("all posts have unique slugs, valid dates, card content, article text and local images", () => {
  assert.ok(blogArticles.length > 0);
  assert.equal(new Set(blogArticles.map(post => post.slug)).size, blogArticles.length);
  for (const post of blogArticles) {
    assert.match(post.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(Number.isFinite(Date.parse(post.publishedAt)));
    assert.ok(post.title.trim() && post.excerpt.trim() && post.thumbnailAlt.trim());
    assert.ok(post.readingTimeMinutes > 0);
    assert.ok(post.sections.length > 0);
    assert.ok(post.sections.every(section => section.heading.trim() && section.paragraphs.length > 0));
    assert.ok(existsSync(join(process.cwd(), "client/public", post.thumbnail.slice(1))));
  }
});
