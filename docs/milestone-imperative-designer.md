# Flow-ordered imperative C# designer edits

<!-- jailbreak-current-documentation:begin -->
> **Historical milestone; current applicability audited 2026-09-10.** The implementation details and test totals below record this milestone, not the complete present-day product. Its old remaining/unsupported lists and UI instructions may have been superseded. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

The designer now follows straight-line local construction and alias assignments
in a source method or constructor. It displays the final property write rather
than assuming the object initializer is the effective source value. Editing a
literal replaces that write's value span, preserving comments, CRLF, unrelated
statements, earlier writes and the original construction site.

For example, `var b = new Button { Content = "first" }; var a = b;
a.Content = "last";` displays `last` and edits `a.Content`, not `first`.
Local reassignments kill an alias; they do not transfer the original control's
provenance to a new object. An existing local may become an alias by assignment.
The existing control source identity, runtime selection, source transaction
history and compile/restart/hot-reload pipeline are reused.

Expressions and compound writes are protected. Branches, loops, captured
callbacks, unknown calls and field/property escapes that reference the object
block edits. Removing an imperative write is rejected because that could expose
an earlier value. Constructor changes still require an explicit restart. Direct
initializer editing remains available for the previous inline-construction
profile. This is conservative local analysis, not interprocedural proof or
unrestricted C# round-tripping. Unsupported behavior is visibly noneditable.

`packages/development/imperative-designer.js` supplies analysis, inspection and
editing; the existing C# designer provides typed literal encoding. The
`tests/imperative-designer.test.js` suite includes 13 positive/negative tests and
executes the edited C# through the real compiler/runtime. The Designer Workspace
browser tests also edit an actual live control, verify the exact assignment in
source, restart, and inspect the updated application.

Source locations are retained at the original `new` expression. The edits are
ordinary source text and are subject to compilation diagnostics. They do not
mutate the IDE origin or run application code during source analysis.

Full control-flow, field, ownership and alias analysis remains mandatory under
[the core development-tools contract](core-development-tools.md).

Primary semantic reference: https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/variables
