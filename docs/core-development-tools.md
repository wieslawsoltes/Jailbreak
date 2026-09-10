# Mandatory core development tools contract

> Audit input: [`92cfb4ddc1f3`](https://github.com/wieslawsoltes/Jailbreak/tree/92cfb4ddc1f35e1ae3fa9093d7ed04a041d75d4c); documentation reconciled 2026-09-10T11:42:51+00:00. This is a source/evidence snapshot, not a declaration of full product completion.

Debugging, visual design, source identity, hot reload and lifecycle cleanup are mandatory parts of every compiler/runtime/control increment. They are not optional plugins to add after compatibility work. The [full requirements](requirements.md) preserve the requested end state; the [current status](current-status.md) identifies implemented profiles and actual evidence.

## Debugger obligations

Emit original source/IL identity, distinguish executable/bound from unbound locations, preserve ordinary semantics in native and cooperative modes, and validate actual frame/local mutation. Source constructors/XAML, library calls, SDK state machines, callbacks and lazy construction must each have declared suspension coverage. Cancellation, exception cleanup, static initialization and competing tasks are core semantics. Release source disclosure/instrumentation must be separately tested.

## Designer obligations

Every control needs runtime/source identity, inspectable properties and explicit editability. Preserve unrelated source and expressions. Use one atomic, preimage-checked change history across text, designer and refactor edits. Alias/final-write support does not imply arbitrary control-flow/interprocedural analysis. Ambiguous/generated/template instances must be labeled and refused rather than rewritten incorrectly.

## Reload obligations

Document whether each new feature supports in-place update, reconstruction with state handling, or restart. Validate every affected owner/name/subscription/method/debug site before mutating live state. Reject stale results. Keep the last working application after failed builds or incompatible edits. Test rollback, repeated updates and exceptional disposal; explicitly state external side effects that are outside rollback ownership.

## IDE obligations

Expose real commands and controller-backed tool windows through the menu registry, palette and docking system. Source and binary contexts remain isolated even when they share presentation. Views can move/close/reopen without duplicating controllers or losing sessions. Keyboard, touch, focus and narrow-screen non-occlusion are acceptance requirements. No permanent informational sidebar or monolithic inspector substitutes for integrated tools.

## Definition of done for a capability

A change needs implementation in canonical reusable libraries; positive/negative and real-browser acceptance; independent managed semantics where applicable; source mapping/debug behavior; designer editability; reload/disposal coverage; exact committed/tested/deployed evidence; and requirements/status/docs updates. A missing integration is a blocking tracked gap, not a silently omitted condition. Full product completion additionally requires the whole unchanged ControlCatalog and complete declared compatibility profile.
