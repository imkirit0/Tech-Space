# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
G-TEC Education internal staff, on a mix of office desktops and phones (mobile must be first-class):
- **Employees** log their daily work activities (what, who assigned it, status, hours, deadline) and edit them until a reporting period is locked.
- **Managers** review all employee activity, filter it, export it to Excel, and lock reporting periods.
- **Tech team** (allow-listed by email) log and work complaint tickets from phone/WhatsApp/email/walk-ins: take up, forward, follow up, solve, notify the contact on WhatsApp.

## Product Purpose
One internal place for daily work reporting and the tech complaint queue. Success: employees log their day in under a minute, managers see who submitted and what's pending at a glance, and no complaint ticket goes quiet or gets duplicated.

## Operating Context
- Sign-in via Google, restricted to gteceducation.com accounts; roles resolved from env allow-lists (MANAGER_EMAILS, TECH_EMAILS).
- Dates and times are IST (Asia/Kolkata). Ticket numbers are shown as T-numbers.
- Managers export filtered activity to Excel for review.
- Solved tickets hand off to WhatsApp (wa.me link with a prefilled message).

## Capabilities and Constraints
- Next.js 16 App Router, Tailwind 4, shadcn on Base UI, Prisma on Supabase Postgres, Auth.js v5.
- Activities: create/edit/delete own entries; locked periods are read-only.
- Tickets: statuses Open, Taken Up, Forwarded, Solved, Duplicate; priorities Low–Urgent; categories Tech/Non-tech; attachments; follow-up notes; a "needs follow-up" flag after 48h quiet on a forwarded ticket; similar-issue resolution estimates.
- Managers can delete any activity and any ticket.
- Tasks: managers assign work privately or post it to the team board; staff add tasks to the team board (open for anyone, or taken themselves). Anyone can take up an unassigned board task (atomic, first wins) or release it back. Every task has a Slack-style thread with status events (To do, In progress, Blocked, Done), unread badges for tasks you are part of, and ~10s auto-refresh. Everyone can comment on board tasks; only the assignee, creator or a manager can change status. Managers can notify an assignee on WhatsApp (one-tap wa.me link).

## Brand Commitments
- G-TEC Education identity: brand navy `#004282` and brand red `#ff0000` on white, taken from gteceducation.com (logo + favicon). The site UI also uses deep navy `#003b5c` and bright blue `#008ed0`.
- Official logo (red mortarboard + arc, white wordmark) is designed for dark grounds; favicon is a navy shield with a red "G".

## Evidence on Hand
- Logo and favicon from gteceducation.com (`/assets/img/logo/logo.webp`, `/assets/img/favicon/`). No other brand guidelines on hand.

## Product Principles
- Logging must be faster than not logging: fewest fields visible, sensible defaults, today pre-filled.
- State over decoration: status, lock, and staleness are always legible at a glance.
- Destructive actions are never one click away from an accident.
- Works equally on a phone in a corridor and on an office desktop.
