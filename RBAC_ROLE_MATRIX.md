# 🗂️ RBAC Role Matrix

| Permission / Action                | Admin | Coordinator | Supervisor | Auditor (certified) | Staff |
|------------------------------------|:-----:|:-----------:|:---------:|:-------------------:|:-----:|
| Institutional Overview             |  ✓    |      ✓      |     ✓     |         ✓           |   ✓   |
| View All Dept Schedules            |  ✓    |      ✗      |     ✗     |         ✗           |   ✗   |
| View Own Dept Schedule             |  ✓    |      ✓      |     ✓     |         ✓           |   ✓   |
| View Cross-Audit Dept Schedules    |  ✓    |      ✓      |     ✓     |         ✓           |   ✗   |
| View Audit Matrix                  |  ✓    |      ✓      |     ✓     |         ✓           |   ✗   |
| Set Audit Dates                    |  ✓    |      ✓*     |     ✓*    |         ✗           |   ✗   |
| Self-Assign (internal audit)       |  ✓    |      ✗      |     ✓     |         ✓           |   ✗   |
| Self-Assign (cross-audit)          |  ✓    |      ✗      |     ✓     |         ✓           |   ✗   |
| Assign Others (schedule)           |  ✓    |      ✗      |     ✗     |         ✗           |   ✗   |
| Auto-Assign                        |  ✓    |      ✗      |     ✗     |         ✗           |   ✗   |
| Officer Hub                        |  ✓    |      ✗      |     ✓     |         ✓           |   ✗   |
| View All Members                   |  ✓    |      ✗      |     ✗     |         ✗           |   ✗   |
| View Dept Members                  |  ✓    |      ✓      |     ✓     |         ✗           |   ✗   |
| Add/Edit Team                      |  ✓    |      ✓      |     ✗     |         ✗           |   ✗   |
| Department Registry                |  ✓    |      ✓**    |     ✗     |         ✗           |   ✗   |
| Location Registry                  |  ✓    |      ✓**    |     ✓**   |         ✗           |   ✗   |
| Admin Hub                          |  ✓    |      ✗      |     ✗     |         ✗           |   ✗   |
| System Settings                    |  ✓    |      ✗      |     ✗     |         ✗           |   ✗   |

---

**Legend & Notes:**
- ✓ = Allowed ✗ = Not allowed
- * Supervisor has priority to set audit dates; Coordinator can only set if Supervisor has not.
- ** Coordinator: assign HOD only, name/abbr/total assets locked; can assign self/others as Supervisor to location (own dept), can edit abbr, name locked. Supervisor: can assign self as Supervisor to location, cannot assign others.
- Auditor = any user (Coordinator, Supervisor, or Staff) who is certified as Auditor.
- Self-assign (internal/cross-audit) always enforces COI and cross-audit matrix rules.
