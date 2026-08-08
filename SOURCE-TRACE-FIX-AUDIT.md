# SOURCE-TRACE-FIX-AUDIT

Proof-of-work: investigasi & fix bug source trace tidak tampil di HTML/ANSI
untuk inline template yang dilewatkan via wrapper (`renderTemplate`), plus audit
kepatuhan terhadap *Project Architecture & Coding Standards*.

Route reproduksi: `http://localhost:4000/errors/undefined-value-match`

---

## 1. Root cause

Mekanisme auto-caller detection hanya menangkap **satu frame stack** (pemanggil
langsung `render()`).

- **Sebelum refaktor** (sebelum commit `f27b663d`): route memanggil `render()`
  **langsung** di `routes/errors.ts` → frame ke-3 = `errors.ts`, yang berisi
  literal `'{{ product.name }}'` → `extractCallerPosition` menemukannya →
  source trace menampilkan `errors.ts` dengan caret di `name`. ✅
- **Sesudah refaktor**: route memanggil `renderTemplate(...)`, dan wrapper
  `render-template.ts` yang memanggil `render()`. Frame ke-3 = `render-template.ts`
  (wrapper) yang **tidak** berisi literal. Literal ada di `errors.ts` (frame ke-4).
- Sebuah perubahan lokal (uncommitted) lalu membuat fallback menampilkan
  **seluruh file host** saat literal tidak ketemu → source trace menampilkan kode
  `render-template.ts:9` yang tidak relevan. Inilah "mismatch"-nya.

**Inti**: asumsi "literal selalu ada di file pemanggil langsung `render()`" rusak
saat ada satu lapis wrapper di antaranya.

## 2. Fix — multi-frame stack walk

Daripada hanya menangkap satu frame, sekarang `getCallerFrames()` menangkap
**slice frame 3..3+6** (filter `node_modules` / `node:`), lalu `resolveLocation`
**mencari literal di tiap file kandidat secara berurutan** dan memakai file
pertama yang mengandung literal. Hasil:

- inline template via wrapper → source trace menunjuk ke file route (`errors.ts`)
  dengan caret di token yang gagal (`name`). ✅
- file template (`.njk`) → tetap menunjuk ke file `.njk`. ✅

## 3. Files changed

| File | Perubahan |
|---|---|
| `render/caller-file.ts` | `getCallerFrames()` (stack walk); hapus dead code `getCallerFile`/`getCallerLocation`/`captureCaller` |
| `render/render.ts` | capture `callerFrames` **sekali**; derive `callerFile`/`callerLocation` dari `frame[0]` |
| `render/render-types.ts` | field `callerFrames?: readonly CallerLocation[] \| null` |
| `diagnostics/error-location.ts` | rewrite resolusi: kandidat-list + `reduce` + discriminated union |
| `diagnostics/error-location-types.ts` | canonical `CallerLocation` type + field `callerFrames` |
| `diagnostics/diagnostics.ts` | thread `callerFrames`; ekstrak `buildLocationInputs` (options object) |
| `diagnostics/error-location.test.ts` | +2 regression test (single-caller fallback; multi-frame walk) |
| `render/error-locations.test.ts` | +1 end-to-end test via `renderViaExternalWrapper` fixture |
| `render/fixtures/external-wrapper.ts` | **new** — fixture wrapper modul terpisah (simulasi `renderTemplate` Express) |

## 4. Exhaustive standards audit

### Core Paradigms (Clean Code / SOLID / YAGNI / KISS / FP)
| Item | Status | Bukti |
|---|---|---|
| Pure functions untuk domain logic | ✅ | `foldCandidateSearch`, `buildCallerCandidates`, `resolvePreferCallerLocation`, `resolveTemplateLocation` pure |
| Functional Core, Imperative Shell | ✅ | side-effect (`readFile`, stack capture via `Error.prepareStackTrace`) terisolasi di `readCandidateContents` / `captureCallerStack` dengan WHY comment |
| Immutability | ✅ | `buildCallerCandidates` pakai spread/map (tanpa `push` mutable); `INITIAL_SEARCH_OUTCOME` const |
| YAGNI / no over-engineering | ✅ | konsolidasi triple stack-capture → single capture; hapus dead code |
| SOLID-Single Responsibility | ✅ | `caller-file.ts` = stack capture saja; `error-location.ts` = resolusi saja |

### Architectural Layering
| Item | Status | Bukti |
|---|---|---|
| ADT via Discriminated Union | ✅ | `CallerSearchOutcome = matched \| unreadable \| not-found` |
| Map/Filter/Reduce, **zero for/while** | ✅ | `reduce` (remeda), `map`, `filter`, `Promise.all` |
| Layering direction benar | ✅ | `render → diagnostics`; `CallerLocation` canonical di diagnostics, di-import type-only oleh render |
| Privacy via module scope | ✅ | hanya `resolveLocation` & `getCallerFrames` di-export; helper internal |

### Function Design
| Item | Status | Bukti |
|---|---|---|
| Parameter limit ≤ 2 | ✅ | semua fungsi 0–2 param; `buildLocationInputs` & `renderViaExternalWrapper` pakai options object |
| Explicit error handling (Result/Option) | ✅ | `render()` return `Result`; `readCandidateContents` pakai `null` (Option) untuk file unreadable |

### Type Safety
| Item | Status | Bukti |
|---|---|---|
| Zero `any` (production/domain code) | ✅ | semua type eksplisit; no `as` blind cast (`INITIAL_SEARCH_OUTCOME: CallerSearchOutcome`) |
| DRY type definitions | ✅ | `CallerLocation` satu sumber di `error-location-types.ts` |

### Naming & Readability
| Item | Status | Bukti |
|---|---|---|
| Semantic naming (no numeric suffix) | ✅ | `CallerCandidate`, `CandidateMatch`, `CallerSearchOutcome`, `primaryCaller`, `explicitCaller`, `autoCallers` |
| No shadowing, no `_` pseudo-private | ✅ | dicek manual |
| WHY comments only | ✅ | komentar hanya menjelaskan "why" (bukan "what") |

### Issues ditemukan & diperbaiki selama audit berlapis
1. **DRY** — bentuk type `callerFrames` diduplikasi 3× → canonical `CallerLocation`.
2. **Layering** — koreksi arah dependensi (`render → diagnostics`).
3. **Blind `as` cast** pada reduce initial value → typed const.
4. **Parameter limit** — `buildLocationInputs` 3-param → options object.
5. **YAGNI** — triple stack-capture per `render()` → single capture.
6. **Dead code** — hapus `getCallerFile`/`getCallerLocation`/`captureCaller`/`MIN_STACK_LENGTH`.
7. **Immutability** — `buildCallerCandidates` mutable `push` → spread/map.
8. **Parameter limit** — fixture `renderViaExternalWrapper` 3-param → single options object.

## 5. Test coverage (mencegah regresi)

- `error-location.test.ts`:
  - "falls back to template coords when the literal is absent from a single readable caller"
  - "walks up the caller frames to the file that actually contains the literal"
- `error-locations.test.ts`:
  - "source trace walks up past an external wrapper module to the file owning the literal" — **end-to-end via `render()` publik + fixture modul terpisah**; test inilah yang akan langsung merah jika asumsi single-frame kembali dimasukkan.

Total: 1853 → **1856 tests** (+3 regression).

## 6. Verification

```
bun run typecheck   # tsc --noEmit          → 0 error
bun run lint        # biome lint packages samples → 0 error (506 files)
bun test            # 1856 pass / 0 fail
```

Live (semua route inline): `routes/errors.ts:<line>`; route file-template:
`views/errors/<name>.njk`. Tidak ada lagi yang menunjuk `lib/render-template.ts`.
