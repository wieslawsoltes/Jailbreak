# Original ProgressBarPage

Repository: https://github.com/wieslawsoltes/Avalonia
Commit: b709c58c6b1b8aa3b90866c7c001b7bf82b6353b
Directory: samples/ControlCatalog/Pages

Original, unchanged XAML and C# code-behind. Git blob IDs:
- ProgressBarPage.xaml: 3b80b5a6bb97d019c8e6669ce244273ab0cecd55
- ProgressBarPage.xaml.cs: 244161a61e34c1ffe407410c27283df466cda1bb

The primary runtime uses explicit ContentPage/ScrollPage adapters. Gates cover dynamic range/value bindings, percentage text and its supported format subset, indeterminate state and orientation. This is not an assertion of full Avalonia theme/pixel parity. The secondary pipeline does not yet support ProgressTextFormat.
