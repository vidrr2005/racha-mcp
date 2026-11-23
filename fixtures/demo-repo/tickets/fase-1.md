# Fase 1

## Ola 1 — Dominio

F1-001 — Free slots are computed from opening hours and existing appointments
  Estado: ✅
  Módulo: packages/dominio
  Superficie: dominio
  Riesgo: bajo
  Dependencias: —
  Bloqueado por: —
  Spec: §4.1
  DoD:
    - `freeSlots(hours, appointments)` returns only slots inside hours and without overlap (test)
    - `check-all` green

F1-002 — A booking is rejected by the database when it overlaps another one
  Estado: ✅
  Módulo: apps/web/prisma
  Superficie: web
  Riesgo: alto
  Dependencias: F1-001
  Bloqueado por: —
  Spec: §4.2
  DoD:
    - exclusion constraint on (doctor, time range) (migration + concurrency test)

F1-003 — Reminders are scheduled one day before the appointment
  Estado: ⬜
  Módulo: packages/dominio
  Superficie: dominio
  Riesgo: bajo
  Dependencias: F1-001
  Bloqueado por: —
  Spec: §5.1
  DoD:
    - `reminderAt(appointment)` is 24 h before, in the clinic time zone (test)

## Ola 2 — Data access

F1-004 — Bookings are written only through lib/db with the constraint as the guard
  Estado: 🟦
  Módulo: apps/web/lib/db
  Superficie: web
  Riesgo: alto
  Dependencias: F1-002
  Bloqueado por: —
  Spec: §4.2
  DoD:
    - `createBooking` maps the constraint error to `slot_taken` (test)

F1-005 — Doctors list their own day
  Estado: ⬜
  Módulo: apps/web/lib/db/doctors
  Superficie: web
  Riesgo: bajo
  Dependencias: F1-002
  Bloqueado por: —
  Spec: §6.1
  DoD:
    - `doctorDay(doctorId, date)` returns only that doctor's appointments (test)

F1-006 — Clinic settings page
  Estado: ⬜
  Módulo: apps/web/app/settings
  Superficie: web
  Riesgo: bajo
  Dependencias: F1-004
  Bloqueado por: —
  Spec: §7.1
  DoD:
    - settings page shows opening hours (screenshot)

F1-007 — Email adapter with a fake transport for tests
  Estado: ⬜
  Módulo: packages/integraciones
  Superficie: integraciones
  Riesgo: bajo
  Dependencias: —
  Bloqueado por: —
  Spec: §8.1
  DoD:
    - `FakeMailer` records messages; no test calls a real provider (test)

F1-008 — Held slots expire
  Estado: ⬜
  Módulo: packages/dominio/hold
  Superficie: dominio
  Riesgo: bajo
  Dependencias: F1-001
  Bloqueado por: A-01
  Spec: §4.3
  DoD:
    - a hold older than the hold window is released (test)

F1-009 — Patients cancel by link
  Estado: ⬜
  Módulo: apps/web/app/cancel
  Superficie: web
  Riesgo: alto
  Dependencias: F1-004
  Bloqueado por: A-02
  Spec: §4.4
  DoD:
    - a GET never cancels; cancelling needs a POST with the token (test)

F1-010 — Weekly report of no-shows
  Estado: ⬜
  Módulo: packages/dominio/reports
  Superficie: dominio
  Dependencias: F1-001
  Bloqueado por: —
  Spec: §9.1
  DoD:
    - counts no-shows per doctor per week (test)

F1-011 — Old booking screen (dropped)
  Estado: ✂
  Módulo: apps/web/app/old
  Superficie: web
  Riesgo: bajo
  Dependencias: —
  Bloqueado por: —
  Spec: —
  DoD:
    - n/a
