# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> sign-up has no serious or critical a11y violations
- Location: tests\e2e\accessibility.spec.ts:12:7

# Error details

```
Error: color-contrast (serious): Elements must meet minimum color contrast ratio thresholds — 2 node(s)
link-in-text-block (serious): Links must be distinguishable without relying on color — 1 node(s)

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 167

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
+                 "html": "<button type=\"submit\" class=\"w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition disabled:opacity-50 disabled:cursor-not-allowed\">Create Account</button>",
+                 "target": Array [
+                   ".bg-primary",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.48 (foreground color: #ffffff, background color: #2c7ac3, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button type=\"submit\" class=\"w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition disabled:opacity-50 disabled:cursor-not-allowed\">Create Account</button>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".bg-primary",
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
+         "html": "<a class=\"text-primary hover:underline\" href=\"/sign-in\">Sign In</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".text-primary",
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
+                 "html": "<p class=\"text-center text-xs text-muted-foreground\">Already have an account?<!-- --> <a class=\"text-primary hover:underline\" href=\"/sign-in\">Sign In</a></p>",
+                 "target": Array [
+                   ".text-center:nth-child(4)",
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
+                 "html": "<p class=\"text-center text-xs text-muted-foreground\">Already have an account?<!-- --> <a class=\"text-primary hover:underline\" href=\"/sign-in\">Sign In</a></p>",
+                 "target": Array [
+                   ".text-center:nth-child(4)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   The link has insufficient color contrast of 1.61:1 with the surrounding text. (Minimum contrast is 3:1, link text: #2c7ac3, surrounding text: #4d5866)
+   The link has no styling (such as underline) to distinguish it from the surrounding text",
+         "html": "<a class=\"text-primary hover:underline\" href=\"/sign-in\">Sign In</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".text-primary",
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
        - heading "Create your account" [level=1] [ref=e16]
        - paragraph [ref=e17]: Start managing every service tied to your address. Checkout terms shown before purchase
    - generic [ref=e18]:
      - button "Google sign-in unavailable" [disabled] [ref=e19]:
        - img [ref=e20]
        - generic [ref=e25]: Google sign-in unavailable
      - button "Apple sign-in unavailable" [disabled] [ref=e26]:
        - img [ref=e27]
        - generic [ref=e29]: Apple sign-in unavailable
      - generic [ref=e30]: Email and password sign-up is ready now. Social sign-in will be enabled after admin OAuth credentials are added.
      - generic [ref=e33]: with
    - generic [ref=e35]:
      - generic [ref=e36]:
        - generic [ref=e37]:
          - generic [ref=e38]: First name
          - textbox "First name" [ref=e39]
        - generic [ref=e40]:
          - generic [ref=e41]: Last name
          - textbox "Last name" [ref=e42]
      - generic [ref=e43]:
        - generic [ref=e44]: Email
        - textbox "Email" [ref=e45]
      - generic [ref=e46]:
        - generic [ref=e47]: Password
        - generic [ref=e48]:
          - textbox "Password" [ref=e49]:
            - /placeholder: At least 12 characters
          - button "Show password" [ref=e50] [cursor=pointer]:
            - img [ref=e51]
        - paragraph [ref=e54]: Pick a password with at least 12 characters, one uppercase, one lowercase, one digit, and one special character.
      - paragraph [ref=e55]: You will review and accept LocateFlow Terms and Legal Disclaimer before using the app.
      - button "Create Account" [ref=e56] [cursor=pointer]
    - paragraph [ref=e57]:
      - text: Already have an account?
      - link "Sign In" [ref=e58] [cursor=pointer]:
        - /url: /sign-in
    - generic [ref=e59]:
      - link "Terms" [ref=e60] [cursor=pointer]:
        - /url: /terms
      - link "Privacy" [ref=e61] [cursor=pointer]:
        - /url: /privacy
      - link "Disclaimer" [ref=e62] [cursor=pointer]:
        - /url: /disclaimer
      - link "Contact" [ref=e63] [cursor=pointer]:
        - /url: /contact
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e69] [cursor=pointer]:
    - img [ref=e70]
  - alert [ref=e73]
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
     |       ^ Error: color-contrast (serious): Elements must meet minimum color contrast ratio thresholds — 2 node(s)
  28 |   });
  29 | }
  30 | 
```