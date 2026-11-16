# API integration

The frontend calls the supplied API specification's A-01..A-03 and X-00..X-14.
`lib/admin/api.js` is the single transport adapter.

- Default: `NEXT_PUBLIC_USE_MOCK` is not `false` -> isolated browser demo.
- Live: set `NEXT_PUBLIC_USE_MOCK=false`, restart Next.js, provide the real endpoints.
- `NEXT_PUBLIC_API_BASE` empty -> same-origin `/api`; otherwise append `/api` to that origin.
- Requests include cookies (`credentials: include`); mutations send JSON.
- Responses: `{ success: true, data: ... }` or `{ success: false, error: { code, message, fields? } }`.
- Lists accept an array or a `{ items, page, size, totalCount }` envelope. The current UI uses local page controls when given a full array.
- Backend must authenticate sessions, authorize ADMIN, check record state and perform atomic writes.
- Real errors are displayed and do not silently switch the frontend back to mock data.

No runtime import points at lib/owner, components/owner or app/owner.
When owner and administrator branches are merged, the pages use the same backend API,
not the same browser demo storage. Unify mock fixtures separately only if needed.
