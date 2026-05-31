import { describe, expect, it } from "vitest";
import {
  blogCategoryPath,
  blogCategoryUrl,
  blogPostPath,
  blogPostUrl,
} from "./urls";

describe("blog url helpers", () => {
  it("builds post paths with an explicit locale query only for non-default locales", () => {
    expect(blogPostPath("foo", "en")).toBe("/blog/foo");
    expect(blogPostPath("foo", null)).toBe("/blog/foo");
    expect(blogPostPath("foo", "es")).toBe("/blog/foo?locale=es");
  });

  it("joins post urls without a double slash on the site origin", () => {
    expect(blogPostUrl("https://locateflow.com/", "foo", "en")).toBe(
      "https://locateflow.com/blog/foo",
    );
    expect(blogPostUrl("https://locateflow.com", "foo", "es")).toBe(
      "https://locateflow.com/blog/foo?locale=es",
    );
  });

  it("builds category paths that mirror the post-path locale convention", () => {
    expect(blogCategoryPath("moving")).toBe("/blog/category/moving");
    expect(blogCategoryPath("moving", "en")).toBe("/blog/category/moving");
    expect(blogCategoryPath("moving", "es")).toBe("/blog/category/moving?locale=es");
  });

  it("joins category urls onto the site origin", () => {
    expect(blogCategoryUrl("https://locateflow.com/", "money")).toBe(
      "https://locateflow.com/blog/category/money",
    );
    expect(blogCategoryUrl("https://locateflow.com", "money", "es")).toBe(
      "https://locateflow.com/blog/category/money?locale=es",
    );
  });
});
