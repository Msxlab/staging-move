# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> pricing has no serious or critical a11y violations
- Location: tests\e2e\accessibility.spec.ts:12:7

# Error details

```
Error: color-contrast (serious): Elements must meet minimum color contrast ratio thresholds — 16 node(s)

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 625

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
+                 "html": "<button class=\"inline-flex items-ce...\">",
+                 "target": Array [
+                   ".hover\\:bg-primary\\/90.h-9.bg-primary",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.48 (foreground color: #ffffff, background color: #2c7ac3, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button class=\"inline-flex items-ce...\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".hover\\:bg-primary\\/90.h-9.bg-primary",
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
+                 "html": "<button type=\"button\" role=\"tab\" id=\"tab-yearly\" aria-selected=\"true\" aria-controls=\"pricing-plan-grid\" class=\"flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors bg-primary text-primary-foreground shadow-sm\">",
+                 "target": Array [
+                   "#tab-yearly",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.48 (foreground color: #ffffff, background color: #2c7ac3, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button type=\"button\" role=\"tab\" id=\"tab-yearly\" aria-selected=\"true\" aria-controls=\"pricing-plan-grid\" class=\"flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors bg-primary text-primary-foreground shadow-sm\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "#tab-yearly",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#4c8ecc",
+               "contrastRatio": 3.47,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ffffff",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.47 (foreground color: #ffffff, background color: #4c8ecc, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-primary-foreground/15 text-primary-foreground\">Save up to <!-- -->17<!-- -->%</span>",
+                 "target": Array [
+                   ".ml-1\\.5",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" role=\"tab\" id=\"tab-yearly\" aria-selected=\"true\" aria-controls=\"pricing-plan-grid\" class=\"flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors bg-primary text-primary-foreground shadow-sm\">",
+                 "target": Array [
+                   "#tab-yearly",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.47 (foreground color: #ffffff, background color: #4c8ecc, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-primary-foreground/15 text-primary-foreground\">Save up to <!-- -->17<!-- -->%</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".ml-1\\.5",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#e6e9ef",
+               "contrastRatio": 3.69,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<article class=\"flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm border-primary shadow-md\">",
+                 "target": Array [
+                   ".border-primary",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-xs font-semibold uppercase tracking-wide text-primary\">For one person</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-primary > .mb-5:nth-child(1) > .mb-2.gap-3.justify-between > .tracking-wide.uppercase.text-xs",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#d3deeb",
+               "contrastRatio": 3.29,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.29 (foreground color: #2c7ac3, background color: #d3deeb, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary\">Most popular</span>",
+                 "target": Array [
+                   ".border-primary > .mb-5:nth-child(1) > .mb-2.gap-3.justify-between > .py-0\\.5.px-2\\.5.text-\\[11px\\]",
+                 ],
+               },
+               Object {
+                 "html": "<article class=\"flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm border-primary shadow-md\">",
+                 "target": Array [
+                   ".border-primary",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.29 (foreground color: #2c7ac3, background color: #d3deeb, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary\">Most popular</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-primary > .mb-5:nth-child(1) > .mb-2.gap-3.justify-between > .py-0\\.5.px-2\\.5.text-\\[11px\\]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#e6e9ef",
+               "contrastRatio": 2.83,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2e9b79",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.83 (foreground color: #2e9b79, background color: #e6e9ef, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<article class=\"flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm border-primary shadow-md\">",
+                 "target": Array [
+                   ".border-primary",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.83 (foreground color: #2e9b79, background color: #e6e9ef, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"mt-2 text-xs font-medium text-tone-emerald-fg\">Save $<!-- -->7.89<!-- -->/year vs monthly (<!-- -->16<!-- -->% off)</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-primary > .mb-5:nth-child(2) > .mt-2.text-xs",
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
+                 "html": "<button class=\"inline-flex items-ce...\">",
+                 "target": Array [
+                   ".hover\\:bg-primary\\/90.bg-primary.h-10",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.48 (foreground color: #ffffff, background color: #2c7ac3, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button class=\"inline-flex items-ce...\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".hover\\:bg-primary\\/90.bg-primary.h-10",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#e6e9ef",
+               "contrastRatio": 3.69,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<article class=\"flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm border-border\">",
+                 "target": Array [
+                   ".border-border:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-xs font-semibold uppercase tracking-wide text-primary\">For households</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-border:nth-child(2) > .mb-5:nth-child(1) > .mb-2.gap-3.justify-between > .tracking-wide.uppercase.text-xs",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#e6e9ef",
+               "contrastRatio": 2.83,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2e9b79",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.83 (foreground color: #2e9b79, background color: #e6e9ef, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<article class=\"flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm border-border\">",
+                 "target": Array [
+                   ".border-border:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.83 (foreground color: #2e9b79, background color: #e6e9ef, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"mt-2 text-xs font-medium text-tone-emerald-fg\">Save $<!-- -->20.88<!-- -->/year vs monthly (<!-- -->17<!-- -->% off)</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-border:nth-child(2) > .mb-5:nth-child(2) > .mt-2.text-xs",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#e6e9ef",
+               "contrastRatio": 3.69,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<article class=\"flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm border-border\">",
+                 "target": Array [
+                   ".border-border:nth-child(3)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-xs font-semibold uppercase tracking-wide text-primary\">For power users</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-border:nth-child(3) > .mb-5:nth-child(1) > .mb-2.gap-3.justify-between > .tracking-wide.uppercase.text-xs",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#d3deeb",
+               "contrastRatio": 3.29,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.29 (foreground color: #2c7ac3, background color: #d3deeb, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary\">Most capacity</span>",
+                 "target": Array [
+                   ".border-border:nth-child(3) > .mb-5:nth-child(1) > .mb-2.gap-3.justify-between > .py-0\\.5.px-2\\.5.text-\\[11px\\]",
+                 ],
+               },
+               Object {
+                 "html": "<article class=\"flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm border-border\">",
+                 "target": Array [
+                   ".border-border:nth-child(3)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.29 (foreground color: #2c7ac3, background color: #d3deeb, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary\">Most capacity</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-border:nth-child(3) > .mb-5:nth-child(1) > .mb-2.gap-3.justify-between > .py-0\\.5.px-2\\.5.text-\\[11px\\]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#e6e9ef",
+               "contrastRatio": 2.83,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2e9b79",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.83 (foreground color: #2e9b79, background color: #e6e9ef, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<article class=\"flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm border-border\">",
+                 "target": Array [
+                   ".border-border:nth-child(3)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.83 (foreground color: #2e9b79, background color: #e6e9ef, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"mt-2 text-xs font-medium text-tone-emerald-fg\">Save $<!-- -->40.88<!-- -->/year vs monthly (<!-- -->17<!-- -->% off)</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-border:nth-child(3) > .mb-5:nth-child(2) > .mt-2.text-xs",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#e6e2e9",
+               "contrastRatio": 2.81,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#e0577e",
+               "fontSize": "9.2pt (12.25px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.81 (foreground color: #e0577e, background color: #e6e2e9, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<th scope=\"col\" class=\"plan-free bg-primary/5 px-4 py-4 text-center align-top\"><span class=\"block text-sm font-semibold text-primary\">Free</span><span class=\"mt-0.5 block text-xs font-normal text-muted-foreground\">$0</span></th>",
+                 "target": Array [
+                   ".plan-free",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"overflow-x-auto rounded-2xl border bg-card shadow-sm\">",
+                 "target": Array [
+                   ".overflow-x-auto",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.81 (foreground color: #e0577e, background color: #e6e2e9, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"block text-sm font-semibold text-primary\">Free</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".plan-free > .font-semibold.block.text-primary",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#dde3ed",
+               "contrastRatio": 3.48,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "9.2pt (12.25px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.48 (foreground color: #2c7ac3, background color: #dde3ed, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<th scope=\"col\" class=\" bg-primary/5 px-4 py-4 text-center align-top\"><span class=\"block text-sm font-semibold text-primary\">Individual</span><span class=\"mt-0.5 block text-xs font-normal text-muted-foreground\">$3.99/month</span></th>",
+                 "target": Array [
+                   ".bg-primary\\/5.align-top[scope=\"col\"]:nth-child(3)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"overflow-x-auto rounded-2xl border bg-card shadow-sm\">",
+                 "target": Array [
+                   ".overflow-x-auto",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.48 (foreground color: #2c7ac3, background color: #dde3ed, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"block text-sm font-semibold text-primary\">Individual</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".bg-primary\\/5.align-top[scope=\"col\"]:nth-child(3) > .font-semibold.block.text-primary",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#dce5e9",
+               "contrastRatio": 2.64,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#1f9e78",
+               "fontSize": "9.2pt (12.25px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.64 (foreground color: #1f9e78, background color: #dce5e9, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<th scope=\"col\" class=\"plan-family bg-primary/5 px-4 py-4 text-center align-top\"><span class=\"block text-sm font-semibold text-primary\">Family</span><span class=\"mt-0.5 block text-xs font-normal text-muted-foreground\">$9.99/month</span></th>",
+                 "target": Array [
+                   ".plan-family",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"overflow-x-auto rounded-2xl border bg-card shadow-sm\">",
+                 "target": Array [
+                   ".overflow-x-auto",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.64 (foreground color: #1f9e78, background color: #dce5e9, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"block text-sm font-semibold text-primary\">Family</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".plan-family > .font-semibold.block.text-primary",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#e3e3e5",
+               "contrastRatio": 2.95,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ae791e",
+               "fontSize": "9.2pt (12.25px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.95 (foreground color: #ae791e, background color: #e3e3e5, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<th scope=\"col\" class=\"plan-pro bg-primary/5 px-4 py-4 text-center align-top\"><span class=\"block text-sm font-semibold text-primary\">Pro</span><span class=\"mt-0.5 block text-xs font-normal text-muted-foreground\">$19.99/month</span></th>",
+                 "target": Array [
+                   ".plan-pro",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"overflow-x-auto rounded-2xl border bg-card shadow-sm\">",
+                 "target": Array [
+                   ".overflow-x-auto",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.95 (foreground color: #ae791e, background color: #e3e3e5, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"block text-sm font-semibold text-primary\">Pro</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".plan-pro > .font-semibold.block.text-primary",
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
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "Locateflow" [ref=e5] [cursor=pointer]:
          - /url: /
          - img [ref=e6]
          - generic [ref=e15]: Locateflow
        - navigation [ref=e16]:
          - link "Features" [ref=e17] [cursor=pointer]:
            - /url: /#features
          - link "Simple pricing" [ref=e18] [cursor=pointer]:
            - /url: /#pricing
          - link "How it works" [ref=e19] [cursor=pointer]:
            - /url: /how-it-works
          - link "Blog" [ref=e20] [cursor=pointer]:
            - /url: /blog
          - link "FAQ" [ref=e21] [cursor=pointer]:
            - /url: /faq
        - generic [ref=e22]:
          - 'button "Language: English" [ref=e24] [cursor=pointer]':
            - img [ref=e25]
            - img [ref=e35]
          - radiogroup "Theme preference" [ref=e37]:
            - radio "Light mode" [checked] [ref=e38] [cursor=pointer]:
              - img [ref=e40]
            - radio "Dark mode" [ref=e46] [cursor=pointer]:
              - img [ref=e47]
          - link "Sign In" [ref=e49] [cursor=pointer]:
            - /url: /sign-in
            - button "Sign In" [ref=e50]
          - link "Get started" [ref=e51] [cursor=pointer]:
            - /url: /sign-up
            - button "Get started" [ref=e52]
    - generic [ref=e53]:
      - generic [ref=e54]:
        - generic [ref=e55]:
          - img [ref=e56]
          - text: Individual, Family, Pro
        - heading "Simple pricing for every move and household" [level=1] [ref=e59]
        - paragraph [ref=e60]: Save with annual billing across Individual, Family, and Pro.
      - tablist "Billing interval" [ref=e61]:
        - tab "AnnualSave up to 17%" [selected] [ref=e62] [cursor=pointer]:
          - text: Annual
          - generic [ref=e63]: Save up to 17%
        - tab "Monthly" [ref=e64] [cursor=pointer]
      - tabpanel "AnnualSave up to 17%" [ref=e65]:
        - article [ref=e66]:
          - generic [ref=e67]:
            - generic [ref=e68]:
              - paragraph [ref=e69]: For one person
              - generic [ref=e70]: Most popular
            - heading "Individual" [level=3] [ref=e71]
            - paragraph [ref=e72]: Track addresses, services, renewals, move tasks, and budgets in one calm place.
          - generic [ref=e73]:
            - text: $39.99/year
            - paragraph [ref=e74]: Save $7.89/year vs monthly (16% off)
          - list [ref=e75]:
            - listitem [ref=e76]:
              - img [ref=e78]
              - generic [ref=e81]: Up to 10 homes
            - listitem [ref=e82]:
              - img [ref=e84]
              - generic [ref=e88]: 100 service provider records
            - listitem [ref=e89]:
              - img [ref=e91]
              - generic [ref=e93]: "New Home Dossier: flood zone, school district & moving-day weather"
            - listitem [ref=e94]:
              - img [ref=e96]
              - generic [ref=e100]: Vehicle VIN decode & NHTSA recall check
            - listitem [ref=e101]:
              - img [ref=e103]
              - generic [ref=e105]: Move-week weather alerts & weekly digest
            - listitem [ref=e106]:
              - img [ref=e108]
              - generic [ref=e112]: Smart provider suggestions with FCC broadband & utility data
            - listitem [ref=e113]:
              - img [ref=e115]
              - generic [ref=e118]: Bills and renewal reminders
            - listitem [ref=e119]:
              - img [ref=e121]
              - generic [ref=e124]: Per-home monthly budgets
            - listitem [ref=e125]:
              - img [ref=e127]
              - generic [ref=e132]: Smart moving planner
            - listitem [ref=e133]:
              - img [ref=e135]
              - generic [ref=e139]: Custom providers
            - listitem [ref=e140]:
              - img [ref=e142]
              - generic [ref=e145]: CSV and PDF export
          - link "Get started" [ref=e147] [cursor=pointer]:
            - /url: /sign-up?plan=INDIVIDUAL&billingInterval=YEAR
            - button "Get started" [ref=e148]
        - article [ref=e149]:
          - generic [ref=e150]:
            - paragraph [ref=e152]: For households
            - heading "Family" [level=3] [ref=e153]
            - paragraph [ref=e154]: Share one household workspace with members, roles, more addresses, and more tracked services.
          - generic [ref=e155]:
            - text: $99/year
            - paragraph [ref=e156]: Save $20.88/year vs monthly (17% off)
          - list [ref=e157]:
            - listitem [ref=e158]:
              - img [ref=e160]
              - generic [ref=e165]: Up to 6 members (you + 5)
            - listitem [ref=e166]:
              - img [ref=e168]
              - generic [ref=e172]: 15 addresses
            - listitem [ref=e173]:
              - img [ref=e175]
              - generic [ref=e177]: 500 services
            - listitem [ref=e178]:
              - img [ref=e180]
              - generic [ref=e183]: AI move briefing — your move, explained
            - listitem [ref=e184]:
              - img [ref=e186]
              - generic [ref=e188]: Real map on route & address cards
            - listitem [ref=e189]:
              - img [ref=e191]
              - generic [ref=e193]: "New Home Dossier: flood zone, school district & moving-day weather"
            - listitem [ref=e194]:
              - img [ref=e196]
              - generic [ref=e200]: Smart provider suggestions with FCC broadband & utility data
            - listitem [ref=e201]:
              - img [ref=e203]
              - generic [ref=e208]: Shared household workspace
            - listitem [ref=e209]:
              - img [ref=e211]
              - generic [ref=e214]: Member roles and invites
            - listitem [ref=e215]:
              - img [ref=e217]
              - generic [ref=e220]: Child accounts
            - listitem [ref=e221]:
              - img [ref=e223]
              - generic [ref=e226]: CSV and PDF export
          - link "Choose Family" [ref=e228] [cursor=pointer]:
            - /url: /sign-up?plan=FAMILY&billingInterval=YEAR
            - button "Choose Family" [ref=e229]
        - article [ref=e230]:
          - generic [ref=e231]:
            - generic [ref=e232]:
              - paragraph [ref=e233]: For power users
              - generic [ref=e234]: Most capacity
            - heading "Pro" [level=3] [ref=e235]
            - paragraph [ref=e236]: Higher limits for multi-property owners, portfolios, home offices, and heavier workflows.
          - generic [ref=e237]:
            - text: $199/year
            - paragraph [ref=e238]: Save $40.88/year vs monthly (17% off)
          - list [ref=e239]:
            - listitem [ref=e240]:
              - img [ref=e242]
              - generic [ref=e244]: Everything in Family
            - listitem [ref=e245]:
              - img [ref=e247]
              - generic [ref=e252]: Up to 10 members
            - listitem [ref=e253]:
              - img [ref=e255]
              - generic [ref=e259]: 25 addresses
            - listitem [ref=e260]:
              - img [ref=e262]
              - generic [ref=e264]: 1,000 services
            - listitem [ref=e265]:
              - img [ref=e267]
              - generic [ref=e272]: FMCSA-registered mover suggestions
            - listitem [ref=e273]:
              - img [ref=e275]
              - generic [ref=e278]: New Home Dossier PDF export
            - listitem [ref=e279]:
              - img [ref=e281]
              - generic [ref=e283]: Up to 3 concurrent move plans
            - listitem [ref=e284]:
              - img [ref=e286]
              - generic [ref=e289]: Tax & property export (CSV + PDF)
            - listitem [ref=e290]:
              - img [ref=e292]
              - generic [ref=e295]: Partner Hub — guided partner updates
            - listitem [ref=e296]:
              - img [ref=e298]
              - generic [ref=e301]: Priority support
          - link "Choose Pro" [ref=e303] [cursor=pointer]:
            - /url: /sign-up?plan=PRO&billingInterval=YEAR
            - button "Choose Pro" [ref=e304]
      - generic [ref=e305]:
        - generic [ref=e306]:
          - heading "Compare plans" [level=3] [ref=e307]
          - paragraph [ref=e308]: Every plan side by side — the same limits and features the app actually enforces.
        - table "Compare plans" [ref=e310]:
          - caption [ref=e311]: Compare plans
          - rowgroup [ref=e312]:
            - row "Feature Free $0 Individual $3.99/month Family $9.99/month Pro $19.99/month" [ref=e313]:
              - columnheader "Feature" [ref=e314]:
                - generic [ref=e315]: Feature
              - columnheader "Free $0" [ref=e316]:
                - generic [ref=e317]: Free
                - generic [ref=e318]: $0
              - columnheader "Individual $3.99/month" [ref=e319]:
                - generic [ref=e320]: Individual
                - generic [ref=e321]: $3.99/month
              - columnheader "Family $9.99/month" [ref=e322]:
                - generic [ref=e323]: Family
                - generic [ref=e324]: $9.99/month
              - columnheader "Pro $19.99/month" [ref=e325]:
                - generic [ref=e326]: Pro
                - generic [ref=e327]: $19.99/month
          - rowgroup [ref=e328]:
            - row "Essentials" [ref=e329]:
              - columnheader "Essentials" [ref=e330]
            - row "Addresses 3 10 15 25" [ref=e331]:
              - rowheader "Addresses" [ref=e332]
              - cell "3" [ref=e333]
              - cell "10" [ref=e334]
              - cell "15" [ref=e335]
              - cell "25" [ref=e336]
            - row "Tracked services 10 100 500 1,000" [ref=e337]:
              - rowheader "Tracked services" [ref=e338]
              - cell "10" [ref=e339]
              - cell "100" [ref=e340]
              - cell "500" [ref=e341]
              - cell "1,000" [ref=e342]
            - row "Providers, bills & renewal reminders Included Included Included Included" [ref=e343]:
              - rowheader "Providers, bills & renewal reminders" [ref=e344]
              - cell "Included" [ref=e345]:
                - img [ref=e346]
                - generic [ref=e348]: Included
              - cell "Included" [ref=e349]:
                - img [ref=e350]
                - generic [ref=e352]: Included
              - cell "Included" [ref=e353]:
                - img [ref=e354]
                - generic [ref=e356]: Included
              - cell "Included" [ref=e357]:
                - img [ref=e358]
                - generic [ref=e360]: Included
            - row "Smart provider suggestions (FCC broadband & utility data) Not included Included Included Included" [ref=e361]:
              - rowheader "Smart provider suggestions (FCC broadband & utility data)" [ref=e362]
              - cell "Not included" [ref=e363]:
                - img [ref=e364]
                - generic [ref=e365]: Not included
              - cell "Included" [ref=e366]:
                - img [ref=e367]
                - generic [ref=e369]: Included
              - cell "Included" [ref=e370]:
                - img [ref=e371]
                - generic [ref=e373]: Included
              - cell "Included" [ref=e374]:
                - img [ref=e375]
                - generic [ref=e377]: Included
          - rowgroup [ref=e378]:
            - row "Moving" [ref=e379]:
              - columnheader "Moving" [ref=e380]
            - row "Full move plan, checklist & countdown Not included Included Included Included" [ref=e381]:
              - rowheader "Full move plan, checklist & countdown" [ref=e382]
              - cell "Not included" [ref=e383]:
                - img [ref=e384]
                - generic [ref=e385]: Not included
              - cell "Included" [ref=e386]:
                - img [ref=e387]
                - generic [ref=e389]: Included
              - cell "Included" [ref=e390]:
                - img [ref=e391]
                - generic [ref=e393]: Included
              - cell "Included" [ref=e394]:
                - img [ref=e395]
                - generic [ref=e397]: Included
            - row "New Home Dossier (flood zone, school district & moving-day weather) Not included Included Included Included" [ref=e398]:
              - rowheader "New Home Dossier (flood zone, school district & moving-day weather)" [ref=e399]
              - cell "Not included" [ref=e400]:
                - img [ref=e401]
                - generic [ref=e402]: Not included
              - cell "Included" [ref=e403]:
                - img [ref=e404]
                - generic [ref=e406]: Included
              - cell "Included" [ref=e407]:
                - img [ref=e408]
                - generic [ref=e410]: Included
              - cell "Included" [ref=e411]:
                - img [ref=e412]
                - generic [ref=e414]: Included
            - row "Vehicle VIN decode & NHTSA recall check Not included Included Included Included" [ref=e415]:
              - rowheader "Vehicle VIN decode & NHTSA recall check" [ref=e416]
              - cell "Not included" [ref=e417]:
                - img [ref=e418]
                - generic [ref=e419]: Not included
              - cell "Included" [ref=e420]:
                - img [ref=e421]
                - generic [ref=e423]: Included
              - cell "Included" [ref=e424]:
                - img [ref=e425]
                - generic [ref=e427]: Included
              - cell "Included" [ref=e428]:
                - img [ref=e429]
                - generic [ref=e431]: Included
            - row "Move-week weather alerts & weekly digest email Not included Included Included Included" [ref=e432]:
              - rowheader "Move-week weather alerts & weekly digest email" [ref=e433]
              - cell "Not included" [ref=e434]:
                - img [ref=e435]
                - generic [ref=e436]: Not included
              - cell "Included" [ref=e437]:
                - img [ref=e438]
                - generic [ref=e440]: Included
              - cell "Included" [ref=e441]:
                - img [ref=e442]
                - generic [ref=e444]: Included
              - cell "Included" [ref=e445]:
                - img [ref=e446]
                - generic [ref=e448]: Included
            - row "AI move briefing Not included Not included Included Included" [ref=e449]:
              - rowheader "AI move briefing" [ref=e450]
              - cell "Not included" [ref=e451]:
                - img [ref=e452]
                - generic [ref=e453]: Not included
              - cell "Not included" [ref=e454]:
                - img [ref=e455]
                - generic [ref=e456]: Not included
              - cell "Included" [ref=e457]:
                - img [ref=e458]
                - generic [ref=e460]: Included
              - cell "Included" [ref=e461]:
                - img [ref=e462]
                - generic [ref=e464]: Included
            - row "Real map on route & address cards Not included Not included Included Included" [ref=e465]:
              - rowheader "Real map on route & address cards" [ref=e466]
              - cell "Not included" [ref=e467]:
                - img [ref=e468]
                - generic [ref=e469]: Not included
              - cell "Not included" [ref=e470]:
                - img [ref=e471]
                - generic [ref=e472]: Not included
              - cell "Included" [ref=e473]:
                - img [ref=e474]
                - generic [ref=e476]: Included
              - cell "Included" [ref=e477]:
                - img [ref=e478]
                - generic [ref=e480]: Included
            - row "FMCSA-registered mover suggestions Not included Not included Not included Included" [ref=e481]:
              - rowheader "FMCSA-registered mover suggestions" [ref=e482]
              - cell "Not included" [ref=e483]:
                - img [ref=e484]
                - generic [ref=e485]: Not included
              - cell "Not included" [ref=e486]:
                - img [ref=e487]
                - generic [ref=e488]: Not included
              - cell "Not included" [ref=e489]:
                - img [ref=e490]
                - generic [ref=e491]: Not included
              - cell "Included" [ref=e492]:
                - img [ref=e493]
                - generic [ref=e495]: Included
            - row "New Home Dossier PDF export Not included Not included Not included Included" [ref=e496]:
              - rowheader "New Home Dossier PDF export" [ref=e497]
              - cell "Not included" [ref=e498]:
                - img [ref=e499]
                - generic [ref=e500]: Not included
              - cell "Not included" [ref=e501]:
                - img [ref=e502]
                - generic [ref=e503]: Not included
              - cell "Not included" [ref=e504]:
                - img [ref=e505]
                - generic [ref=e506]: Not included
              - cell "Included" [ref=e507]:
                - img [ref=e508]
                - generic [ref=e510]: Included
            - row "Concurrent move plans 1 1 1 3" [ref=e511]:
              - rowheader "Concurrent move plans" [ref=e512]
              - cell "1" [ref=e513]
              - cell "1" [ref=e514]
              - cell "1" [ref=e515]
              - cell "3" [ref=e516]
          - rowgroup [ref=e517]:
            - row "Household" [ref=e518]:
              - columnheader "Household" [ref=e519]
            - row "Members 1 1 6 10" [ref=e520]:
              - rowheader "Members" [ref=e521]
              - cell "1" [ref=e522]
              - cell "1" [ref=e523]
              - cell "6" [ref=e524]
              - cell "10" [ref=e525]
            - row "Shared household workspace Not included Not included Included Included" [ref=e526]:
              - rowheader "Shared household workspace" [ref=e527]
              - cell "Not included" [ref=e528]:
                - img [ref=e529]
                - generic [ref=e530]: Not included
              - cell "Not included" [ref=e531]:
                - img [ref=e532]
                - generic [ref=e533]: Not included
              - cell "Included" [ref=e534]:
                - img [ref=e535]
                - generic [ref=e537]: Included
              - cell "Included" [ref=e538]:
                - img [ref=e539]
                - generic [ref=e541]: Included
            - row "Child accounts Not included Not included Included Included" [ref=e542]:
              - rowheader "Child accounts" [ref=e543]
              - cell "Not included" [ref=e544]:
                - img [ref=e545]
                - generic [ref=e546]: Not included
              - cell "Not included" [ref=e547]:
                - img [ref=e548]
                - generic [ref=e549]: Not included
              - cell "Included" [ref=e550]:
                - img [ref=e551]
                - generic [ref=e553]: Included
              - cell "Included" [ref=e554]:
                - img [ref=e555]
                - generic [ref=e557]: Included
          - rowgroup [ref=e558]:
            - row "Power tools" [ref=e559]:
              - columnheader "Power tools" [ref=e560]
            - row "CSV & PDF export Not included Included Included Included" [ref=e561]:
              - rowheader "CSV & PDF export" [ref=e562]
              - cell "Not included" [ref=e563]:
                - img [ref=e564]
                - generic [ref=e565]: Not included
              - cell "Included" [ref=e566]:
                - img [ref=e567]
                - generic [ref=e569]: Included
              - cell "Included" [ref=e570]:
                - img [ref=e571]
                - generic [ref=e573]: Included
              - cell "Included" [ref=e574]:
                - img [ref=e575]
                - generic [ref=e577]: Included
            - row "Tax & property export Not included Not included Not included Included" [ref=e578]:
              - rowheader "Tax & property export" [ref=e579]
              - cell "Not included" [ref=e580]:
                - img [ref=e581]
                - generic [ref=e582]: Not included
              - cell "Not included" [ref=e583]:
                - img [ref=e584]
                - generic [ref=e585]: Not included
              - cell "Not included" [ref=e586]:
                - img [ref=e587]
                - generic [ref=e588]: Not included
              - cell "Included" [ref=e589]:
                - img [ref=e590]
                - generic [ref=e592]: Included
            - row "Partner Hub — guided partner updates Not included Not included Not included Included" [ref=e593]:
              - rowheader "Partner Hub — guided partner updates" [ref=e594]
              - cell "Not included" [ref=e595]:
                - img [ref=e596]
                - generic [ref=e597]: Not included
              - cell "Not included" [ref=e598]:
                - img [ref=e599]
                - generic [ref=e600]: Not included
              - cell "Not included" [ref=e601]:
                - img [ref=e602]
                - generic [ref=e603]: Not included
              - cell "Included" [ref=e604]:
                - img [ref=e605]
                - generic [ref=e607]: Included
            - row "Address validation (USPS standardization) Not included Included Included Included" [ref=e608]:
              - rowheader "Address validation (USPS standardization)" [ref=e609]
              - cell "Not included" [ref=e610]:
                - img [ref=e611]
                - generic [ref=e612]: Not included
              - cell "Included" [ref=e613]:
                - img [ref=e614]
                - generic [ref=e616]: Included
              - cell "Included" [ref=e617]:
                - img [ref=e618]
                - generic [ref=e620]: Included
              - cell "Included" [ref=e621]:
                - img [ref=e622]
                - generic [ref=e624]: Included
            - row "Priority support Not included Not included Not included Included" [ref=e625]:
              - rowheader "Priority support" [ref=e626]
              - cell "Not included" [ref=e627]:
                - img [ref=e628]
                - generic [ref=e629]: Not included
              - cell "Not included" [ref=e630]:
                - img [ref=e631]
                - generic [ref=e632]: Not included
              - cell "Not included" [ref=e633]:
                - img [ref=e634]
                - generic [ref=e635]: Not included
              - cell "Included" [ref=e636]:
                - img [ref=e637]
                - generic [ref=e639]: Included
        - paragraph [ref=e640]: Monthly prices shown — annual billing is available at a discount. Smart suggestions reflect coverage reported to the FCC at the area level — reported coverage data, not a guarantee of service at your address.
      - generic [ref=e641]:
        - generic [ref=e642]:
          - img [ref=e643]
          - heading "Clear subscription terms" [level=3] [ref=e646]
        - generic [ref=e647]:
          - paragraph [ref=e648]: Free Access and Free Trial are separate. Free Access does not require a payment method and does not auto-charge.
          - paragraph [ref=e649]: Checkout shows today's due amount, billing interval, renewal terms, and first charge date before you subscribe.
          - paragraph [ref=e650]: Annual Individual trial terms are shown before payment. Monthly plans renew monthly until canceled.
          - paragraph [ref=e651]: Family and Pro require web billing. If a price is not configured, checkout will tell you before any subscription is created.
          - paragraph [ref=e652]: Smart provider suggestions with FCC broadband & utility data are included on every plan — including Free. Suggestions reflect coverage reported by providers to the FCC at the area level — reported coverage data, not a guarantee of service at your address.
        - generic [ref=e653]:
          - link "Terms" [ref=e654] [cursor=pointer]:
            - /url: /terms
          - link "Billing Policy" [ref=e655] [cursor=pointer]:
            - /url: /billing-policy
          - link "Refund Policy" [ref=e656] [cursor=pointer]:
            - /url: /refund
          - link "Privacy Policy" [ref=e657] [cursor=pointer]:
            - /url: /privacy
      - paragraph [ref=e658]: LocateFlow tracks your services and move workflow. Provider account updates require a supported partner connection or guided handoff; availability varies and you stay in control.
    - paragraph [ref=e661]: LocateFlow tracks moving workflows and local services. Provider account updates require a supported partner connection or guided handoff, and provider availability varies by address.
    - generic [ref=e663]:
      - heading "Frequently Asked Questions" [level=2] [ref=e665]
      - generic [ref=e666]:
        - group [ref=e667]:
          - generic "How does the free trial work?" [ref=e668] [cursor=pointer]:
            - text: How does the free trial work?
            - img [ref=e669]
        - group [ref=e671]:
          - generic "Can I cancel anytime?" [ref=e672] [cursor=pointer]:
            - text: Can I cancel anytime?
            - img [ref=e673]
        - group [ref=e675]:
          - generic "Do you offer refunds?" [ref=e676] [cursor=pointer]:
            - text: Do you offer refunds?
            - img [ref=e677]
        - group [ref=e679]:
          - generic "Is my data safe?" [ref=e680] [cursor=pointer]:
            - text: Is my data safe?
            - img [ref=e681]
      - paragraph [ref=e683]:
        - text: Still unsure?
        - link "Contact us" [ref=e684] [cursor=pointer]:
          - /url: /contact
        - text: — we'll help you pick the right plan.
    - contentinfo [ref=e685]:
      - generic [ref=e686]:
        - radiogroup "Theme preference" [ref=e688]:
          - radio "Match system" [checked] [ref=e689] [cursor=pointer]:
            - img [ref=e690]
          - radio "Light mode" [ref=e692] [cursor=pointer]:
            - img [ref=e693]
          - radio "Dark mode" [ref=e699] [cursor=pointer]:
            - img [ref=e700]
        - generic [ref=e702]:
          - generic [ref=e703]:
            - generic [ref=e704]:
              - img [ref=e705]
              - generic [ref=e712]: LocateFlow
            - paragraph [ref=e713]: Providers, addresses, and moving tasks in one place.
          - generic [ref=e714]:
            - heading "Product" [level=4] [ref=e715]
            - generic [ref=e716]:
              - link "About" [ref=e717] [cursor=pointer]:
                - /url: /about
              - link "Everything that follows your address" [ref=e718] [cursor=pointer]:
                - /url: /#features
              - link "Simple pricing. No surprises." [ref=e719] [cursor=pointer]:
                - /url: /pricing
              - link "How it works" [ref=e720] [cursor=pointer]:
                - /url: /how-it-works
              - link "Provider coverage" [ref=e721] [cursor=pointer]:
                - /url: /provider-coverage
              - link "Blog" [ref=e722] [cursor=pointer]:
                - /url: /blog
              - link "FAQ" [ref=e723] [cursor=pointer]:
                - /url: /faq
          - generic [ref=e724]:
            - heading "Privacy / Terms" [level=4] [ref=e725]
            - generic [ref=e726]:
              - link "Privacy Policy" [ref=e727] [cursor=pointer]:
                - /url: /privacy
              - link "Terms of Service" [ref=e728] [cursor=pointer]:
                - /url: /terms
              - link "Cookie Policy" [ref=e729] [cursor=pointer]:
                - /url: /cookie-policy
              - link "Disclaimer" [ref=e730] [cursor=pointer]:
                - /url: /disclaimer
              - link "Billing policy" [ref=e731] [cursor=pointer]:
                - /url: /billing-policy
              - link "Refund policy" [ref=e732] [cursor=pointer]:
                - /url: /refund
              - link "Data export and deletion" [ref=e733] [cursor=pointer]:
                - /url: /data-deletion
              - link "Acceptable use" [ref=e734] [cursor=pointer]:
                - /url: /acceptable-use
              - link "DPA" [ref=e735] [cursor=pointer]:
                - /url: /dpa
              - link "Security" [ref=e736] [cursor=pointer]:
                - /url: /security
              - link "California privacy" [ref=e737] [cursor=pointer]:
                - /url: /ccpa-privacy-notice
          - generic [ref=e738]:
            - heading "Help" [level=4] [ref=e739]
            - generic [ref=e740]:
              - link "FAQ" [ref=e741] [cursor=pointer]:
                - /url: /faq
              - link "Help Center" [ref=e742] [cursor=pointer]:
                - /url: /help
              - link "Blog" [ref=e743] [cursor=pointer]:
                - /url: /blog
              - link "RSS" [ref=e744] [cursor=pointer]:
                - /url: /blog/feed.xml
              - link "Contact" [ref=e745] [cursor=pointer]:
                - /url: /contact
        - generic [ref=e746]:
          - paragraph [ref=e747]: © 2026 LocateFlow. Privacy.
          - generic [ref=e748]:
            - 'button "Language: English" [ref=e750] [cursor=pointer]':
              - img [ref=e751]
              - img [ref=e761]
            - radiogroup "Theme preference" [ref=e763]:
              - radio "Match system" [checked] [ref=e764] [cursor=pointer]:
                - img [ref=e766]
              - radio "Light mode" [ref=e768] [cursor=pointer]:
                - img [ref=e769]
              - radio "Dark mode" [ref=e775] [cursor=pointer]:
                - img [ref=e776]
          - paragraph [ref=e778]: Made with care for movers everywhere.
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e784] [cursor=pointer]:
    - img [ref=e785]
  - alert [ref=e788]
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
     |       ^ Error: color-contrast (serious): Elements must meet minimum color contrast ratio thresholds — 16 node(s)
  28 |   });
  29 | }
  30 | 
```