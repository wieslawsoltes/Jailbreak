# In-IDE debugging through compiled continuations

<!-- jailbreak-current-documentation:begin -->
> **Specialized guide / example; current applicability audited 2026-09-10.** This document is a specialized profile/example, not a full-solution completion claim. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

Enable **Develop → Enable debugger / designer → In-IDE stepping**, then build. This is a separate execution option from native DevTools breaks. Release builds retain their normal execution path and contain no continuation registrations or debug source maps.

## Running the laboratory

Choose **Stepping Lab**. Add a breakpoint in `MainView.axaml.cs`, or press **Break next statement**, then click **Run nested call**. The handler suspends before the selected statement. **Step into** enters `Double`, **Step over** executes a nested call and stops in its caller, and **Step out** runs until that frame returns. **Continue** finishes the invocation. The IDE remains responsive while the compiled invocation is suspended.

The call-frame selector shows real suspended C# method frames and their locals. Select a frame to inspect safe property-path watches. **Set local** accepts a JSON scalar of the existing type, validates supported integer ranges and character width, and changes the actual lexical variable consumed when execution resumes. It cannot overwrite `this`, object graphs, read-only iteration/catch variables, out-of-scope locals, or a stale frame.

**Run async call** demonstrates compiled `Task`/`await` flow. An async method is a separate task with its own suspended frames; its awaiting caller retains its frame. Stepping out of the async child resumes the caller and stops after the await. Explicit throw sites can suspend before throwing, retaining the same exception object for matching catch/finally behavior. **Cancel invocation** initiates generator unwinding; supported finally blocks execute, including awaits. Stale completion from an await that was cancelled cannot resume the old body. Cancel is idempotent while cleanup is running.

## Compiler and runtime contracts

`packages/development/cooperative-debugger.js` runs generator continuations emitted by the existing C# compiler, not interpreted C# syntax or an IL interpreter. The same expression and statement emitter is used for normal methods and their debug counterparts. A counterpart receives the session as a private first argument and has its own explicit enter/leave lifecycle. This keeps cleanup independent of whether the session is still published at `JB.dev`.

Compiled calls yield through counterpart dispatch when one exists; ordinary external calls remain ordinary JavaScript calls. Receiver evaluation, method lookup, optional-call argument suppression and argument evaluation order are retained. Event method groups installed through the runtime and XAML use a stable wrapper, so existing subscriptions can invoke the updated counterpart after a compatible hot reload. Direct calls through the normal public JavaScript API remain synchronous unless the original C# method is async.

Sequence points carry original C# file, line, UTF-16 column, captured locals, supported setters and type metadata. Inline source maps cover yielded points and following executable statements. Native source points and cooperative points are distinguished in the build metadata; the IDE does not mark a native-only constructor point as a cooperative breakpoint.

The session bounds concurrent tasks, call depth, executed steps and cancellation cleanup. Loops have explicit backedge checkpoints, including empty loops. Budget exhaustion initiates cleanup before reporting failure. Completed tasks release captured frames and iterators; delayed async callbacks check task membership and epochs. Multiple paused tasks have independent frame identities.

The opaque-origin preview remains `sandbox="allow-scripts"`. Debugger commands require the parent window and session channel. Paused application input is inert while IDE controls remain usable. Local edits do not evaluate code. Hot reload rejects active invocations, including suspended and awaiting tasks, rather than silently changing their active bodies.

## Exact current boundary

This is **invocation-level cooperative suspension**, not a VM-wide JavaScript pause. Native timers, unrelated tasks, browser callbacks and foreign JavaScript are not frozen. Constructors, property accessors, explicit base-dispatch methods, native/runtime APIs and ordinary synchronous callbacks/lambdas are step-over regions. A diagnostic identifies base-dispatch methods that lack a counterpart. The underlying C# subset still determines which programs compile.

A suspended event handler returns a Promise to its native event entrypoint. The remaining native routed-event dispatch does not itself suspend. Therefore synchronous routed-event ordering and propagation/cancellation after a pause are not equivalent to a native VM pause. Use **Native DevTools breaks** when inspecting those timing-sensitive paths. App input blocking reduces accidental interaction but is not a thread/VM suspension guarantee.

XAML construction still uses the original native breakpoint path. Compiled MSIL/DLL methods and Portable PDB source scopes are not integrated into the cooperative engine in this milestone. Native JavaScript DevTools remains available for those paths. This feature is not a claim that every debugger or original ControlCatalog acceptance gate is complete.

## Evidence

`tests/cooperative-debugger.test.js` covers emitted nested calls, recursion, loops, catches/finally, real step behavior, frame-local mutation, source breakpoints, async tasks, epoch-safe cancellation, session-disposal cleanup, budgets, receiver/argument order, event subscription identity, live-update exclusion and release stripping. The existing developer browser suite adds three tests that operate the IDE stepping controls without CDP: local edits affect final UI output, async step-out resumes the caller, and exception/cancellation paths restore input.

Local checkpoint: **262 Node tests**, **23 developer browser tests**, **14 source examples**. Hosted verification also retains the full binary, CLR oracle, template, profile and selected upstream-control gates.

References: [C# async return types](https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/async-return-types), [await operator](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/await), [ECMA-426 source maps](https://tc39.es/ecma426/).
