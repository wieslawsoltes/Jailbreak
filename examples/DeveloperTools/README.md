# Developer tools laboratory

Open **Develop** and enable the debugger/designer option. Select controls using the visual hierarchy or **Select on canvas**. Edit literal properties without replacing comments or binding expressions. The C#-constructed button maps back to its literal object initializer.

Enable **Hot reload on build**, type a value into the input, click Increment, then change `count += 1` to `count += 10` in C# and build. The root, input, counter and existing handler subscriptions remain alive. Attribute-only XAML edits to supported properties also reload in place. Structural or constructor changes explicitly require **Restart app**.

Set a breakpoint on the counter increment or label assignment. Native pauses/stepping and live call frames use browser DevTools; the IDE displays snapshots and safe property-path watches. Disable native breaks to test conditional/logpoint reporting without DevTools. Development exports contain source maps and original source; disable tools and rebuild for release exports.

See `docs/core-development-tools.md` for mandatory full-scope requirements and `docs/milestone-development-tools.md` for delivered coverage and current limitations.
