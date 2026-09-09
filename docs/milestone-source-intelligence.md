# Worker-backed source assistance in Studio

The existing C#/XAML compiler parsers and runtime control schema now power a reusable
`packages/language-service` index. It never executes application code or reads runtime
objects. The IDE composes it with its real source editor and existing compiler worker.

## Editor commands

**Ctrl+Space** completes source types, parameters/locals, known members, XAML-named
controls, tags, attributes and selected enum values. A temporary parse hole supports
an incomplete member access without changing the actual source. Completion lists
show the symbol kind and signature. Comments/strings and unsupported contexts do
not acquire invented symbols. C# member-dot completion also opens automatically.

**F12** goes to a resolved definition, including a named control declared in XAML.
**Shift+F12** lists source references; event-handler references include the XAML event
attribute. **Alt+F12** opens an inline-source Peek dialog with exact ranges. Source
navigation has Back/Forward controls and **Alt+Left/Right** history.

**F2** renames a resolved local or parameter after a preview. It edits only bound
identifier ranges, validates the new name and checks that the other references still
resolve to the same declarations. Collisions, interpolated containing methods and
unsupported/global targets are refused. Comments, literal strings and shadowed
symbols are not search-and-replaced. This is not project-wide semantic refactoring.

Source undo/redo now uses the existing bounded `SourceHistory` library through an
editor adapter: keyboard/IME edits, indentation, completion, replacement and rename
share per-document stacks. Programmatic text changes are therefore undoable too.
A stale preimage after an external designer edit is rejected rather than overwritten.

## Scope, performance and privacy

The index caches unchanged parser results, rebuilds bindings against the current
workspace, and enforces file/character/document budgets. The source worker has a
cancellable five-second request deadline; outdated results are discarded. It is
bundled in the offline IDE, with no language server download, source upload or CDN.
Verified symbol documents and generated JavaScript remain read-only. Ordinary
release application exports do not contain the source-index worker.

Resolution covers the currently parsed source profile: block scopes, parameters,
locals, loops, catches, lambda captures, partial types, unambiguous source base members
and XAML names/events. It is not Roslyn: type-based overload resolution, complete
generic inference, dynamic dispatch, arbitrary extension/import rules, access control,
interpolated-string reference indexing and all framework members are not implemented.
Unsupported locations return no binding; completion does not establish compilation
compatibility. Full desktop-IDE capabilities remain mandatory, separately gated work.

## Tests

`tests/language-service.test.js` tests scope binding, exact UTF-16 source spans,
completion, collision rejection, original formatting, caching and budgets.
`tests/browser/test_source_tools.py` exercises real completion, C#/XAML navigation,
Peek/references, rename preview/undo/redo and the edited compiled application's output.
A delegated C# constructor is also paused and stepped into XAML in the live IDE.
The canonical CI uses HTTP; local offline tests do not count blocked HTTP navigation
as a successful hosted run.

Semantic references:
- https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/basic-concepts
- https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/variables
