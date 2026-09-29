# CommerceOS decisions

Source of truth: CommerceOS Engineering Specification v1.0 (September 2026). Record dated ambiguity resolutions, justified added dependencies, deviations and phase reports here. An entry is a planning choice until the corresponding code and tests exist.

## 2026-09-29 — Planning and sequencing

- **Decision:** Follow Section 12 phases 0 through 8 in order. Within Phase 0, establish npm workspaces → Angular app → Express API → TypeScript strict mode → MongoDB connection → shared package → environment validation → logging → error handling → Docker foundation, then complete the remaining Phase 0 tooling, API docs, sample route, CI and exit checks. **Reason:** This matches the project owner's requested foundation sequence while retaining every Section 12 deliverable. No application implementation has begun.
- **Decision:** Use the explicitly named tools and architecture in Section 2. Do not substitute a different framework, database, workspace manager, state library or test stack. Record any future dependency outside Section 2 before adding it. **Reason:** The specification makes the stack mandatory and requires added-dependency justification.
- **Decision:** Treat Section 12 phase gates with forward references as cumulative acceptance checks. Build and test each behavior when its owning resource exists, then close the full acceptance ID in the later phase: AC-RBAC-03 in Phase 4, AC-RBAC-04 and AC-CHK-06 in Phase 6, AC-INV-02 in Phase 7. **Reason:** The referenced order, admin customer, admin payment and dashboard features are scheduled after the earlier gates. This is a scheduling clarification, not a feature deferral or scope reduction.
- **Decision:** For AC-AUTH-01 and AC-CHK-05, explicitly recognize and discard `role` on public registration and client-supplied price/total fields on order placement; reject all other unknown fields with strict Zod schemas. **Reason:** The acceptance scenarios require these tampered inputs to have no authority, while Sections 8.1 and 9.2 require strict validation. Tests must prove they cannot affect persisted role or totals.
- **Decision:** Keep mock card tokenization in the browser-side mock provider boundary; the API accepts only token and last four digits, and never logs or stores PAN/CVC. **Reason:** Section 5.4 allows this route while checkout acceptance uses visible test card numbers.
- **Decision:** Treat the specified in-transaction mock charge as a mock-only behavior. If a real payment provider is ever introduced, design a separate compensation/idempotency workflow before enabling it. **Reason:** External charges cannot join a MongoDB transaction; real processing is explicitly out of scope.
- **Decision:** Plan to validate SKU uniqueness both within a product's variants and across products. **Reason:** The requested unique multikey index alone may not protect duplicate values inside one document.

## Phase reports

No phase has shipped. At each completed phase, add its date, shipped scope, deviations, test/exit evidence and any deferred COULD items, then tag as required by Section 12.

## 2026-09-29 — Foundation implementation choices

- **Decision:** Use Angular 21.2 with TypeScript 5.9 and Node.js 24 LTS. **Reason:** Angular 22 is the newest stable Angular, but it requires TypeScript 6.0; Angular 21.2 is the newest Angular line compatible with the specification's mandatory TypeScript 5.x. This is a documented version deviation, not a technology substitution.
- **Decision:** Add `tsx` for the API watch command, `tsc-alias` so compiled TypeScript path aliases work in Node, `yaml` to read the required OpenAPI YAML, `concurrently` for the root dev command, and `@eslint/js`/`@typescript-eslint` for the specified ESLint rules. **Reason:** These are build/runtime adapters for the specified tools, not replacement technologies.
- **Decision:** Generate an ephemeral JWT secret in development when `.env` leaves it blank, while requiring an explicit 32-character secret in production. **Reason:** A clean development clone can boot after copying `.env.example` without committing a real secret.
- **Decision:** Use CommonJS output for the Express API while retaining strict TypeScript and `@api/*` path aliases. **Reason:** This keeps Jest/ts-jest integration straightforward; module format is not fixed by the specification.
- **Status:** Foundation source, workspaces, Angular, API, MongoDB connection, validation, logging, errors, OpenAPI sample route, CI and Docker files have been added on `feat/phase-0-foundation`. Local lint, production builds and tests pass; the API has 76.96% line coverage. Compose YAML parses, but the Phase 0 exit gate remains open because Docker and the GitHub Actions runner are unavailable for a live Compose/CI verification. No phase completion tag has been created.
