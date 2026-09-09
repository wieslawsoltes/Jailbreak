import test from 'node:test';
import assert from 'node:assert/strict';
import {compileProject} from '../packages/project-system/index.js';
import {createRuntime} from '../packages/avalonia-runtime/index.js';
const files={
 'View.axaml':`<UserControl xmlns="https://github.com/avaloniaui" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" x:Class="Demo.View">
 <StackPanel Name="Panel">
  <TextBox Name="Input" Text="initial"/>
  <Button Name="Action" Content="Run" Click="HandleClick"/>
 </StackPanel>
</UserControl>`,
 'View.cs':`namespace Demo;
 public partial class View : UserControl {
 public static int finished=0;
 public int count=5;
 public View(){InitializeComponent(); finished+=1; Action.Content="Ready";}
 public void HandleClick(object s,RoutedEventArgs e){ count+=1; Input.Text=$"{count}"; }
 }`
};
function build(input=files){const result=compileProject(input,{debug:true,cooperativeDebug:true});assert.equal(result.success,true,JSON.stringify(result.diagnostics));const JB=createRuntime(),events=[];JB.enableDevelopment({debug:result.debug,nativeBreaks:false,report:(event,data)=>events.push({event,data})});new Function('JB',result.code)(JB);return {JB,result,events};}
function paused(JB){return JB.dev.co.state().find(t=>t.status==='paused');}
test('XAML pauses before allocating the target and resumes before constructor tail',async()=>{
 const {JB,events}=build();JB.dev.configure({breakpoints:[{file:'View.axaml',line:4}]});
 const task=JB.dev.co.run(JB.createFromXamlSteps('Demo.View'));const state=paused(JB);assert.ok(state);assert.equal(state.point.language,'xaml');
 const stop=events.findLast(e=>e.event==='debug-paused').data;assert.ok(stop.frames.some(f=>f.method==='Demo.View.ctor'));
 const owner=events.findLast(e=>e.event==='debug-hit').data.locals.owner;assert.ok(owner);
 assert.equal(JB.types.get('Demo.View').finished,0);
 JB.dev.co.command(task.taskId,'continue');const root=await task.promise;
 assert.equal(root.Action.Content,'Ready');assert.equal(root.count,5);assert.equal(JB.types.get('Demo.View').finished,1);assert.equal(root.Input.Text,'initial');
 await root.Action.raise('Click');await new Promise(r=>setTimeout(r,5));assert.equal(root.count,6);root.Dispose();
});
test('cancelling paused hydration disposes children and does not run constructor tail',async()=>{
 const {JB}=build();JB.dev.configure({breakpoints:[{file:'View.axaml',line:4}]});
 const original=JB.dev.register,created=[];JB.dev.register=(control,source)=>{created.push(control);return original(control,source);};
 const task=JB.dev.co.run(JB.createFromXamlSteps('Demo.View'));assert.ok(paused(JB));
 JB.dev.co.command(task.taskId,'cancel');await task.promise;
 assert.ok(created.length>=3);assert.ok(created.every(c=>c._disposed));assert.equal(JB.types.get('Demo.View').finished,0);assert.equal(JB.dev.co.busy,false);
 assert.equal(created[0].Input,undefined);assert.equal(created[0].Action,undefined);
});
test('normal and resumable construction have matching property and namescope results',async()=>{
 const native=build(),co=build();const a=native.JB.createFromXaml('Demo.View'),b=await co.JB.dev.co.run(co.JB.createFromXamlSteps('Demo.View')).promise;
 for(const root of [a,b]){assert.equal(root.FindControl('Input'),root.Input);assert.equal(root.Action.Content,'Ready');assert.equal(root.count,5);root.Dispose();}
});
test('constructor continuations preserve base allocation field initializers and calls',async()=>{
 const {JB}=build({'Ctor.cs':`public class Base { public int x=2; public Base(int a){x+=a;} } public class Derived:Base { public int y=3; public Derived(int a):base(a){y+=x;} public static Derived Make(){return new Derived(4);} }`});
 const T=JB.types.get('Derived'),root=await JB.dev.co.start(T,'Make').promise;
 assert.ok(root instanceof T);assert.equal(root.x,6);assert.equal(root.y,9);assert.deepEqual([new T(4).x,new T(4).y],[root.x,root.y]);
});
test('nested CSharp UI constructors suspend inside child XAML exactly once',async()=>{
 const input={'Inner.axaml':'<UserControl xmlns="https://github.com/avaloniaui" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" x:Class="Inner"><Button Name="B" Content="inner"/></UserControl>',
 'Test.cs':'public partial class Inner:UserControl {public static int runs=0;public Inner(){InitializeComponent();runs++;}} public class Make {public static Inner Run(){return new Inner();}}'};
 const {JB}=build(input);JB.dev.configure({breakpoints:[{file:'Inner.axaml',line:1}]});const task=JB.dev.co.start(JB.types.get('Make'),'Run');
 let stops=0;while(paused(JB)){stops++;JB.dev.co.command(task.taskId,'continue');}const root=await task.promise;
 assert.equal(stops,2);assert.equal(JB.types.get('Inner').runs,1);assert.equal(root.B.Content,'inner');root.Dispose();
});
test('resumable property-element children traverse the same loader',async()=>{
 const {JB}=build({'A.axaml':'<StackPanel xmlns="https://github.com/avaloniaui"><StackPanel.Children><Button Name="B" Content="Hi"/></StackPanel.Children></StackPanel>'});
 const task=JB.dev.co.run(JB.createFromXamlSteps('A.axaml'));const root=await task.promise;assert.equal(root.Children.Count,1);assert.equal(root.FindControl('B').Content,'Hi');root.Dispose();
});
test('XAML errors fail the task and roll back partial root ownership',async()=>{
 const {JB}=build();const ir=JB.documents.get('Demo.View');ir.root.children[0].children[1].type='NotRegistered';const created=[];const orig=JB.dev.register;JB.dev.register=(c,s)=>{created.push(c);orig(c,s);};
 const task=JB.dev.co.run(JB.createFromXamlSteps('Demo.View'));await assert.rejects(task.promise,/NotRegistered/);assert.ok(created.every(c=>c._disposed));assert.equal(JB.dev.co.busy,false);assert.equal(JB.types.get('Demo.View').finished,0);
});
test('cooperative constructors and XAML are absent from release emitted code',()=>{
 const result=compileProject(files);assert.equal(result.success,true);assert.doesNotMatch(result.code,/registerConstructor|loadXamlSteps|checkpoint/);assert.equal(result.debug,undefined);
});
