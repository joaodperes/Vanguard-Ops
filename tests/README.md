# Regression tests: stable behavior, flexible content

Favor tests of **player-facing behavior, safety, persistence, navigation, and data integrity** over snapshots of an ever-growing catalog.

- Do **not** assert global totals of weapons, Wonders, attachments, or shop categories. Content expansion should not require changing unrelated tests.
- Do **not** hardcode an AI bot's roster index or exact role split unless it is a documented game rule. Verify valid, reachable goals, objective pursuit, and a sensible mix of roles instead.
- Do test intentional gameplay contracts (for example, one throwing melee knife per life, no friendly explosive damage, no Wonder charge from a respawn). These are specifications, not accidental counts.
- Avoid bypassing the FPS engine constructor for broad integration tests. Test pure rules directly when possible; when a partial engine is necessary, use `tests/helpers/engine-stub.ts` for shared defaults and stub unrelated world rendering.
- When changing intended gameplay, update the relevant behavior test *with* the implementation. Do not weaken a genuine regression merely to make CI green.

`bun run test:smoke` should fail for broken behavior or invalid content, not because a new legitimate item was added.
