---
version: 1
slug: "app"
primary_target: "app"
related_targets: ["components"]
---

# Surface brief: whole app (signin, dashboard, activities, manager, tickets)

Scope: every authenticated route plus sign-in. Mode: Operate. Users on phones and office desktops.
Audience/job: employees log the day; managers review, filter, export, lock periods; tech team works the complaint queue.
Constraints: G-TEC brand navy/red + real logo; same routes, data, actions; Base UI shadcn primitives.

## Direction contract

THESIS: The app is the institute's front office: a deep-navy token board announces live numbers; a white counter below is where work gets done. Refuses the default white admin panel with same-size stat cards.

OWN-WORLD: Board navy #002b55 panel with the real G-TEC logo; LED dot-matrix numerals (red #ff2a1a, amber for pending, white for neutral) used only for counts and T-numbers. Counter: white on #f3f6fa ground, hairline borders, brand navy #004282 primary actions, one sans (two weights). Red means brand/urgent only; destructive is a separate deep rose. Priority as ink brightness. Hours right-aligned against an 8h day.

STORY: Staff glance at the board, see what matters now (today's hours / open queue), act at the counter, and never lose data to a stray click.

FIRST VIEWPORT: Full-width navy board: logo + nav + user top row; page title left and primary action right; LED counter row beneath. White counter starts directly under the board with filters then the table/log. On phones, counters scroll horizontally in the board; tables become stacked rows.

FORM: Token Board, #6 of 7 grounded list; seed key eb8d3b52. Raises: fixed digit positions with visible count change (Nixie); priority as brightness (Scroller); hours against 8h total (J-card); explicit 5-stage lifecycle track (Miura).

ADAPTATIONS (recorded after finish review): Forwarded keeps a violet lamp as a named, approved state colour (slate is already Duplicate/On hold). The lifecycle track shows four stages (Open, Taken up, Forwarded, Solved); Duplicate is an exit off the track, shown as a note. LED T-numbers appear at display size (ticket detail); at table size Doto reads thin, so rows use bold navy mono. Native selects stay on the Tickets GET filter (phone picker), styled to match the Base UI trigger.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
