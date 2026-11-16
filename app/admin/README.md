# Administrator routes

This feature is based on the uploaded `main` starter, not `feature/owner-pages`.
Read `/ADMIN_README.md` for startup, branch creation, and API integration.

- `/admin/login`: login
- `/admin`: summary
- `/admin/applications`: store application review
- `/admin/reports`: reported reviews
- `/admin/restrictions`: review-writing restrictions
- `/admin/orders`: support order lookup and cancellation
- `/admin/members`: member lookup

Default is browser demo mode, with independent administrator data.
No `app/owner`, `components/owner`, or `lib/owner` is required.
Real server endpoints and SQLite business tables are still a shared backend task.
