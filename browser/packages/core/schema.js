/** Explicitly supported DOM compatibility surface; unknown members are compiler errors. */
export const commonProperties = new Set(`Name Classes Width Height MinWidth MinHeight MaxWidth MaxHeight Margin Padding HorizontalAlignment VerticalAlignment HorizontalContentAlignment VerticalContentAlignment Background Foreground Opacity IsVisible IsEnabled FontSize FontFamily FontWeight FontStyle ToolTip.Tip Grid.Row Grid.Column Grid.RowSpan Grid.ColumnSpan Canvas.Left Canvas.Top Canvas.Right Canvas.Bottom DockPanel.Dock DataContext Tag Focusable TabIndex ClipToBounds Cursor`.split(' '));
export const events = new Set(`Click Checked Unchecked IsCheckedChanged TextChanged ValueChanged SelectionChanged PointerPressed PointerReleased PointerMoved KeyDown KeyUp GotFocus LostFocus Loaded`.split(' '));
export const schema = Object.fromEntries(Object.entries({
  Application:'RequestedThemeVariant', Window:'Title Content SizeToContent', UserControl:'Content', ContentPage:'Header Content Theme',
  StackPanel:'Orientation Spacing', WrapPanel:'Orientation ItemWidth ItemHeight', Grid:'RowDefinitions ColumnDefinitions RowSpacing ColumnSpacing',
  DockPanel:'LastChildFill', Canvas:'', Panel:'', Border:'BorderBrush BorderThickness CornerRadius Child',
  ScrollViewer:'Content HorizontalScrollBarVisibility VerticalScrollBarVisibility',
  TextBlock:'Text TextWrapping TextAlignment MaxLines LineHeight', Label:'Content Target',
  Button:'Content Command CommandParameter IsDefault IsCancel', RepeatButton:'Content Command CommandParameter',
  ToggleButton:'Content IsChecked IsThreeState Command CommandParameter', CheckBox:'Content IsChecked IsThreeState', RadioButton:'Content IsChecked IsThreeState GroupName',
  TextBox:'Text Watermark AcceptsReturn IsReadOnly MaxLength TextWrapping PasswordChar',
  Slider:'Value Minimum Maximum SmallChange LargeChange TickFrequency Orientation IsDirectionReversed IsSnapToTickEnabled',
  ProgressBar:'Value Minimum Maximum IsIndeterminate Orientation ShowProgressText',
  NumericUpDown:'Value Minimum Maximum Increment FormatString', ToggleSwitch:'IsChecked OnContent OffContent Content',
  ComboBox:'ItemsSource SelectedIndex SelectedItem PlaceholderText Items', ComboBoxItem:'Content IsSelected',
  ListBox:'ItemsSource SelectedIndex SelectedItem Items SelectionMode', ListBoxItem:'Content IsSelected',
  ItemsControl:'ItemsSource Items ItemTemplate', TabControl:'SelectedIndex Items', TabItem:'Header Content IsSelected',
  Expander:'Header Content IsExpanded ExpandDirection', Separator:'',
  DatePicker:'SelectedDate', CalendarDatePicker:'SelectedDate Watermark', TimePicker:'SelectedTime',
  Image:'Source Stretch', Viewbox:'Stretch Child', ContentControl:'Content ContentTemplate',
  Menu:'Items', MenuItem:'Header Items Command CommandParameter IsChecked',
  Rectangle:'Fill Stroke StrokeThickness RadiusX RadiusY', Ellipse:'Fill Stroke StrokeThickness',
  DrawingSurface:'Scene ClearColor',
  SolidColorBrush:'Color', Color:'', Thickness:'', String:'', Double:'', Int32:'', Boolean:'',
  ResourceDictionary:'', Styles:'', Style:'Selector', Setter:'Property Value', DataTemplate:'DataType',
}).map(([k,v])=>[k,new Set(v.split(' ').filter(Boolean))]));
export const nonvisualTypes = new Set(['SolidColorBrush','Color','Thickness','String','Double','Int32','Boolean','ResourceDictionary','Styles','Style','Setter','DataTemplate']);
export const scalarTypes = new Set(['SolidColorBrush','Color','Thickness','String','Double','Int32','Boolean']);
export const propertyElements = new Set(['Resources','Styles','Children','Content','Child','Items','ItemTemplate','ContentTemplate','DataContext']);
export const knownNamespaces = new Set(['https://github.com/avaloniaui','http://schemas.microsoft.com/winfx/2006/xaml','using:System','clr-namespace:System;assembly=mscorlib','urn:jailbreak']);
