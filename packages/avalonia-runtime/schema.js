/** Declarative compatibility surface shared by validation, runtime and IDE completion. */
export const commonProperties = (`TemplatedParent Name Classes DataContext Width Height MinWidth MinHeight MaxWidth MaxHeight Margin Padding Background Foreground BorderBrush BorderThickness CornerRadius FontSize FontFamily FontWeight FontStyle HorizontalAlignment VerticalAlignment HorizontalContentAlignment VerticalContentAlignment IsVisible IsEnabled Opacity Cursor ToolTip.Tip Grid.Row Grid.Column Grid.RowSpan Grid.ColumnSpan Canvas.Left Canvas.Top Canvas.Right Canvas.Bottom DockPanel.Dock ZIndex Tag Theme Focusable ClipToBounds UseLayoutRounding RequestedThemeVariant`).split(' ');
export const controlDefinitions = {
  TemplatedControl: 'Template', ContentPresenter: 'Content ContentTemplate', Control: '', Application: '', Window: 'Title Content SizeToContent', UserControl: 'Content', ContentControl: 'Content ContentTemplate Template', ContentPage:'Content Header',
  Panel:'Children', StackPanel:'Children Orientation Spacing', WrapPanel:'Children Orientation ItemWidth ItemHeight', Grid:'Children RowDefinitions ColumnDefinitions RowSpacing ColumnSpacing ShowGridLines',
  DockPanel:'Children LastChildFill', Canvas:'Children', RelativePanel:'Children', Border:'Child', Viewbox:'Child Stretch StretchDirection', ScrollViewer:'Content HorizontalScrollBarVisibility VerticalScrollBarVisibility',
  TextBlock:'Text TextWrapping TextTrimming TextAlignment LineHeight MaxLines Inlines', Label:'Content Target', Run:'Text', LineBreak:'',
  Button:'Template ContentTemplate Content Command CommandParameter IsDefault IsCancel ClickMode', RepeatButton:'Template ContentTemplate Content Command CommandParameter Delay Interval', ToggleButton:'Template ContentTemplate Content IsChecked IsThreeState Command CommandParameter',
  CheckBox:'Content IsChecked IsThreeState', RadioButton:'Content IsChecked IsThreeState GroupName', ToggleSwitch:'Content IsChecked OnContent OffContent',
  TextBox:'Text Watermark AcceptsReturn AcceptsTab IsReadOnly PasswordChar MaxLength TextWrapping TextAlignment CaretIndex SelectionStart SelectionEnd',
  AutoCompleteBox:'Text Watermark ItemsSource MinimumPrefixLength', NumericUpDown:'Value Minimum Maximum Increment FormatString Watermark IsReadOnly',
  Slider:'Value Minimum Maximum TickFrequency IsSnapToTickEnabled Orientation', ProgressBar:'Value Minimum Maximum IsIndeterminate ShowProgressText ProgressTextFormat Orientation',
  ScrollBar:'Value Minimum Maximum ViewportSize Orientation SmallChange LargeChange', Separator:'',
  ItemsControl:'Items ItemsSource ItemTemplate ItemsPanel', ListBox:'Items ItemsSource ItemTemplate SelectedItem SelectedIndex SelectionMode', ListBoxItem:'Content IsSelected',
  ComboBox:'Items ItemsSource ItemTemplate SelectedItem SelectedIndex PlaceholderText', ComboBoxItem:'Content IsSelected',
  TabControl:'Items ItemsSource SelectedIndex SelectedItem', TabItem:'Header Content IsSelected',
  Expander:'Header Content IsExpanded ExpandDirection', GroupBox:'Header Content',
  TreeView:'Items ItemsSource ItemTemplate SelectedItem', TreeViewItem:'Header Items IsExpanded IsSelected',
  Menu:'Items', MenuItem:'Header Items Command CommandParameter IsChecked ToggleType', ContextMenu:'Items',
  DatePicker:'SelectedDate DayVisible MonthVisible YearVisible', CalendarDatePicker:'SelectedDate Watermark', TimePicker:'SelectedTime MinuteIncrement ClockIdentifier', Calendar:'SelectedDate DisplayDate',
  SplitView:'Content Pane IsPaneOpen OpenPaneLength CompactPaneLength DisplayMode PanePlacement',
  Image:'Source Stretch', Rectangle:'Fill Stroke StrokeThickness RadiusX RadiusY', Ellipse:'Fill Stroke StrokeThickness', Line:'StartPoint EndPoint Stroke StrokeThickness', Path:'Data Fill Stroke StrokeThickness Stretch', Polygon:'Points Fill Stroke StrokeThickness',
  GpuSurface:'Scene ItemCount',
};
export const eventNames = (`Click DoubleTapped Tapped PointerPressed PointerReleased PointerMoved PointerEntered PointerExited KeyDown KeyUp GotFocus LostFocus TextChanged SelectionChanged ValueChanged Checked Unchecked IsCheckedChanged Loaded Unloaded`).split(' ');
export const structuralTypes = (`Style Styles Setter ResourceDictionary DataTemplate TreeDataTemplate ControlTemplate ControlTheme SolidColorBrush Thickness CornerRadius Color FontFamily RowDefinition ColumnDefinition RowDefinitions ColumnDefinitions String Boolean Int32 Double FluentTheme SimpleTheme StyleInclude ResourceInclude Design.PreviewWith`).split(' ');
export const defaultTwoWay = new Set(['TextBox.Text','CheckBox.IsChecked','RadioButton.IsChecked','ToggleButton.IsChecked','ToggleSwitch.IsChecked','Slider.Value','NumericUpDown.Value','ComboBox.SelectedItem','ComboBox.SelectedIndex','ListBox.SelectedItem','ListBox.SelectedIndex','DatePicker.SelectedDate']);
export function hasProperty(type, property) {
  return commonProperties.includes(property) || eventNames.includes(property) || (controlDefinitions[type] ?? '').split(' ').includes(property) || ['Resources','Styles','DataTemplates'].includes(property);
}
