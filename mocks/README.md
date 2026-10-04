# Mocks (CONTRACT §10)

Example replies for each route in CONTRACT §8, so the frontend can be built before the backend is ready.
Shapes match §8 exactly. If §8 changes, update these files in the same PR.

| File | Route |
| --- | --- |
| `pillars-suggest.json` | `POST /api/pillars/suggest` |
| `grove-post.json` | `POST /api/grove` |
| `grove.json` | `GET /api/grove` |
| `journals.json` | `POST /api/journals` (3 blooms, 1 friction, 1 lantern) |
| `journals-get.json` | `GET /api/journals` (that entry, confirmed) |
| `extractions-confirm.json` | `POST /api/extractions/:id/confirm` |
| `pillars-trail.json` | `GET /api/pillars/:id/trail` (the Projects tree) |

They tell one story: one Grove with five Pillars, one journal entry, and its confirm,
where the user keeps everything and rewords the recruiter bloom (status `edited`).

The journal body behind `journals.json`, for checking quote offsets against `normalize(body)` (§6):

> I finished the homepage for my portfolio, practiced two interview problems on LeetCode, and emailed a recruiter about summer internships. I kept putting off my resume though.

Not mocked: `GET /api/grove` returning 404 (no Grove yet). The frontend shows onboarding in that case.
