# Workspace history, change review and reusable component extraction

Studio now shares one source-transaction journal across text edits, designer operations,
file creation and multi-file refactoring. The Changes tool reviews actual source differences
against local checkpoints. Component extraction validates a proposed three-file project
through the real compiler before offering Apply. These are connected IDE workflows, not
standalone mock panels or a Git integration.

## Shared source history

The editor's Undo/Redo commands and Ctrl+Z/Ctrl+Y consume the same chronological history
as the designer's Undo design/Redo design. A source edit followed by a designer edit is
undone in reverse order, even across documents. A refactor that creates two files and
changes a third is one entry: undo removes the new files and restores the original owner.
Consecutive ordinary same-file typing can coalesce; other operations form separate entries.

Before applying a transaction, all expected original texts, paths, case-insensitive path
collisions, writable descriptors and size budgets are checked. An absent file is represented
by null, distinct from an empty string. No source file is written if another preimage is
stale. Paused invocations and pending runtime reloads block transaction application.

History retains at most 100 entries and 16 MiB of accounted before/after UTF-16 text by
default. Checkpoints retain at most eight snapshots and 16 million source characters in
total. These are bounded in-memory **session** histories, not durable filesystem versions:
opening/reloading a workspace resets the journal. Existing workspace JSON/local storage
continues to preserve current source. Download source/checkpoint changes to keep a copy.

## Changes tool

Use **Changes** in the Studio toolbar or the command palette's **View: Workspace changes
and source checkpoints**. Choose a checkpoint, inspect added/modified/deleted files, and
review old/new line numbers and exact text. Create named checkpoints before a refactor.
Restoring one file or all files has a separate review step and is itself undoable.

The line diff has a bounded LCS matrix and display-row budget. A large changed block falls
back to an explicit replacement, never guessed matching. Display truncation is identified;
the transaction still retains exact complete text, including CRLF and final-newline changes.
Binary payloads/assets are identified but not expanded into the textual diff.

Export changes produces `jailbreak-source-changes-v1` JSON with exact original/result text.
Import opens a review; it does not apply or execute code. Apply requires every original to
match and the workspace revision to remain unchanged since review. Exported data contains
source and potentially binary records; nothing is uploaded by the review tool. This format
is not a Git patch and has no automatic conflict merge.

## Extract reusable UserControl

In **Grid Designer**, select `Sidebar` in the running visual hierarchy. Choose **Extract
component…**, enter `SidebarView`, then **Validate & review**. The compiler worker checks the
candidate and verifies that project evaluation includes both new files. The review shows:

1. The original owner XAML, replacing the selected subtree with a component instance.
2. `Components/SidebarView.axaml`, containing the retained literal subtree.
3. `Components/SidebarView.axaml.cs`, a partial UserControl with InitializeComponent.

Layout attributes stay on the component host. Relevant inherited namespace declarations,
comments, unrelated attributes, line endings and fragment text are preserved. Name/type/path
collisions fail. Referenced named descendants, owner handlers, bindings/resources, styles,
templates, custom controls and other ownership-sensitive constructs are rejected rather
than disconnected silently. For example, extracting `ContentCard` in the same sample is
blocked because C# refers to its `CounterLabel` descendant.

Only self-contained literal built-in subtrees are accepted. The new UserControl introduces
a real layout/inheritance/namescope boundary; the feature does not claim arbitrary
behavioral equivalence or automatic migration of code-behind. Explicit project item lists
that omit the generated files require a project edit before extraction. The original
application entry is retained instead of accidentally selecting the newly created view.

Validation does not execute application code. Cancelling validation prevents a late worker
result from reopening the review. Applying extraction changes source atomically, then
compiles it through the existing workbench. A changed type/document set requires an
explicit preview restart in development hot-reload mode; the currently running app stays
intact. Undo removes the created files as well as restoring the owner source.

## Reusable modules

| Module | Role |
| --- | --- |
| `packages/workspace/journal.js` | Source preimages, atomic transactions, shared history and local checkpoints |
| `packages/workspace/diff.js` | Bounded exact line-diff model, independent of the DOM |
| `packages/development/component-refactor.js` | Source-based extraction/dependency checks and multi-file plan |
| `packages/workbench/change-review.js` | Review/checkpoint/refactor UI over the journal and compiler worker |

The existing designer, editor, project evaluator, debugger, XAML loader and reload engine
are reused. Runtime instances never become source authority. Source attachments from
converted libraries remain read-only and are excluded from editable-source transactions.

## Regression fixes found during integration

The offline workbench now bundles the language-service worker alongside the compiler
worker. Completion, definition/reference navigation and local rename work without loading
a script from the network. Removing a selected visual clears its stale inspector selection
before reload acknowledgment; it no longer turns a successful deletion into a spurious
"Visual selection is no longer available" error. Narrow toolbars scroll their own commands
instead of enlarging the document; Changes remains keyboard accessible.

## Verification and remaining targets

The journal and extraction unit tests execute positive and negative multi-file changes,
preimage failures, budgets, alias/name dependencies, undo/redo, ordinary XAML loading and
cooperative construction. Browser tests compile the extracted component, inspect its actual
runtime type, check the retained application entry, undo all three files, exercise change-set
round trips and stale reviews, cancel in-flight validation and check mobile dialogs.
Existing source assistance, templates, Grid, designer, debugging and binary gates remain
required. CI uses the HTTP-served site; local offline checks are reported separately when
this environment blocks HTTP navigation.

Full project-wide extraction, arbitrary imperative C# round-tripping, semantic completion/
refactoring parity, durable project history and filesystem synchronization remain unfinished.
Full unchanged ControlCatalog, broader language/framework and SDK-generated async-state-
machine IL compatibility, and remaining symbol restoration targets are not reclassified as
complete by this milestone.
