# Docked IDE and functional editor navigation

<!-- jailbreak-current-documentation:begin -->
> **Historical milestone; current applicability audited 2026-09-10.** The implementation details and test totals below record this milestone, not the complete present-day product. Its old remaining/unsupported lists and UI instructions may have been superseded. Use [current source and CI status](current-status.md), [full requirements](requirements.md), and [remaining acceptance work](remaining-work.md) for the current global contract.
> The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See [the integrated IDE guide](ide-guide.md). Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.
<!-- jailbreak-current-documentation:end -->

The primary browser IDE now uses a compact desktop workbench with an explorer, source/preview split, diagnostics and a right-hand developer-tool dock. This is a functional redesign of the existing compiler/designer/debugger client, not a standalone mockup or a claim of Rider/Visual Studio parity.

## Commands and editing

**Ctrl+Shift+P** opens the keyboard-accessible command palette. File/Edit/View/Build/Run menus filter the same command registry. Commands invoke the existing import/export, compiler, build-profile, preview, theme and debugger actions. Unavailable commands report their state instead of simulating execution.

**Ctrl+P** opens source or verified read-only symbol documents; **Ctrl+Shift+O** navigates parsed C# declarations and named XAML elements; **Ctrl+Shift+F** searches workspace text and selects exact original UTF-16 ranges. Binary payload records are excluded from text search. **Ctrl+G** accepts line or line:column, including CRLF input. Per-document caret, selection and scroll positions are retained in a bounded session cache.

**Ctrl+F/H** opens literal find/replace with case and Unicode whole-word options. Replacement is literal, not regex interpolation. Search/result budgets prevent incomplete replace-all edits. Changes update the actual editor source and compiler inputs. **Ctrl+/** toggles C# line comments; XML wrapping refuses existing comment delimiters. Generated JS and verified binary-source tabs remain read-only, including keyboard indentation and replacement controls.

## Layout

Explorer, editor/preview split, diagnostics height and developer dock have pointer and keyboard resize handles. Shift-arrow changes ten pixels; Home/End use allowed limits; double-click or the Reset layout command restores defaults. Bounded preferences persist when browser storage is available. Code-only, preview-only and combined views share the same editor and application frame.

Dark/light themes, compact tabs, breadcrumbs, focus styling and command hints are consistent across the shell. Narrow displays use bounded overlay tools and a full-width preview without document-level horizontal overflow. The developer panel is moved, not cloned, so existing designer, construction stepping, watches and reload controls retain their session state and event handlers.

## Libraries and gates

`packages/workbench/navigation.js` implements literal search, source positions, parsed symbol navigation, fuzzy ranking and document-position storage. `layout.js` manages accessible splitters. `shell.js` binds these to the existing IDE using callbacks; it never evaluates application source in the IDE origin. Source execution stays in the script-only sandboxed preview.

`tests/workbench.test.js` checks Unicode ranges, replacement limits, source parsing and bounded state. `tests/browser/test_workbench.py` exercises actual file/symbol/search navigation, compiled results after replacement, read-only protection, caret restoration, command execution, splitters and mobile layout. Existing developer-tool and XAML-construction browser gates remain required after docking.

## Remaining mandatory scope (at this milestone)

Semantic completion, refactoring, rich multi-caret editing, project-wide incremental analysis and the full professional-IDE end state are not implemented by these navigation tools. Full language/framework and unmodified ControlCatalog compatibility remain separate targets. The complete debugger, source round-tripping and symbol-format requirements in `core-development-tools.md` are unchanged.
