import { defineCollection } from "astro:content";
import { sveltiaLoader } from "astro-loader-sveltia-cms/loader";

const authors = defineCollection({
  loader: sveltiaLoader("authors"),
});

const posts = defineCollection({
  loader: sveltiaLoader("posts"),
});

export const collections = { authors, posts };

// Usage example — in a page like src/pages/blog/[slug].astro:
//
// import { getCollection, getEntry, render } from "astro:content";
//
// export async function getStaticPaths() {
//   const posts = await getCollection("posts");
//   return posts.map((post) => ({
//     params: { slug: post.id },
//     props: { post },
//   }));
// }
//
// const { post } = Astro.props;
// const { Content } = await render(post);
// const { data } = post;
//
// // data.author is typed as { collection: "authors"; id: string }
// // so getEntry() resolves it without a type error:
// const author = await getEntry(data.author);
