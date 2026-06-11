# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> home has no serious or critical a11y violations
- Location: tests\e2e\accessibility.spec.ts:12:7

# Error details

```
Error: color-contrast (serious): Elements must meet minimum color contrast ratio thresholds — 34 node(s)

expect(received).toEqual(expected) // deep equality

- Expected  -    1
+ Received  + 1333

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
+                   ".h-9.hover\\:bg-primary\\/90.ring-offset-background",
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
+           ".h-9.hover\\:bg-primary\\/90.ring-offset-background",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f2f4f7",
+               "contrastRatio": 4.07,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.07 (foreground color: #2c7ac3, background color: #f2f4f7, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"min-h-screen bg-background\">",
+                 "target": Array [
+                   ".min-h-screen",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.07 (foreground color: #2c7ac3, background color: #f2f4f7, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div class=\"inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-primary\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".py-1\\.5.font-mono.gap-2",
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
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.48 (foreground color: #ffffff, background color: #2c7ac3, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button class=\"inline-flex items-ce...\">",
+                 "target": Array [
+                   "a[href$=\"sign-up\"] > .sm\\:w-auto.h-11.px-8",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.48 (foreground color: #ffffff, background color: #2c7ac3, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button class=\"inline-flex items-ce...\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "a[href$=\"sign-up\"] > .sm\\:w-auto.h-11.px-8",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f2f4f7",
+               "contrastRatio": 4.07,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.07 (foreground color: #2c7ac3, background color: #f2f4f7, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"min-h-screen bg-background\">",
+                 "target": Array [
+                   ".min-h-screen",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.07 (foreground color: #2c7ac3, background color: #f2f4f7, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div class=\"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wider text-primary\"><span class=\"h-1.5 w-1.5 rounded-full bg-primary\"></span>Does this look familiar</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".md\\:py-28.border-t.py-20:nth-child(4) > .max-w-3xl.mx-auto > .py-1.font-mono.gap-2",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f2efe9",
+               "contrastRatio": 2.89,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#b98318",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.89 (foreground color: #b98318, background color: #f2efe9, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"inline-flex items-center gap-2 rounded-full border border-tone-honey-br bg-tone-honey-bg px-3 py-1 text-xs text-tone-honey-fg dark:text-tone-honey-fg\"><span class=\"h-1.5 w-1.5 rounded-full bg-tone-honey-fg\"></span>What's actually at stake</div>",
+                 "target": Array [
+                   ".border-tone-honey-br.dark\\:text-tone-honey-fg.py-1",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"min-h-screen bg-background\">",
+                 "target": Array [
+                   ".min-h-screen",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.89 (foreground color: #b98318, background color: #f2efe9, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div class=\"inline-flex items-center gap-2 rounded-full border border-tone-honey-br bg-tone-honey-bg px-3 py-1 text-xs text-tone-honey-fg dark:text-tone-honey-fg\"><span class=\"h-1.5 w-1.5 rounded-full bg-tone-honey-fg\"></span>What's actually at stake</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-tone-honey-br.dark\\:text-tone-honey-fg.py-1",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f2f4f7",
+               "contrastRatio": 4.07,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.07 (foreground color: #2c7ac3, background color: #f2f4f7, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"min-h-screen bg-background\">",
+                 "target": Array [
+                   ".min-h-screen",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.07 (foreground color: #2c7ac3, background color: #f2f4f7, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div class=\"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wider text-primary\">The moving moment</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".md\\:py-28.border-t.py-20:nth-child(7) > .md\\:gap-16.md\\:items-center.gap-12 > div:nth-child(1) > .py-1.font-mono.gap-2",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#cbdde6",
+               "contrastRatio": 3.21,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "6.8pt (9px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.21 (foreground color: #2c7ac3, background color: #cbdde6, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-primary/30 bg-primary/10 text-primary\">Transfer</span>",
+                 "target": Array [
+                   ".bg-tone-emerald-bg.border-tone-emerald-br.p-3:nth-child(1) > .px-2.py-0\\.5.border-primary\\/30",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"flex items-center gap-3 rounded-xl border p-3 transition-colors border-tone-emerald-br bg-tone-emerald-bg\">",
+                 "target": Array [
+                   ".bg-tone-emerald-bg.border-tone-emerald-br.p-3:nth-child(1)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"rounded-3xl border bg-card p-7 shadow-xl\">",
+                 "target": Array [
+                   ".p-7",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.21 (foreground color: #2c7ac3, background color: #cbdde6, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-primary/30 bg-primary/10 text-primary\">Transfer</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".bg-tone-emerald-bg.border-tone-emerald-br.p-3:nth-child(1) > .px-2.py-0\\.5.border-primary\\/30",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#dad7d9",
+               "contrastRatio": 3.76,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#bd3d3f",
+               "fontSize": "6.8pt (9px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.76 (foreground color: #bd3d3f, background color: #dad7d9, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-destructive bg-destructive/10 text-destructive\">Cancel</span>",
+                 "target": Array [
+                   ".border-destructive",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"flex items-center gap-3 rounded-xl border p-3 transition-colors border-tone-emerald-br bg-tone-emerald-bg\">",
+                 "target": Array [
+                   ".bg-tone-emerald-bg.border-tone-emerald-br.p-3:nth-child(2)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"rounded-3xl border bg-card p-7 shadow-xl\">",
+                 "target": Array [
+                   ".p-7",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.76 (foreground color: #bd3d3f, background color: #dad7d9, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-destructive bg-destructive/10 text-destructive\">Cancel</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-destructive",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#d4e3ea",
+               "contrastRatio": 3.36,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2d7bc4",
+               "fontSize": "6.8pt (9px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.36 (foreground color: #2d7bc4, background color: #d4e3ea, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-tone-sky-br bg-tone-sky-bg text-tone-sky-fg\">Update</span>",
+                 "target": Array [
+                   ".bg-tone-emerald-bg.border-tone-emerald-br.p-3:nth-child(3) > .border-tone-sky-br.bg-tone-sky-bg.text-tone-sky-fg",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"flex items-center gap-3 rounded-xl border p-3 transition-colors border-tone-emerald-br bg-tone-emerald-bg\">",
+                 "target": Array [
+                   ".bg-tone-emerald-bg.border-tone-emerald-br.p-3:nth-child(3)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"rounded-3xl border bg-card p-7 shadow-xl\">",
+                 "target": Array [
+                   ".p-7",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.36 (foreground color: #2d7bc4, background color: #d4e3ea, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-tone-sky-br bg-tone-sky-bg text-tone-sky-fg\">Update</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".bg-tone-emerald-bg.border-tone-emerald-br.p-3:nth-child(3) > .border-tone-sky-br.bg-tone-sky-bg.text-tone-sky-fg",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#cfdae8",
+               "contrastRatio": 3.17,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "6.8pt (9px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.17 (foreground color: #2c7ac3, background color: #cfdae8, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-primary/30 bg-primary/10 text-primary\">Transfer</span>",
+                 "target": Array [
+                   ".p-3.bg-muted\\/40.border-border:nth-child(4) > .px-2.py-0\\.5.border-primary\\/30",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"flex items-center gap-3 rounded-xl border p-3 transition-colors border-border bg-muted/40\">",
+                 "target": Array [
+                   ".p-3.bg-muted\\/40.border-border:nth-child(4)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"rounded-3xl border bg-card p-7 shadow-xl\">",
+                 "target": Array [
+                   ".p-7",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.17 (foreground color: #2c7ac3, background color: #cfdae8, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-primary/30 bg-primary/10 text-primary\">Transfer</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".p-3.bg-muted\\/40.border-border:nth-child(4) > .px-2.py-0\\.5.border-primary\\/30",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#d7e0ec",
+               "contrastRatio": 3.32,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2d7bc4",
+               "fontSize": "6.8pt (9px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.32 (foreground color: #2d7bc4, background color: #d7e0ec, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-tone-sky-br bg-tone-sky-bg text-tone-sky-fg\">Update</span>",
+                 "target": Array [
+                   ".p-3.bg-muted\\/40.border-border:nth-child(5) > .border-tone-sky-br.bg-tone-sky-bg.text-tone-sky-fg",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"flex items-center gap-3 rounded-xl border p-3 transition-colors border-border bg-muted/40\">",
+                 "target": Array [
+                   ".p-3.bg-muted\\/40.border-border:nth-child(5)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"rounded-3xl border bg-card p-7 shadow-xl\">",
+                 "target": Array [
+                   ".p-7",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.32 (foreground color: #2d7bc4, background color: #d7e0ec, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-tone-sky-br bg-tone-sky-bg text-tone-sky-fg\">Update</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".p-3.bg-muted\\/40.border-border:nth-child(5) > .border-tone-sky-br.bg-tone-sky-bg.text-tone-sky-fg",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#cfdae8",
+               "contrastRatio": 3.17,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "6.8pt (9px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.17 (foreground color: #2c7ac3, background color: #cfdae8, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-primary/30 bg-primary/10 text-primary\">Transfer</span>",
+                 "target": Array [
+                   ".p-3.bg-muted\\/40.border-border:nth-child(6) > .px-2.py-0\\.5.border-primary\\/30",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"flex items-center gap-3 rounded-xl border p-3 transition-colors border-border bg-muted/40\">",
+                 "target": Array [
+                   ".p-3.bg-muted\\/40.border-border:nth-child(6)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"rounded-3xl border bg-card p-7 shadow-xl\">",
+                 "target": Array [
+                   ".p-7",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.17 (foreground color: #2c7ac3, background color: #cfdae8, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-primary/30 bg-primary/10 text-primary\">Transfer</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".p-3.bg-muted\\/40.border-border:nth-child(6) > .px-2.py-0\\.5.border-primary\\/30",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f2f4f7",
+               "contrastRatio": 4.07,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#2c7ac3",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.07 (foreground color: #2c7ac3, background color: #f2f4f7, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"min-h-screen bg-background\">",
+                 "target": Array [
+                   ".min-h-screen",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.07 (foreground color: #2c7ac3, background color: #f2f4f7, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div class=\"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wider text-primary\">Built for two languages</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".md\\:py-28.border-t.py-20:nth-child(10) > .md\\:gap-16.md\\:items-center.gap-12 > div:nth-child(1) > .py-1.font-mono.gap-2",
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
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<article class=\"rounded-2xl border bg-card p-6\">",
+                 "target": Array [
+                   ".sm\\:grid-cols-2.grid-cols-1.grid > article:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-[10px] font-mono uppercase tracking-wider text-primary\">EN</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "article:nth-child(1) > .font-mono.text-\\[10px\\].tracking-wider",
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
+               "fontSize": "13.1pt (17.5px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 13.1pt (17.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<article class=\"rounded-2xl border bg-card p-6\">",
+                 "target": Array [
+                   ".sm\\:grid-cols-2.grid-cols-1.grid > article:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 13.1pt (17.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"text-primary italic\">you forgot about.</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "article:nth-child(1) > .mt-2\\.5.leading-tight.text-xl > .italic.text-primary",
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
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<article class=\"rounded-2xl border bg-card p-6\">",
+                 "target": Array [
+                   ".sm\\:grid-cols-2.grid-cols-1.grid > article:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-[10px] font-mono uppercase tracking-wider text-primary\">ES</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "article:nth-child(2) > .font-mono.text-\\[10px\\].tracking-wider",
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
+               "fontSize": "13.1pt (17.5px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 13.1pt (17.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<article class=\"rounded-2xl border bg-card p-6\">",
+                 "target": Array [
+                   ".sm\\:grid-cols-2.grid-cols-1.grid > article:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.69 (foreground color: #2c7ac3, background color: #e6e9ef, font size: 13.1pt (17.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"text-primary italic\">que olvidaste.</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "article:nth-child(2) > .mt-2\\.5.leading-tight.text-xl > .italic.text-primary",
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
+           ".border-primary > .mb-5:nth-child(1) > .mb-2.justify-between.gap-3 > .tracking-wide.text-xs.uppercase",
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
+                   ".border-primary > .mb-5:nth-child(1) > .mb-2.justify-between.gap-3 > .px-2\\.5.py-0\\.5.text-\\[11px\\]",
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
+           ".border-primary > .mb-5:nth-child(1) > .mb-2.justify-between.gap-3 > .px-2\\.5.py-0\\.5.text-\\[11px\\]",
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
+           ".border-primary > .mb-5:nth-child(2) > .mt-2.text-xs.text-tone-emerald-fg",
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
+                   ".block > .hover\\:bg-primary\\/90.ring-offset-background.focus-visible\\:ring-ring",
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
+           ".block > .hover\\:bg-primary\\/90.ring-offset-background.focus-visible\\:ring-ring",
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
+                   "#pricing-plan-grid > article:nth-child(2)",
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
+           "article:nth-child(2) > .mb-5:nth-child(1) > .mb-2.justify-between.gap-3 > .tracking-wide.text-xs.uppercase",
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
+                   "#pricing-plan-grid > article:nth-child(2)",
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
+           "article:nth-child(2) > .mb-5:nth-child(2) > .mt-2.text-xs.text-tone-emerald-fg",
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
+                   "article:nth-child(3)",
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
+           "article:nth-child(3) > .mb-5:nth-child(1) > .mb-2.justify-between.gap-3 > .tracking-wide.text-xs.uppercase",
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
+                   "article:nth-child(3) > .mb-5:nth-child(1) > .mb-2.justify-between.gap-3 > .px-2\\.5.py-0\\.5.text-\\[11px\\]",
+                 ],
+               },
+               Object {
+                 "html": "<article class=\"flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm border-border\">",
+                 "target": Array [
+                   "article:nth-child(3)",
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
+           "article:nth-child(3) > .mb-5:nth-child(1) > .mb-2.justify-between.gap-3 > .px-2\\.5.py-0\\.5.text-\\[11px\\]",
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
+                   "article:nth-child(3)",
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
+           "article:nth-child(3) > .mb-5:nth-child(2) > .mt-2.text-xs.text-tone-emerald-fg",
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
+           ".plan-free > .block.font-semibold.text-primary",
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
+           ".bg-primary\\/5.align-top[scope=\"col\"]:nth-child(3) > .block.font-semibold.text-primary",
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
+           ".plan-family > .block.font-semibold.text-primary",
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
+           ".plan-pro > .block.font-semibold.text-primary",
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
+                 "html": "<button class=\"inline-flex items-ce...\" type=\"submit\">",
+                 "target": Array [
+                   "button[type=\"submit\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.48 (foreground color: #ffffff, background color: #2c7ac3, font size: 9.2pt (12.25px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button class=\"inline-flex items-ce...\" type=\"submit\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "button[type=\"submit\"]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#2c7ac3",
+               "contrastRatio": 3.46,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#d5e4f3",
+               "fontSize": "11.8pt (15.75px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.46 (foreground color: #d5e4f3, background color: #2c7ac3, font size: 11.8pt (15.75px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<section class=\"bg-primary text-primary-foreground py-20\">",
+                 "target": Array [
+                   ".bg-primary.text-primary-foreground.py-20",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.46 (foreground color: #d5e4f3, background color: #2c7ac3, font size: 11.8pt (15.75px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-lg opacity-80 max-w-xl mx-auto\">Export and deletion tools available in settings<!-- --> · <!-- -->Checkout terms shown before purchase</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".max-w-xl",
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
          - generic [ref=e56]:
            - img [ref=e57]
            - text: A moving companion
          - heading "If you moved tomorrow, do you remember every place that has your address?" [level=1] [ref=e59]
          - paragraph [ref=e60]: Tax refunds, court summons, jury duty notices, insurance checks, replacement debit cards, prescription refills — all delivered to the address on file. LocateFlow tracks every account tied to your home, so when you move, nothing slips through.
          - paragraph [ref=e61]: LocateFlow is a moving and address-change command center that helps you track providers, utilities, subscriptions, reminders, and tasks tied to every address.
          - generic [ref=e62]:
            - link "Get started" [ref=e63] [cursor=pointer]:
              - /url: /sign-up
              - button "Get started" [ref=e64]:
                - text: Get started
                - img [ref=e65]
            - link "See how it works" [ref=e67] [cursor=pointer]:
              - /url: /how-it-works
              - button "See how it works" [ref=e68]
          - generic [ref=e69]:
            - generic [ref=e70]:
              - img [ref=e71]
              - text: Checkout terms shown before purchase
            - generic [ref=e74]:
              - img [ref=e75]
              - text: Cancel anytime
            - generic [ref=e78]:
              - img [ref=e79]
              - text: Privacy rights and export tools
        - generic [ref=e84]:
          - img
          - generic [ref=e85]:
            - generic [ref=e86]:
              - img [ref=e88]
              - generic [ref=e91]:
                - text: OLD ADDRESS
                - generic [ref=e92]: 412 Larkspur Ln
            - generic [ref=e93]:
              - img [ref=e95]
              - generic [ref=e98]:
                - text: NEW ADDRESS
                - generic [ref=e99]: 88 Cedar Hill Dr
            - generic [ref=e100]:
              - generic [ref=e101]: "0"
              - generic [ref=e102]: moving…
            - img [ref=e105]
            - img [ref=e139]
            - img [ref=e143]
            - img [ref=e148]
            - img [ref=e152]
            - img [ref=e158]
            - img [ref=e162]
      - generic [ref=e167]:
        - generic [ref=e168]:
          - paragraph [ref=e169]: Built for manual coordination
          - paragraph [ref=e170]: Track each step locally. We don't call your providers, but we won't let you forget one.
        - generic [ref=e171]:
          - paragraph [ref=e172]: Listed providers, with caveats
          - paragraph [ref=e173]: Use directory guidance, then confirm details with the provider before you act.
        - generic [ref=e174]:
          - paragraph [ref=e175]: Web and mobile, in sync
          - paragraph [ref=e176]: Plan from your laptop. Check off from the U-Haul. Same data, same checklist.
    - generic [ref=e177]:
      - generic [ref=e178]:
        - generic [ref=e179]: Does this look familiar
        - heading "Twelve providers. Three addresses. One person trying to remember it all." [level=2] [ref=e181]
        - paragraph [ref=e182]: It's not laziness. It's volume. The average household is in business with 30+ companies, half of them on autopay you set up so long ago you've forgotten which credit card.
      - generic [ref=e183]:
        - generic [ref=e184]:
          - generic [ref=e185]: PG&E · $142.18·past due
          - generic [ref=e186]: Verizon·auto-renewing
          - generic [ref=e187]: Comcast·old address
          - generic [ref=e188]: USPS·forwarding · 3 days left
        - generic [ref=e189]:
          - generic [ref=e190]: Netflix · $19.99·charged
          - generic [ref=e191]: AT&T·disconnect failed
          - generic [ref=e192]: Geico·active
        - generic [ref=e193]:
          - generic [ref=e194]: ClassPass·unused 47 days
          - generic [ref=e195]: Anytime Fitness·unused 47 days
          - generic [ref=e196]: HOA·active
          - generic [ref=e197]: City Water·active
    - generic [ref=e198]:
      - generic [ref=e199]:
        - generic [ref=e200]: By the numbers
        - heading "The cost of forgetting, in receipts." [level=2] [ref=e201]
      - generic [ref=e202]:
        - generic [ref=e203]:
          - paragraph [ref=e204]: $273
          - paragraph [ref=e205]: Average household spend per year on subscriptions they don't use.
          - paragraph [ref=e206]: C+R Research · 2024
        - generic [ref=e207]:
          - paragraph [ref=e208]: 1 in 3
          - paragraph [ref=e209]: Movers continue paying utility bills at their previous address.
          - paragraph [ref=e210]: USPS NCOA · 2023
        - generic [ref=e211]:
          - paragraph [ref=e212]: 30M+
          - paragraph [ref=e213]: US households move every year. Most do it three or more times.
          - paragraph [ref=e214]: US Census · 2024
    - generic [ref=e215]:
      - generic [ref=e216]:
        - generic [ref=e217]: What's actually at stake
        - heading "What goes to your old address" [level=2] [ref=e219]
        - paragraph [ref=e220]: Every move leaves a paper trail. The pieces that get lost aren't the obvious ones.
      - generic [ref=e221]:
        - generic [ref=e222]:
          - img [ref=e224]
          - heading "Court & legal mail" [level=3] [ref=e228]
          - paragraph [ref=e229]: Jury duty summons. Subpoenas. Eviction notices. Missing one isn't an inconvenience — it's a default judgment.
        - generic [ref=e230]:
          - img [ref=e232]
          - heading "Tax forms & checks" [level=3] [ref=e235]
          - paragraph [ref=e236]: W-2s, 1099s, IRS refund checks, replacement debit cards. The mail USPS forwarding can't always catch.
        - generic [ref=e237]:
          - img [ref=e239]
          - heading "DMV, USCIS, Social Security" [level=3] [ref=e243]
          - paragraph [ref=e244]: License renewals, immigration notices, SSA statements. They expire quietly if you don't see them.
        - generic [ref=e245]:
          - img [ref=e247]
          - heading "Health & insurance" [level=3] [ref=e251]
          - paragraph [ref=e252]: Lab results, EOBs, prescription refills, claim checks. Sent to the address each provider has on file.
        - generic [ref=e253]:
          - img [ref=e255]
          - heading "The everyday stuff" [level=3] [ref=e259]
          - paragraph [ref=e260]: Online orders, HOA dues, security-deposit refunds, subscription cancellations. Lots of small leaks.
    - generic [ref=e262]:
      - generic [ref=e263]:
        - generic [ref=e264]: The moving moment
        - heading "Moving is when LocateFlow pays for itself." [level=2] [ref=e265]
        - paragraph [ref=e266]: Your service list becomes a one-tap checklist. State-specific rules for all 50 US states — what you can transfer, what you must cancel, what needs reconnecting before day one.
        - list [ref=e267]:
          - listitem [ref=e268]:
            - img [ref=e269]
            - generic [ref=e271]: USPS change-of-address, guided step by step.
          - listitem [ref=e272]:
            - img [ref=e273]
            - generic [ref=e275]: Cancellations tracked, account by account.
          - listitem [ref=e276]:
            - img [ref=e277]
            - generic [ref=e279]: Utility deposit refunds tracked, none forgotten.
          - listitem [ref=e280]:
            - img [ref=e281]
            - generic [ref=e283]: No more "wait, did I cancel that?"
      - generic [ref=e284]:
        - paragraph [ref=e286]: 432 OAK ST → 88 PINE LN · JUN 15
        - paragraph [ref=e287]: 11 tasks · 6 done
        - generic [ref=e290]:
          - generic [ref=e291]:
            - img [ref=e293]
            - paragraph [ref=e295]: PG&E
            - generic [ref=e296]: Transfer
          - generic [ref=e297]:
            - img [ref=e299]
            - paragraph [ref=e301]: Comcast
            - generic [ref=e302]: Cancel
          - generic [ref=e303]:
            - img [ref=e305]
            - paragraph [ref=e307]: Geico
            - generic [ref=e308]: Update
          - generic [ref=e309]:
            - paragraph [ref=e311]: AT&T Fiber
            - generic [ref=e312]: Transfer
          - generic [ref=e313]:
            - paragraph [ref=e315]: Netflix
            - generic [ref=e316]: Update
          - generic [ref=e317]:
            - paragraph [ref=e319]: USPS Forwarding
            - generic [ref=e320]: Transfer
    - generic [ref=e321]:
      - generic [ref=e322]:
        - heading "Everything that follows your address" [level=2] [ref=e323]
        - paragraph [ref=e324]: Bank, insurance, IRS, DMV, HOA, gym, streaming. One list per home.
      - generic [ref=e325]:
        - generic [ref=e326]:
          - img [ref=e328]
          - heading "Every account in one list" [level=3] [ref=e331]
          - paragraph [ref=e332]: Add each provider once and track billing dates, contract ends, and last-paid amounts across every home you live in. The list you can never quite recall when you actually need it.
        - generic [ref=e333]:
          - img [ref=e335]
          - heading "Know your new home before you arrive" [level=3] [ref=e338]
          - paragraph [ref=e339]: Flood zone, school district, moving-day weather & provider availability — pulled from public FEMA, NCES, FCC, and weather data so you see what you're walking into before the truck does.
        - generic [ref=e340]:
          - img [ref=e342]
          - heading "Caught before it costs you" [level=3] [ref=e345]
          - paragraph [ref=e346]: Renewal date coming up? Auto-pay fails on a card you cancelled? Contract renews while you're on vacation? Reminders reach you in time to act.
        - generic [ref=e347]:
          - img [ref=e349]
          - heading "Find what you stopped using" [level=3] [ref=e351]
          - paragraph [ref=e352]: The gym you haven't visited in eight months. The streaming bundle still charging a card you cancelled. We surface every recurring charge so you stop paying for things you forgot.
        - generic [ref=e353]:
          - img [ref=e355]
          - heading "Your records, export-ready" [level=3] [ref=e358]
          - paragraph [ref=e359]: Every address, service, and cost in one organized place — export a clean copy (CSV or PDF) the moment your accountant, landlord, or insurer asks.
        - generic [ref=e360]:
          - img [ref=e362]
          - heading "Nothing slips through on moving day" [level=3] [ref=e367]
          - paragraph [ref=e368]: When the day comes, your service list becomes a checklist. Transfer, cancel, or update each one — without the 3 a.m. realization that you forgot the storage unit.
    - generic [ref=e370]:
      - generic [ref=e371]:
        - img [ref=e372]
        - heading "How it works" [level=2] [ref=e407]
      - generic [ref=e408]:
        - generic [ref=e409]:
          - generic [ref=e410]: "1"
          - heading "Add your address" [level=3] [ref=e411]
          - paragraph [ref=e412]: One dashboard per home you live in or used to.
        - generic [ref=e413]:
          - generic [ref=e414]: "2"
          - heading "List what's tied to it" [level=3] [ref=e415]
          - paragraph [ref=e416]: Bank, insurance, utility, subscription — pick a category, save in seconds.
        - generic [ref=e417]:
          - generic [ref=e418]: "3"
          - heading "Get reminders that matter" [level=3] [ref=e419]
          - paragraph [ref=e420]: Billing dates, contract ends, renewal flags. Before they become a problem.
    - generic [ref=e422]:
      - generic [ref=e423]:
        - generic [ref=e424]: Built for two languages
        - heading "In English. En español. From day one." [level=2] [ref=e425]:
          - text: In English. En español.
          - text: From day one.
        - paragraph [ref=e426]: 62 million US Hispanic adults are 1.6× more likely to relocate than the general population. They're not an afterthought — they're our wedge. Every screen, every reminder, every checklist step ships in both languages.
      - generic [ref=e427]:
        - article [ref=e428]:
          - paragraph [ref=e429]: EN
          - heading "Stop paying for things you forgot about." [level=3] [ref=e430]
          - paragraph [ref=e431]: The average household spends $273/year on unused subscriptions. We surface them, you cancel them.
        - article [ref=e432]:
          - paragraph [ref=e433]: ES
          - heading "Deja de pagar por cosas que olvidaste." [level=3] [ref=e434]
          - paragraph [ref=e435]: El hogar promedio gasta $273 al año en suscripciones sin usar. Las encontramos, tú las cancelas.
    - generic [ref=e436]:
      - generic [ref=e437]:
        - generic [ref=e438]:
          - img [ref=e439]
          - text: Individual, Family, Pro
        - heading "Simple pricing for every move and household" [level=2] [ref=e442]
        - paragraph [ref=e443]: Save with annual billing across Individual, Family, and Pro.
      - tablist "Billing interval" [ref=e444]:
        - tab "AnnualSave up to 17%" [selected] [ref=e445] [cursor=pointer]:
          - text: Annual
          - generic [ref=e446]: Save up to 17%
        - tab "Monthly" [ref=e447] [cursor=pointer]
      - tabpanel "AnnualSave up to 17%" [ref=e448]:
        - article [ref=e449]:
          - generic [ref=e450]:
            - generic [ref=e451]:
              - paragraph [ref=e452]: For one person
              - generic [ref=e453]: Most popular
            - heading "Individual" [level=3] [ref=e454]
            - paragraph [ref=e455]: Track addresses, services, renewals, move tasks, and budgets in one calm place.
          - generic [ref=e456]:
            - text: $39.99/year
            - paragraph [ref=e457]: Save $7.89/year vs monthly (16% off)
          - list [ref=e458]:
            - listitem [ref=e459]:
              - img [ref=e461]
              - generic [ref=e464]: Up to 10 homes
            - listitem [ref=e465]:
              - img [ref=e467]
              - generic [ref=e471]: 100 service provider records
            - listitem [ref=e472]:
              - img [ref=e474]
              - generic [ref=e476]: "New Home Dossier: flood zone, school district & moving-day weather"
            - listitem [ref=e477]:
              - img [ref=e479]
              - generic [ref=e483]: Vehicle VIN decode & NHTSA recall check
            - listitem [ref=e484]:
              - img [ref=e486]
              - generic [ref=e488]: Move-week weather alerts & weekly digest
            - listitem [ref=e489]:
              - img [ref=e491]
              - generic [ref=e495]: Smart provider suggestions with FCC broadband & utility data
            - listitem [ref=e496]:
              - img [ref=e498]
              - generic [ref=e501]: Bills and renewal reminders
            - listitem [ref=e502]:
              - img [ref=e504]
              - generic [ref=e507]: Per-home monthly budgets
            - listitem [ref=e508]:
              - img [ref=e510]
              - generic [ref=e515]: Smart moving planner
            - listitem [ref=e516]:
              - img [ref=e518]
              - generic [ref=e522]: Custom providers
            - listitem [ref=e523]:
              - img [ref=e525]
              - generic [ref=e528]: CSV and PDF export
          - link "Get started" [ref=e530] [cursor=pointer]:
            - /url: /sign-up?plan=INDIVIDUAL&billingInterval=YEAR
            - button "Get started" [ref=e531]
        - article [ref=e532]:
          - generic [ref=e533]:
            - paragraph [ref=e535]: For households
            - heading "Family" [level=3] [ref=e536]
            - paragraph [ref=e537]: Share one household workspace with members, roles, more addresses, and more tracked services.
          - generic [ref=e538]:
            - text: $99/year
            - paragraph [ref=e539]: Save $20.88/year vs monthly (17% off)
          - list [ref=e540]:
            - listitem [ref=e541]:
              - img [ref=e543]
              - generic [ref=e548]: Up to 6 members (you + 5)
            - listitem [ref=e549]:
              - img [ref=e551]
              - generic [ref=e555]: 15 addresses
            - listitem [ref=e556]:
              - img [ref=e558]
              - generic [ref=e560]: 500 services
            - listitem [ref=e561]:
              - img [ref=e563]
              - generic [ref=e566]: AI move briefing — your move, explained
            - listitem [ref=e567]:
              - img [ref=e569]
              - generic [ref=e571]: Real map on route & address cards
            - listitem [ref=e572]:
              - img [ref=e574]
              - generic [ref=e576]: "New Home Dossier: flood zone, school district & moving-day weather"
            - listitem [ref=e577]:
              - img [ref=e579]
              - generic [ref=e583]: Smart provider suggestions with FCC broadband & utility data
            - listitem [ref=e584]:
              - img [ref=e586]
              - generic [ref=e591]: Shared household workspace
            - listitem [ref=e592]:
              - img [ref=e594]
              - generic [ref=e597]: Member roles and invites
            - listitem [ref=e598]:
              - img [ref=e600]
              - generic [ref=e603]: Child accounts
            - listitem [ref=e604]:
              - img [ref=e606]
              - generic [ref=e609]: CSV and PDF export
          - link "Choose Family" [ref=e611] [cursor=pointer]:
            - /url: /sign-up?plan=FAMILY&billingInterval=YEAR
            - button "Choose Family" [ref=e612]
        - article [ref=e613]:
          - generic [ref=e614]:
            - generic [ref=e615]:
              - paragraph [ref=e616]: For power users
              - generic [ref=e617]: Most capacity
            - heading "Pro" [level=3] [ref=e618]
            - paragraph [ref=e619]: Higher limits for multi-property owners, portfolios, home offices, and heavier workflows.
          - generic [ref=e620]:
            - text: $199/year
            - paragraph [ref=e621]: Save $40.88/year vs monthly (17% off)
          - list [ref=e622]:
            - listitem [ref=e623]:
              - img [ref=e625]
              - generic [ref=e627]: Everything in Family
            - listitem [ref=e628]:
              - img [ref=e630]
              - generic [ref=e635]: Up to 10 members
            - listitem [ref=e636]:
              - img [ref=e638]
              - generic [ref=e642]: 25 addresses
            - listitem [ref=e643]:
              - img [ref=e645]
              - generic [ref=e647]: 1,000 services
            - listitem [ref=e648]:
              - img [ref=e650]
              - generic [ref=e655]: FMCSA-registered mover suggestions
            - listitem [ref=e656]:
              - img [ref=e658]
              - generic [ref=e661]: New Home Dossier PDF export
            - listitem [ref=e662]:
              - img [ref=e664]
              - generic [ref=e666]: Up to 3 concurrent move plans
            - listitem [ref=e667]:
              - img [ref=e669]
              - generic [ref=e672]: Tax & property export (CSV + PDF)
            - listitem [ref=e673]:
              - img [ref=e675]
              - generic [ref=e678]: Partner Hub — guided partner updates
            - listitem [ref=e679]:
              - img [ref=e681]
              - generic [ref=e684]: Priority support
          - link "Choose Pro" [ref=e686] [cursor=pointer]:
            - /url: /sign-up?plan=PRO&billingInterval=YEAR
            - button "Choose Pro" [ref=e687]
      - generic [ref=e688]:
        - generic [ref=e689]:
          - heading "Compare plans" [level=3] [ref=e690]
          - paragraph [ref=e691]: Every plan side by side — the same limits and features the app actually enforces.
        - table "Compare plans" [ref=e693]:
          - caption [ref=e694]: Compare plans
          - rowgroup [ref=e695]:
            - row "Feature Free $0 Individual $3.99/month Family $9.99/month Pro $19.99/month" [ref=e696]:
              - columnheader "Feature" [ref=e697]:
                - generic [ref=e698]: Feature
              - columnheader "Free $0" [ref=e699]:
                - generic [ref=e700]: Free
                - generic [ref=e701]: $0
              - columnheader "Individual $3.99/month" [ref=e702]:
                - generic [ref=e703]: Individual
                - generic [ref=e704]: $3.99/month
              - columnheader "Family $9.99/month" [ref=e705]:
                - generic [ref=e706]: Family
                - generic [ref=e707]: $9.99/month
              - columnheader "Pro $19.99/month" [ref=e708]:
                - generic [ref=e709]: Pro
                - generic [ref=e710]: $19.99/month
          - rowgroup [ref=e711]:
            - row "Essentials" [ref=e712]:
              - columnheader "Essentials" [ref=e713]
            - row "Addresses 3 10 15 25" [ref=e714]:
              - rowheader "Addresses" [ref=e715]
              - cell "3" [ref=e716]
              - cell "10" [ref=e717]
              - cell "15" [ref=e718]
              - cell "25" [ref=e719]
            - row "Tracked services 10 100 500 1,000" [ref=e720]:
              - rowheader "Tracked services" [ref=e721]
              - cell "10" [ref=e722]
              - cell "100" [ref=e723]
              - cell "500" [ref=e724]
              - cell "1,000" [ref=e725]
            - row "Providers, bills & renewal reminders Included Included Included Included" [ref=e726]:
              - rowheader "Providers, bills & renewal reminders" [ref=e727]
              - cell "Included" [ref=e728]:
                - img [ref=e729]
                - generic [ref=e731]: Included
              - cell "Included" [ref=e732]:
                - img [ref=e733]
                - generic [ref=e735]: Included
              - cell "Included" [ref=e736]:
                - img [ref=e737]
                - generic [ref=e739]: Included
              - cell "Included" [ref=e740]:
                - img [ref=e741]
                - generic [ref=e743]: Included
            - row "Smart provider suggestions (FCC broadband & utility data) Not included Included Included Included" [ref=e744]:
              - rowheader "Smart provider suggestions (FCC broadband & utility data)" [ref=e745]
              - cell "Not included" [ref=e746]:
                - img [ref=e747]
                - generic [ref=e748]: Not included
              - cell "Included" [ref=e749]:
                - img [ref=e750]
                - generic [ref=e752]: Included
              - cell "Included" [ref=e753]:
                - img [ref=e754]
                - generic [ref=e756]: Included
              - cell "Included" [ref=e757]:
                - img [ref=e758]
                - generic [ref=e760]: Included
          - rowgroup [ref=e761]:
            - row "Moving" [ref=e762]:
              - columnheader "Moving" [ref=e763]
            - row "Full move plan, checklist & countdown Not included Included Included Included" [ref=e764]:
              - rowheader "Full move plan, checklist & countdown" [ref=e765]
              - cell "Not included" [ref=e766]:
                - img [ref=e767]
                - generic [ref=e768]: Not included
              - cell "Included" [ref=e769]:
                - img [ref=e770]
                - generic [ref=e772]: Included
              - cell "Included" [ref=e773]:
                - img [ref=e774]
                - generic [ref=e776]: Included
              - cell "Included" [ref=e777]:
                - img [ref=e778]
                - generic [ref=e780]: Included
            - row "New Home Dossier (flood zone, school district & moving-day weather) Not included Included Included Included" [ref=e781]:
              - rowheader "New Home Dossier (flood zone, school district & moving-day weather)" [ref=e782]
              - cell "Not included" [ref=e783]:
                - img [ref=e784]
                - generic [ref=e785]: Not included
              - cell "Included" [ref=e786]:
                - img [ref=e787]
                - generic [ref=e789]: Included
              - cell "Included" [ref=e790]:
                - img [ref=e791]
                - generic [ref=e793]: Included
              - cell "Included" [ref=e794]:
                - img [ref=e795]
                - generic [ref=e797]: Included
            - row "Vehicle VIN decode & NHTSA recall check Not included Included Included Included" [ref=e798]:
              - rowheader "Vehicle VIN decode & NHTSA recall check" [ref=e799]
              - cell "Not included" [ref=e800]:
                - img [ref=e801]
                - generic [ref=e802]: Not included
              - cell "Included" [ref=e803]:
                - img [ref=e804]
                - generic [ref=e806]: Included
              - cell "Included" [ref=e807]:
                - img [ref=e808]
                - generic [ref=e810]: Included
              - cell "Included" [ref=e811]:
                - img [ref=e812]
                - generic [ref=e814]: Included
            - row "Move-week weather alerts & weekly digest email Not included Included Included Included" [ref=e815]:
              - rowheader "Move-week weather alerts & weekly digest email" [ref=e816]
              - cell "Not included" [ref=e817]:
                - img [ref=e818]
                - generic [ref=e819]: Not included
              - cell "Included" [ref=e820]:
                - img [ref=e821]
                - generic [ref=e823]: Included
              - cell "Included" [ref=e824]:
                - img [ref=e825]
                - generic [ref=e827]: Included
              - cell "Included" [ref=e828]:
                - img [ref=e829]
                - generic [ref=e831]: Included
            - row "AI move briefing Not included Not included Included Included" [ref=e832]:
              - rowheader "AI move briefing" [ref=e833]
              - cell "Not included" [ref=e834]:
                - img [ref=e835]
                - generic [ref=e836]: Not included
              - cell "Not included" [ref=e837]:
                - img [ref=e838]
                - generic [ref=e839]: Not included
              - cell "Included" [ref=e840]:
                - img [ref=e841]
                - generic [ref=e843]: Included
              - cell "Included" [ref=e844]:
                - img [ref=e845]
                - generic [ref=e847]: Included
            - row "Real map on route & address cards Not included Not included Included Included" [ref=e848]:
              - rowheader "Real map on route & address cards" [ref=e849]
              - cell "Not included" [ref=e850]:
                - img [ref=e851]
                - generic [ref=e852]: Not included
              - cell "Not included" [ref=e853]:
                - img [ref=e854]
                - generic [ref=e855]: Not included
              - cell "Included" [ref=e856]:
                - img [ref=e857]
                - generic [ref=e859]: Included
              - cell "Included" [ref=e860]:
                - img [ref=e861]
                - generic [ref=e863]: Included
            - row "FMCSA-registered mover suggestions Not included Not included Not included Included" [ref=e864]:
              - rowheader "FMCSA-registered mover suggestions" [ref=e865]
              - cell "Not included" [ref=e866]:
                - img [ref=e867]
                - generic [ref=e868]: Not included
              - cell "Not included" [ref=e869]:
                - img [ref=e870]
                - generic [ref=e871]: Not included
              - cell "Not included" [ref=e872]:
                - img [ref=e873]
                - generic [ref=e874]: Not included
              - cell "Included" [ref=e875]:
                - img [ref=e876]
                - generic [ref=e878]: Included
            - row "New Home Dossier PDF export Not included Not included Not included Included" [ref=e879]:
              - rowheader "New Home Dossier PDF export" [ref=e880]
              - cell "Not included" [ref=e881]:
                - img [ref=e882]
                - generic [ref=e883]: Not included
              - cell "Not included" [ref=e884]:
                - img [ref=e885]
                - generic [ref=e886]: Not included
              - cell "Not included" [ref=e887]:
                - img [ref=e888]
                - generic [ref=e889]: Not included
              - cell "Included" [ref=e890]:
                - img [ref=e891]
                - generic [ref=e893]: Included
            - row "Concurrent move plans 1 1 1 3" [ref=e894]:
              - rowheader "Concurrent move plans" [ref=e895]
              - cell "1" [ref=e896]
              - cell "1" [ref=e897]
              - cell "1" [ref=e898]
              - cell "3" [ref=e899]
          - rowgroup [ref=e900]:
            - row "Household" [ref=e901]:
              - columnheader "Household" [ref=e902]
            - row "Members 1 1 6 10" [ref=e903]:
              - rowheader "Members" [ref=e904]
              - cell "1" [ref=e905]
              - cell "1" [ref=e906]
              - cell "6" [ref=e907]
              - cell "10" [ref=e908]
            - row "Shared household workspace Not included Not included Included Included" [ref=e909]:
              - rowheader "Shared household workspace" [ref=e910]
              - cell "Not included" [ref=e911]:
                - img [ref=e912]
                - generic [ref=e913]: Not included
              - cell "Not included" [ref=e914]:
                - img [ref=e915]
                - generic [ref=e916]: Not included
              - cell "Included" [ref=e917]:
                - img [ref=e918]
                - generic [ref=e920]: Included
              - cell "Included" [ref=e921]:
                - img [ref=e922]
                - generic [ref=e924]: Included
            - row "Child accounts Not included Not included Included Included" [ref=e925]:
              - rowheader "Child accounts" [ref=e926]
              - cell "Not included" [ref=e927]:
                - img [ref=e928]
                - generic [ref=e929]: Not included
              - cell "Not included" [ref=e930]:
                - img [ref=e931]
                - generic [ref=e932]: Not included
              - cell "Included" [ref=e933]:
                - img [ref=e934]
                - generic [ref=e936]: Included
              - cell "Included" [ref=e937]:
                - img [ref=e938]
                - generic [ref=e940]: Included
          - rowgroup [ref=e941]:
            - row "Power tools" [ref=e942]:
              - columnheader "Power tools" [ref=e943]
            - row "CSV & PDF export Not included Included Included Included" [ref=e944]:
              - rowheader "CSV & PDF export" [ref=e945]
              - cell "Not included" [ref=e946]:
                - img [ref=e947]
                - generic [ref=e948]: Not included
              - cell "Included" [ref=e949]:
                - img [ref=e950]
                - generic [ref=e952]: Included
              - cell "Included" [ref=e953]:
                - img [ref=e954]
                - generic [ref=e956]: Included
              - cell "Included" [ref=e957]:
                - img [ref=e958]
                - generic [ref=e960]: Included
            - row "Tax & property export Not included Not included Not included Included" [ref=e961]:
              - rowheader "Tax & property export" [ref=e962]
              - cell "Not included" [ref=e963]:
                - img [ref=e964]
                - generic [ref=e965]: Not included
              - cell "Not included" [ref=e966]:
                - img [ref=e967]
                - generic [ref=e968]: Not included
              - cell "Not included" [ref=e969]:
                - img [ref=e970]
                - generic [ref=e971]: Not included
              - cell "Included" [ref=e972]:
                - img [ref=e973]
                - generic [ref=e975]: Included
            - row "Partner Hub — guided partner updates Not included Not included Not included Included" [ref=e976]:
              - rowheader "Partner Hub — guided partner updates" [ref=e977]
              - cell "Not included" [ref=e978]:
                - img [ref=e979]
                - generic [ref=e980]: Not included
              - cell "Not included" [ref=e981]:
                - img [ref=e982]
                - generic [ref=e983]: Not included
              - cell "Not included" [ref=e984]:
                - img [ref=e985]
                - generic [ref=e986]: Not included
              - cell "Included" [ref=e987]:
                - img [ref=e988]
                - generic [ref=e990]: Included
            - row "Address validation (USPS standardization) Not included Included Included Included" [ref=e991]:
              - rowheader "Address validation (USPS standardization)" [ref=e992]
              - cell "Not included" [ref=e993]:
                - img [ref=e994]
                - generic [ref=e995]: Not included
              - cell "Included" [ref=e996]:
                - img [ref=e997]
                - generic [ref=e999]: Included
              - cell "Included" [ref=e1000]:
                - img [ref=e1001]
                - generic [ref=e1003]: Included
              - cell "Included" [ref=e1004]:
                - img [ref=e1005]
                - generic [ref=e1007]: Included
            - row "Priority support Not included Not included Not included Included" [ref=e1008]:
              - rowheader "Priority support" [ref=e1009]
              - cell "Not included" [ref=e1010]:
                - img [ref=e1011]
                - generic [ref=e1012]: Not included
              - cell "Not included" [ref=e1013]:
                - img [ref=e1014]
                - generic [ref=e1015]: Not included
              - cell "Not included" [ref=e1016]:
                - img [ref=e1017]
                - generic [ref=e1018]: Not included
              - cell "Included" [ref=e1019]:
                - img [ref=e1020]
                - generic [ref=e1022]: Included
        - paragraph [ref=e1023]: Monthly prices shown — annual billing is available at a discount. Smart suggestions reflect coverage reported to the FCC at the area level — reported coverage data, not a guarantee of service at your address.
      - generic [ref=e1024]:
        - generic [ref=e1025]:
          - img [ref=e1026]
          - heading "Clear subscription terms" [level=3] [ref=e1029]
        - generic [ref=e1030]:
          - paragraph [ref=e1031]: Free Access and Free Trial are separate. Free Access does not require a payment method and does not auto-charge.
          - paragraph [ref=e1032]: Checkout shows today's due amount, billing interval, renewal terms, and first charge date before you subscribe.
          - paragraph [ref=e1033]: Annual Individual trial terms are shown before payment. Monthly plans renew monthly until canceled.
          - paragraph [ref=e1034]: Family and Pro require web billing. If a price is not configured, checkout will tell you before any subscription is created.
          - paragraph [ref=e1035]: Smart provider suggestions with FCC broadband & utility data are included on every plan — including Free. Suggestions reflect coverage reported by providers to the FCC at the area level — reported coverage data, not a guarantee of service at your address.
        - generic [ref=e1036]:
          - link "Terms" [ref=e1037] [cursor=pointer]:
            - /url: /terms
          - link "Billing Policy" [ref=e1038] [cursor=pointer]:
            - /url: /billing-policy
          - link "Refund Policy" [ref=e1039] [cursor=pointer]:
            - /url: /refund
          - link "Privacy Policy" [ref=e1040] [cursor=pointer]:
            - /url: /privacy
      - paragraph [ref=e1041]: LocateFlow tracks your services and move workflow. Provider account updates require a supported partner connection or guided handoff; availability varies and you stay in control.
    - generic [ref=e1042]:
      - generic [ref=e1043]:
        - heading "What LocateFlow actually does" [level=2] [ref=e1044]
        - paragraph [ref=e1045]: We organize the calls and forms. You make them — we just make sure you don't miss any.
      - generic [ref=e1046]:
        - generic [ref=e1047]:
          - img [ref=e1048]
          - heading "What you'd otherwise forget" [level=3] [ref=e1051]
          - paragraph [ref=e1052]: Most people remember three or four accounts when they move. They discover the rest months later — through late fees, missed mail, or fraud alerts.
        - generic [ref=e1053]:
          - img [ref=e1054]
          - heading "Who you're calling" [level=3] [ref=e1057]
          - paragraph [ref=e1058]: Listed providers and location-aware guidance. Confirm details with the provider before you act - we don't call them for you.
        - generic [ref=e1059]:
          - img [ref=e1060]
          - heading "Wherever you're moving from" [level=3] [ref=e1063]
          - paragraph [ref=e1064]: Same data on web and mobile. Plan from your laptop. Check off from the U-Haul.
    - generic [ref=e1066]:
      - heading "Frequently Asked Questions" [level=2] [ref=e1068]
      - generic [ref=e1069]:
        - group [ref=e1070]:
          - generic "How does the free trial work?" [ref=e1071] [cursor=pointer]:
            - text: How does the free trial work?
            - img [ref=e1072]
        - group [ref=e1074]:
          - generic "Can I cancel anytime?" [ref=e1075] [cursor=pointer]:
            - text: Can I cancel anytime?
            - img [ref=e1076]
        - group [ref=e1078]:
          - generic "Do you offer refunds?" [ref=e1079] [cursor=pointer]:
            - text: Do you offer refunds?
            - img [ref=e1080]
        - group [ref=e1082]:
          - generic "Is my data safe?" [ref=e1083] [cursor=pointer]:
            - text: Is my data safe?
            - img [ref=e1084]
        - group [ref=e1086]:
          - generic "Does LocateFlow update my provider accounts?" [ref=e1087] [cursor=pointer]:
            - text: Does LocateFlow update my provider accounts?
            - img [ref=e1088]
        - group [ref=e1090]:
          - generic "What exactly does LocateFlow do?" [ref=e1091] [cursor=pointer]:
            - text: What exactly does LocateFlow do?
            - img [ref=e1092]
        - group [ref=e1094]:
          - generic "Will LocateFlow remind me before a service renews?" [ref=e1095] [cursor=pointer]:
            - text: Will LocateFlow remind me before a service renews?
            - img [ref=e1096]
        - group [ref=e1098]:
          - generic "Who can see my address and provider data?" [ref=e1099] [cursor=pointer]:
            - text: Who can see my address and provider data?
            - img [ref=e1100]
    - generic [ref=e1103]:
      - img [ref=e1105]
      - heading "Get early access & moving tips" [level=2] [ref=e1108]
      - paragraph [ref=e1109]: Join the list for product updates, new-city checklists, and renewal reminders worth knowing about. No spam — unsubscribe anytime.
      - generic [ref=e1111]:
        - generic [ref=e1112]:
          - generic [ref=e1113]: Email address
          - textbox "Email address" [ref=e1114]:
            - /placeholder: you@example.com
          - button "Notify me" [ref=e1115] [cursor=pointer]
        - paragraph [ref=e1116]: One email when there's something worth your time. No marketing lists.
    - generic [ref=e1118]:
      - generic [ref=e1119]:
        - generic [ref=e1120]: Mobile companion
        - heading "Your service list in your pocket" [level=2] [ref=e1122]
        - paragraph [ref=e1123]: The U-Haul cab is not where you want to remember the storage unit, the gym membership, or the prescription refill going to your old place. Log a bill, get a renewal nudge, check your monthly spend without leaving the couch.
        - list [ref=e1124]:
          - listitem [ref=e1125]:
            - img [ref=e1126]
            - text: Same data as web — addresses, services, providers in sync.
          - listitem [ref=e1129]:
            - img [ref=e1130]
            - text: Email and in-app reminders before auto-renew, ready to check off on any device.
          - listitem [ref=e1133]:
            - img [ref=e1134]
            - text: Provider recommendations and a guided checklist for every move.
        - generic [ref=e1137]:
          - link "Download LocateFlow on the App Store" [ref=e1138] [cursor=pointer]:
            - /url: https://apps.apple.com/us/app/locateflow/id6771878736
            - img [ref=e1139]
            - generic [ref=e1141]:
              - paragraph [ref=e1142]: Download on the
              - paragraph [ref=e1143]: App Store
          - link "Get LocateFlow on Google Play" [ref=e1144] [cursor=pointer]:
            - /url: https://play.google.com/store/apps/details?id=com.locateflow.mobile
            - img [ref=e1145]
            - generic [ref=e1150]:
              - paragraph [ref=e1151]: Get it on
              - paragraph [ref=e1152]: Google Play
      - generic [ref=e1157]:
        - generic [ref=e1158]:
          - generic [ref=e1159]: 9:41
          - generic [ref=e1161]:
            - img [ref=e1162]
            - img [ref=e1166]
        - generic [ref=e1168]:
          - generic [ref=e1169]:
            - generic [ref=e1170]:
              - paragraph [ref=e1171]: My address
              - paragraph [ref=e1172]:
                - img [ref=e1173]
                - text: 221B Baker St · Apt 4
            - button "Add" [ref=e1176] [cursor=pointer]:
              - img [ref=e1177]
          - generic [ref=e1178]:
            - img [ref=e1179]
            - generic [ref=e1182]: Search services…
        - generic [ref=e1183]:
          - generic [ref=e1184]:
            - paragraph [ref=e1185]: "12"
            - paragraph [ref=e1186]: Services
          - generic [ref=e1187]:
            - paragraph [ref=e1188]: "3"
            - paragraph [ref=e1189]: Due soon
          - generic [ref=e1190]:
            - paragraph [ref=e1191]: $284
            - paragraph [ref=e1192]: / month
        - generic [ref=e1193]:
          - generic [ref=e1194]:
            - img [ref=e1196]
            - generic [ref=e1198]:
              - paragraph [ref=e1199]: ConEd Electric
              - paragraph [ref=e1200]: Con Edison
            - generic [ref=e1201]:
              - generic [ref=e1202]: in 4 days
              - img [ref=e1203]
          - generic [ref=e1205]:
            - img [ref=e1207]
            - generic [ref=e1211]:
              - paragraph [ref=e1212]: Spectrum Internet
              - paragraph [ref=e1213]: Charter Spectrum
            - generic [ref=e1214]:
              - generic [ref=e1215]: in 12 days
              - img [ref=e1216]
          - generic [ref=e1218]:
            - img [ref=e1220]
            - generic [ref=e1223]:
              - paragraph [ref=e1224]: Netflix
              - paragraph [ref=e1225]: Netflix Inc.
            - generic [ref=e1226]:
              - generic [ref=e1227]: Renews Mar 18
              - img [ref=e1228]
          - generic [ref=e1230]:
            - img [ref=e1232]
            - generic [ref=e1234]:
              - paragraph [ref=e1235]: NYC Water
              - paragraph [ref=e1236]: DEP
            - generic [ref=e1237]:
              - generic [ref=e1238]: Quarterly
              - img [ref=e1239]
          - generic [ref=e1241]:
            - img [ref=e1243]
            - generic [ref=e1245]:
              - paragraph [ref=e1246]: Lemonade Renters
              - paragraph [ref=e1247]: Lemonade
            - generic [ref=e1248]:
              - generic [ref=e1249]: Annual · Aug
              - img [ref=e1250]
        - generic [ref=e1252]:
          - generic [ref=e1253]:
            - img [ref=e1254]
            - generic [ref=e1257]: Home
          - generic [ref=e1258]:
            - img [ref=e1259]
            - generic [ref=e1262]: Addresses
          - generic [ref=e1263]:
            - img [ref=e1264]
            - generic [ref=e1267]: Budget
          - generic [ref=e1268]:
            - img [ref=e1269]
            - generic [ref=e1272]: Alerts
    - generic [ref=e1274]:
      - img [ref=e1275]
      - heading "Move once. Remember everything." [level=2] [ref=e1277]
      - paragraph [ref=e1278]: Export and deletion tools available in settings · Checkout terms shown before purchase
      - link "Get started" [ref=e1279] [cursor=pointer]:
        - /url: /sign-up
        - button "Get started" [ref=e1280]:
          - text: Get started
          - img [ref=e1281]
    - contentinfo [ref=e1283]:
      - generic [ref=e1284]:
        - radiogroup "Theme preference" [ref=e1286]:
          - radio "Match system" [checked] [ref=e1287] [cursor=pointer]:
            - img [ref=e1288]
          - radio "Light mode" [ref=e1290] [cursor=pointer]:
            - img [ref=e1291]
          - radio "Dark mode" [ref=e1297] [cursor=pointer]:
            - img [ref=e1298]
        - generic [ref=e1300]:
          - generic [ref=e1301]:
            - generic [ref=e1302]:
              - img [ref=e1303]
              - generic [ref=e1310]: LocateFlow
            - paragraph [ref=e1311]: Providers, addresses, and moving tasks in one place.
          - generic [ref=e1312]:
            - heading "Product" [level=4] [ref=e1313]
            - generic [ref=e1314]:
              - link "About" [ref=e1315] [cursor=pointer]:
                - /url: /about
              - link "Everything that follows your address" [ref=e1316] [cursor=pointer]:
                - /url: /#features
              - link "Simple pricing. No surprises." [ref=e1317] [cursor=pointer]:
                - /url: /pricing
              - link "How it works" [ref=e1318] [cursor=pointer]:
                - /url: /how-it-works
              - link "Provider coverage" [ref=e1319] [cursor=pointer]:
                - /url: /provider-coverage
              - link "Blog" [ref=e1320] [cursor=pointer]:
                - /url: /blog
              - link "FAQ" [ref=e1321] [cursor=pointer]:
                - /url: /faq
          - generic [ref=e1322]:
            - heading "Privacy / Terms" [level=4] [ref=e1323]
            - generic [ref=e1324]:
              - link "Privacy Policy" [ref=e1325] [cursor=pointer]:
                - /url: /privacy
              - link "Terms of Service" [ref=e1326] [cursor=pointer]:
                - /url: /terms
              - link "Cookie Policy" [ref=e1327] [cursor=pointer]:
                - /url: /cookie-policy
              - link "Disclaimer" [ref=e1328] [cursor=pointer]:
                - /url: /disclaimer
              - link "Billing policy" [ref=e1329] [cursor=pointer]:
                - /url: /billing-policy
              - link "Refund policy" [ref=e1330] [cursor=pointer]:
                - /url: /refund
              - link "Data export and deletion" [ref=e1331] [cursor=pointer]:
                - /url: /data-deletion
              - link "Acceptable use" [ref=e1332] [cursor=pointer]:
                - /url: /acceptable-use
              - link "DPA" [ref=e1333] [cursor=pointer]:
                - /url: /dpa
              - link "Security" [ref=e1334] [cursor=pointer]:
                - /url: /security
              - link "California privacy" [ref=e1335] [cursor=pointer]:
                - /url: /ccpa-privacy-notice
          - generic [ref=e1336]:
            - heading "Help" [level=4] [ref=e1337]
            - generic [ref=e1338]:
              - link "FAQ" [ref=e1339] [cursor=pointer]:
                - /url: /faq
              - link "Help Center" [ref=e1340] [cursor=pointer]:
                - /url: /help
              - link "Blog" [ref=e1341] [cursor=pointer]:
                - /url: /blog
              - link "RSS" [ref=e1342] [cursor=pointer]:
                - /url: /blog/feed.xml
              - link "Contact" [ref=e1343] [cursor=pointer]:
                - /url: /contact
        - generic [ref=e1344]:
          - paragraph [ref=e1345]: © 2026 LocateFlow. Privacy.
          - generic [ref=e1346]:
            - 'button "Language: English" [ref=e1348] [cursor=pointer]':
              - img [ref=e1349]
              - img [ref=e1359]
            - radiogroup "Theme preference" [ref=e1361]:
              - radio "Match system" [checked] [ref=e1362] [cursor=pointer]:
                - img [ref=e1364]
              - radio "Light mode" [ref=e1366] [cursor=pointer]:
                - img [ref=e1367]
              - radio "Dark mode" [ref=e1373] [cursor=pointer]:
                - img [ref=e1374]
          - paragraph [ref=e1376]: Made with care for movers everywhere.
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e1382] [cursor=pointer]:
    - img [ref=e1383]
  - alert [ref=e1386]
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
     |       ^ Error: color-contrast (serious): Elements must meet minimum color contrast ratio thresholds — 34 node(s)
  28 |   });
  29 | }
  30 | 
```