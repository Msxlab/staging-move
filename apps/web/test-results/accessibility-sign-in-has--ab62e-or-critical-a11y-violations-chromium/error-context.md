# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> sign-in has no serious or critical a11y violations
- Location: tests\e2e\accessibility.spec.ts:12:7

# Error details

```
Error: color-contrast (serious): Elements must meet minimum color contrast ratio thresholds — 3 node(s)
link-in-text-block (serious): Links must be distinguishable without relying on color — 1 node(s)

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 208

- Array []
+ Array [
+   Object {
+     "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
+     "help": "Elements must meet minimum color contrast ratio thresholds",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright",
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#eaecf1",
+               "contrastRatio": 3.79,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.79 (foreground color: #2c7ac3, background color: #eaecf1, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"w-full max-w-md rounded-2xl border border-border bg-card/85 p-8 shadow-lg backdrop-blur-xl space-y-6\">",
+                 "target": Array [
+                   ".max-w-md",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"min-h-screen flex items-center justify-center p-4\" style=\"background:var(--surface)\">",
+                 "target": Array [
+                   ".min-h-screen",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.79 (foreground color: #2c7ac3, background color: #eaecf1, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<a class=\"text-xs text-primary hover:underline\" href=\"/forgot-password\">Forgot password?</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "a[href$=\"forgot-password\"]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#2c7ac3",
+               "contrastRatio": 4.48,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ffffff",
+               "fontSize": "9.2pt (12.25px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.48 (foreground color: #ffffff, background color: #2c7ac3, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button type=\"submit\" class=\"w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition disabled:opacity-50 disabled:cursor-not-allowed\">Sign In</button>",
+                 "target": Array [
+                   ".gap-2",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.48 (foreground color: #ffffff, background color: #2c7ac3, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button type=\"submit\" class=\"w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition disabled:opacity-50 disabled:cursor-not-allowed\">Sign In</button>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".gap-2",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#eaecf1",
+               "contrastRatio": 3.79,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.79 (foreground color: #2c7ac3, background color: #eaecf1, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"w-full max-w-md rounded-2xl border border-border bg-card/85 p-8 shadow-lg backdrop-blur-xl space-y-6\">",
+                 "target": Array [
+                   ".max-w-md",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"min-h-screen flex items-center justify-center p-4\" style=\"background:var(--surface)\">",
+                 "target": Array [
+                   ".min-h-screen",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.79 (foreground color: #2c7ac3, background color: #eaecf1, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<a class=\"text-primary hover:underline\" href=\"/sign-up\">Sign Up</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "a[href$=\"sign-up\"]",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2aa",
+       "wcag143",
+       "TTv5",
+       "TT13.c",
+       "EN-301-549",
+       "EN-9.1.4.3",
+       "ACT",
+       "RGAAv4",
+       "RGAA-3.2.1",
+     ],
+   },
+   Object {
+     "description": "Ensure links are distinguished from surrounding text in a way that does not rely on color",
+     "help": "Links must be distinguishable without relying on color",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/link-in-text-block?application=playwright",
+     "id": "link-in-text-block",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "contrastRatio": 1.61,
+               "messageKey": "fgContrast",
+               "nodeColor": "#2c7ac3",
+               "parentColor": "#4d5866",
+               "requiredContrastRatio": 3,
+             },
+             "id": "link-in-text-block",
+             "impact": "serious",
+             "message": "The link has insufficient color contrast of 1.61:1 with the surrounding text. (Minimum contrast is 3:1, link text: #2c7ac3, surrounding text: #4d5866)",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<p class=\"text-center text-xs text-muted-foreground\">Don't have an account?<!-- --> <a class=\"text-primary hover:underline\" href=\"/sign-up\">Sign Up</a></p>",
+                 "target": Array [
+                   ".max-w-md > p",
+                 ],
+               },
+             ],
+           },
+           Object {
+             "data": null,
+             "id": "link-in-text-block-style",
+             "impact": "serious",
+             "message": "The link has no styling (such as underline) to distinguish it from the surrounding text",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<p class=\"text-center text-xs text-muted-foreground\">Don't have an account?<!-- --> <a class=\"text-primary hover:underline\" href=\"/sign-up\">Sign Up</a></p>",
+                 "target": Array [
+                   ".max-w-md > p",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   The link has insufficient color contrast of 1.61:1 with the surrounding text. (Minimum contrast is 3:1, link text: #2c7ac3, surrounding text: #4d5866)
+   The link has no styling (such as underline) to distinguish it from the surrounding text",
+         "html": "<a class=\"text-primary hover:underline\" href=\"/sign-up\">Sign Up</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "a[href$=\"sign-up\"]",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2a",
+       "wcag141",
+       "TTv5",
+       "TT13.a",
+       "EN-301-549",
+       "EN-9.1.4.1",
+       "RGAAv4",
+       "RGAA-10.6.1",
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - link "Locateflow" [ref=e6] [cursor=pointer]:
        - /url: /
        - img [ref=e7]
        - generic [ref=e14]: Locateflow
      - generic [ref=e15]:
        - heading "Sign In" [level=1] [ref=e16]
        - paragraph [ref=e17]: Sign in to your account
    - generic [ref=e18]:
      - button "Google sign-in unavailable" [disabled] [ref=e19]:
        - img [ref=e20]
        - generic [ref=e25]: Google sign-in unavailable
      - button "Apple sign-in unavailable" [disabled] [ref=e26]:
        - img [ref=e27]
        - generic [ref=e29]: Apple sign-in unavailable
      - generic [ref=e30]: Password sign-in is available now. Social sign-in will be enabled after admin OAuth credentials are added.
      - generic [ref=e33]: with
    - generic [ref=e35]:
      - generic [ref=e36]:
        - generic [ref=e37]: Email
        - textbox "Email" [ref=e38]
      - generic [ref=e39]:
        - generic [ref=e40]:
          - generic [ref=e41]: Password
          - link "Forgot password?" [ref=e42] [cursor=pointer]:
            - /url: /forgot-password
        - generic [ref=e43]:
          - textbox "Password" [ref=e44]
          - button "Show password" [ref=e45] [cursor=pointer]:
            - img [ref=e46]
      - button "Sign In" [ref=e49] [cursor=pointer]
    - paragraph [ref=e50]:
      - text: Don't have an account?
      - link "Sign Up" [ref=e51] [cursor=pointer]:
        - /url: /sign-up
    - generic [ref=e52]:
      - link "Terms" [ref=e53] [cursor=pointer]:
        - /url: /terms
      - link "Privacy" [ref=e54] [cursor=pointer]:
        - /url: /privacy
      - link "Disclaimer" [ref=e55] [cursor=pointer]:
        - /url: /disclaimer
      - link "Contact" [ref=e56] [cursor=pointer]:
        - /url: /contact
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e62] [cursor=pointer]:
    - img [ref=e63]
  - alert [ref=e66]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | 
  4  | const PAGES = [
  5  |   { name: "home", path: "/" },
  6  |   { name: "sign-in", path: "/sign-in" },
  7  |   { name: "sign-up", path: "/sign-up" },
  8  |   { name: "pricing", path: "/pricing" },
  9  | ];
  10 | 
  11 | for (const { name, path } of PAGES) {
  12 |   test(`${name} has no serious or critical a11y violations`, async ({ page }) => {
  13 |     await page.goto(path);
  14 |     const results = await new AxeBuilder({ page })
  15 |       .withTags(["wcag2a", "wcag2aa"])
  16 |       .analyze();
  17 | 
  18 |     const seriousOrCritical = results.violations.filter(
  19 |       (v) => v.impact === "serious" || v.impact === "critical"
  20 |     );
  21 | 
  22 |     expect(
  23 |       seriousOrCritical,
  24 |       seriousOrCritical
  25 |         .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`)
  26 |         .join("\n")
> 27 |     ).toEqual([]);
     |       ^ Error: color-contrast (serious): Elements must meet minimum color contrast ratio thresholds — 3 node(s)
  28 |   });
  29 | }
  30 | 
```