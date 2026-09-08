# Templates, shared XAML and ProgressBar milestone

## Scope

This milestone extends the **primary** XAML/compiler/runtime under `packages/` and the primary IDE. The secondary workbench keeps its existing runtime and deliberately still reports unsupported templates and ProgressTextFormat. This is not another parallel compiler implementation.

New reusable modules: `avalonia-runtime/resources.js`, `templates.js`, `selectors.js`, `progress.js`, and `xaml-compiler/includes.js`. The existing control, binding, project, XAML and bundling modules integrate those features. The compiler continues to emit object IR and JavaScript; there is no source parser or network include loader in the application runtime.

## Deferred templates

`ControlTemplate` constructs an instance-specific visual tree and namescope. The supported hosts are Button, ToggleButton, ContentControl and TemplatedControl (including compiled subclasses). Input/list control templates remain unsupported until their native behavior has an appropriate template-host contract. Use ContentPresenter to project the templated control's Content. ContentTemplate uses the existing DataTemplate builder with separate visual instances.

`TemplateBinding` accepts a single property and is one-way. It reads the templated control, not its DataContext. Full `{Binding ..., RelativeSource={RelativeSource TemplatedParent}, Mode=TwoWay}` supports editable bindings; RelativeSource Self is also supported. Ancestor-relative modes are not implemented. TemplateBinding values are lower priority than styles so a `/template/` selector can override a template-bound visual property.

Compiled custom controls can derive from TemplatedControl, override OnApplyTemplate and call `e.NameScope.Find<Button>("PART_Button")`. ApplyTemplate and FindTemplateChild are available. Page FindControl does not search into template part namescopes. Template/DataTemplate names are excluded from the page's generated names. A new template is constructed before replacement; construction failure leaves the active tree intact. Successful replacement disposes old parts, clears their names and unsubscribes bindings. Projected application controls are borrowed, not destroyed along with the template.

ControlTheme supports TargetType, BasedOn, static setters, template setters and exact type-keyed implicit lookup. Local properties override theme setters. Full nested control-theme selectors, dynamic-resource/binding setters, trigger systems, template selection inheritance and arbitrary control theme fidelity remain incomplete and must not be inferred from this support. Some unsupported constructs are compile diagnostics; type mismatches and invalid resources can still surface at runtime.

## Shared resources and styles

ResourceDictionary supports lazy construction, forward static references, type keys, local-over-merged precedence, last-merged dictionary precedence, and dynamic invalidation on changes/removal. Merged dictionary cycles and cyclic lazy resource evaluation fail explicitly. Clear/delete operations notify observers without eagerly constructing deferred resources. Disposing a dictionary detaches subscriptions to merged dictionaries; it does not take ownership of an externally shared merged instance.

StyleInclude and ResourceInclude resolve during project compilation against **selected** workspace XAML documents. Relative paths, project-root paths and `avares://KnownAssembly/path` are supported. Assembly names come from evaluated projects. Unknown assemblies, nonselected/missing files, unsupported external schemes, incompatible root kinds and include graph cycles prevent executable output. No network access or ambiguous suffix search is used. Standalone `compileXaml` emits include descriptors; project compilation performs linking. All included definitions travel inside exported application code.

The selector parser validates the supported grammar rather than ignoring unrecognized punctuation. Supported axes are descendant, child `>`, and `/template/`, with type, class, name, pseudo-class and comma-separated selectors. Normal descendant/child matching does not accidentally cross a template-owner boundary. Property selectors, :is/:not, nesting via ^ and the complete Avalonia selector language remain unsupported.

## Original ProgressBarPage

`examples/UpstreamProgressBar` contains byte-exact XAML and code-behind from `wieslawsoltes/Avalonia` at `b709c58c6b1b8aa3b90866c7c001b7bf82b6353b`. PROVENANCE.md records source hashes and the upstream license is retained. This expands the requested-fork interactive gate beyond CheckBox and RadioButton.

ProgressBar normalizes `(Value-Minimum)/(Maximum-Minimum)`, exposes Percentage notifications, shows percentage text, projects orientation, and removes determinate value accessibility state when IsIndeterminate is enabled. The authored browser host uses a native progress element plus an accessible wrapper/text layer. It is not a port of Avalonia's animated theme geometry. Formatting supports `{0}`, `{0:0}`, decimal zero formats up to eight places, F0–F9, and escaped braces. General .NET formatting, culture and exact rounding parity are not claimed.

## Try it

Build the site, select **Templates**, then click a card. Both cards share the same ControlTemplate but update independently. Replace the first card's template, restore the styled template, edit the templated-parent text box, or change the merged resource. **Upstream Progress Bar** loads the original source fixture; adjust the sliders, range, percentage format and indeterminate toggle.

The primary workbench's offline build and exported HTML include the new runtime and linked documents. The bundler now recognizes authored import/re-export forms narrowly instead of accidentally consuming an intervening `export class` when a later re-export appears.

## Verification

New tests: `tests/templates-resources.test.js`, `tests/progressbar.test.js`, and `tests/browser/test_templates.py`. They cover positive and negative compilation cases, lifecycle/subscription counts, borrowed visual ownership, native keyboard/click behavior, hover selectors, standalone export, two-way template bindings and the unchanged ProgressBar fixture. Local browser execution uses the self-contained offline IDE because HTTP navigation is restricted in the development container; CI uses the actual served site.

The existing Node, sample/hydration, original fixture and 16-browser-check gates remain in place. The source-delivery workflow materializes batched source into normal commits, then runs the full Node suite, sample gate, build and syntax checks before pushing those commits. It dispatches the canonical toolchain workflow, which runs the combined browser suite before deploying the verified static site. Current CI results, not this document, establish publication status.

**The complete, unmodified ControlCatalog is still not passing.** GPU execution/performance and pixel-perfect Avalonia parity are not established by these DOM tests.

## References

- https://docs.avaloniaui.net/docs/custom-controls/templated-controls
- https://docs.avaloniaui.net/docs/styling/resources
- Source fixture: https://github.com/wieslawsoltes/Avalonia/tree/b709c58c6b1b8aa3b90866c7c001b7bf82b6353b/samples/ControlCatalog/Pages
