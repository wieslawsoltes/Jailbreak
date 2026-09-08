export class TemplateAppliedEventArgs {constructor(nameScope,source=null){this.NameScope=nameScope;this.Source=source;}}
/** Deferred template lifecycle. Templates own visual parts, never projected application content. */
export function applyControlTheme(control){
  const theme=control.Theme;
  if(theme?.kind!=='controlTheme'){for(const key of control._themeKeys??[])control.ClearValue(key,90);control._themeKeys=[];return;}
  if(theme.targetType&&!(control instanceof theme.targetType))throw new Error('JB3012: ControlTheme TargetType mismatch');
  const values={},seen=new Set();
  function collect(value){if(!value)return;if(value.kind!=='controlTheme'||seen.has(value))throw new Error('JB3012: Invalid or cyclic BasedOn theme');if(value.targetType&&!(control instanceof value.targetType))throw new Error('JB3012: BasedOn TargetType mismatch');seen.add(value);collect(value.basedOn);Object.assign(values,value.resolveSetters?.(control)??value.setters);}
  collect(theme);for(const key of control._themeKeys??[])if(!Object.hasOwn(values,key))control.ClearValue(key,90);
  for(const [key,value]of Object.entries(values))control.SetValue(key,value,90);control._themeKeys=Object.keys(values);
}
export function releaseControlTemplate(control){
  const instance=control._templateInstance;control._templateInstance=null;control._appliedTemplate=null;
  if(instance){if(control._templateTransaction)control._templateTransaction.retire(instance);else{instance.root.Dispose();instance.names.clear();}}
}
export function applyControlTemplate(control){
  const template=control.Template;if(template===control._appliedTemplate&&control._templateInstance)return false;
  if(template!=null&&(template.kind!=='controlTemplate'||typeof template.build!=='function'))throw new TypeError('JB3013: Template must be a ControlTemplate');
  if(!template){releaseControlTemplate(control);return false;}
  if(control._applyingTemplate)throw new Error('JB3013: Recursive template application');
  control._applyingTemplate=true;
  try{
    // Build first: a failed replacement leaves the currently active template intact.
    const next=template.build(control);releaseControlTemplate(control);control._templateInstance=next;control._appliedTemplate=template;
    const args=new TemplateAppliedEventArgs({Find:name=>next.names.get(name)??null,FindControl:name=>next.names.get(name)??null},control);
    control.OnApplyTemplate(args);return true;
  }finally{control._applyingTemplate=false;}
}
export function renderControlTemplate(control){
  if(!control.Template&&!control._templateInstance)return false;
  control.ApplyTemplate();const instance=control._templateInstance;if(!instance)return false;
  Object.assign(control.element.style,{padding:'0',borderWidth:'0',background:'transparent',display:control.IsVisible===false?'none':'block'});
  instance.root.mount(control.container);
  for(const node of [...control.container.childNodes])if(node!==instance.root.element)node.remove();
  if(control.type==='ToggleButton')control.element.setAttribute('aria-pressed',String(!!control.IsChecked));
  return true;
}
export function renderDataContent(control){
  const template=control.ContentTemplate,content=control.Content;
  if(!template?.build){if(control._contentTemplateRoot){if(control._templateTransaction)control._templateTransaction.retire(control._contentTemplateRoot);else control._contentTemplateRoot.Dispose();control._contentTemplateRoot=null;}return false;}
  if(!control._contentTemplateRoot||control._contentTemplate!==template||!Object.is(control._contentData,content)){
    const next=template.build(content,control);if(control._templateTransaction)control._templateTransaction.retire(control._contentTemplateRoot);else control._contentTemplateRoot?.Dispose();control._contentTemplateRoot=next;control._contentTemplate=template;control._contentData=content;
  }
  const root=control._contentTemplateRoot;root.mount(control.container);
  for(const node of [...control.container.childNodes])if(node!==root.element)node.remove();return true;
}
