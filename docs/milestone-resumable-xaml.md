# Resumable XAML and source constructors

The primary IDE's **Develop → In-IDE stepping** mode now constructs applications through cooperative continuations. A breakpoint in a C# constructor can step into `InitializeComponent`, pause before a XAML visual is allocated, inspect its parent/owner, step to a sibling or out to the constructor, then resume the actual application. Browser DevTools is not needed for these pauses.

## Shared execution path

`buildSteps` and `propertySteps` in the existing XAML runtime are the single traversal. Normal `loadXaml` drains that traversal synchronously; `loadXamlSteps` yields source checkpoints to the existing cooperative scheduler. No substitute tree, copied XAML interpreter, promise-returning constructor or replay of the constructor is used.

The C# backend emits development-only constructor factories. A factory allocates through the registered base factory or `Reflect.construct` of a native base with the final prototype, applies instance initializers, executes the constructor body and returns that same object. Existing native constructors remain the release path. The factories support the backend's existing arity-based constructor subset, explicit base arguments, fields/events/auto-property initializers, nested construction and method calls. They preserve the release backend's initializer order; this is not a claim that all C# constructor/virtual-dispatch semantics are already compatible with the CLR.

`bootCooperative` returns a handle immediately, with `root`, `taskId` and `ready`. The root is mounted and reported ready only after successful construction. The normal `boot` ABI is unchanged. Application event handlers retain the existing cooperative method dispatch.

## Cancellation and failure

A paused construction belongs to the task, not to the previously running app. Cancelling the task unwinds generators, disposes partial children and the staged root, restores exported name descriptors, clears pending bindings and removes the temporary style. Constructor statements after the paused point do not execute. Construction failure follows the same cleanup path. Disposal errors do not prevent remaining children from being cleaned up.

A previously hydrated root cannot be resumed as a new construction. Hot reload still requires all paused invocations to finish or cancel first. Partial construction is visible through debugger frame snapshots; it is not installed as the running visual hierarchy.

Source-type `InitializeComponent` now resolves its own runtime's loader. Constructing two independent runtime contexts no longer lets the most recently created runtime redirect the earlier context's constructor to a different XAML document.

## APIs

- `co.run(iterator, {breakOnEntry})` starts an authored/compiled generator in the same scheduler used by C# methods.
- `co.registerConstructor(Type, factory)` and `co.construct(Type, args, newTarget)` provide constructor continuation dispatch.
- `JB.loadXamlSteps(instance, id)` hydrates a fresh object; `JB.createFromXamlSteps(id)` includes allocation.
- `JB.bootCooperative(manifest, host)` stages browser startup and publishes the completed root.

All source locations and continuation factories are development-only compiler output. Release compilation does not contain `registerConstructor`, `loadXamlSteps` or debugger checkpoints.

## Verification

`tests/xaml-continuations.test.js` tests real constructor and XAML execution, shared-runtime isolation, nested constructors, base arguments, fresh-root cancellation, property-element children, failure cleanup and release stripping. `tests/browser/test_xaml_construction.py` checks in-IDE pause/step/out/continue and cancellation with an actual compiled application. The existing developer-tool browser suite remains required.

## Remaining boundaries

Templates, lazy resource evaluation, native constructors, property setters/accessors and native runtime callbacks remain synchronous step-over regions. The full source compiler still rejects delegating `this(...)` constructors and other unsupported language features. Arbitrary native/managed callbacks are not transformed by this feature. This is genuine resumable visual construction and source-constructor execution for the current compiler subset, not full Avalonia or full C# compatibility. Complete unmodified ControlCatalog, general imperative designer analysis and MSIL/async state-machine coverage remain separately gated mandatory targets.
