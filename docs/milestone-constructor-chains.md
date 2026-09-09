# Constructor chains and debugger integration

C# `this(...)` delegation and multiple constructors with distinct argument-count
ranges now lower to a shared compile-time constructor graph. Forwarding arguments
are evaluated once, in source order. The terminal constructor passes its own
arguments to the base constructor; each source body runs inside-out on the same
instance, with one set of instance field/event/auto-property initializers per type.
No constructor body is replayed and no temporary UI object is constructed.

`constructor-chains.js` checks target arities, overlapping overload ranges, cycles,
static constructors and references to an unallocated instance. Unsupported or
ambiguous chains emit diagnostics and no executable output. Constructors retain
source file/statement identities across partial classes. The existing IDE scheduler
can pause in a delegated body or its `InitializeComponent`, edit parameters, resume,
or cancel and dispose partial visuals without executing the remaining bodies.
Constructor changes remain structural changes requiring restart, not hot reload.

## Supported profile and explicit gaps

Arity-disjoint overloads, optional parameters, `params`, nested source/base chains,
parameter side effects in forwarding arguments, early `return;`, and explicit base
method calls are tested in release, native-debug and cooperative modes. The source
backend's existing base-before-derived field-initializer ordering remains in use;
full CLR derived-field-before-base-body semantics and virtual calls observing those
initializers are NOT established by this milestone. This is a tracked compiler gap,
not evidence of complete language/framework compatibility. Type-based overload
resolution, generic constructors, static constructors and primary constructors
remain separate targets. Native base constructors remain synchronous step-over
regions. Default-argument expression validation retains the current compiler profile.

`tests/constructor-chains.test.js` executes the generated JavaScript in all three
modes, including actual local edits and cancellation. These tests supplement, not
replace, the original ControlCatalog, source/runtime, symbol and browser gates.

Reference: C# specification §§15.11.2–15.11.4:
https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/classes#1511-instance-constructors
