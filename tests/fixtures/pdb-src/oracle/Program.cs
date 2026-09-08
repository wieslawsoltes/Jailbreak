using System.Reflection.Metadata;
using System.Reflection.Metadata.Ecma335;
using System.Reflection.PortableExecutable;
using System.Text.Json;
var output = args[0];
using var peStream = File.OpenRead(Path.Combine(output,"lib/Jailbreak.PdbExamples.dll"));
using var pe = new PEReader(peStream);
var metadata = pe.GetMetadataReader();
using var pdbStream = File.OpenRead(Path.Combine(output,"lib/Jailbreak.PdbExamples.pdb"));
using var provider = MetadataReaderProvider.FromPortablePdbStream(pdbStream);
var pdb = provider.GetMetadataReader();
var documents = pdb.Documents.Select(handle => {
    var d = pdb.GetDocument(handle);
    return new { id=MetadataTokens.GetRowNumber(handle), name=pdb.GetString(d.Name), hashAlgorithm=pdb.GetGuid(d.HashAlgorithm), hash=Convert.ToHexString(pdb.GetBlobBytes(d.Hash)).ToLowerInvariant(), language=pdb.GetGuid(d.Language) };
});
var methods = metadata.MethodDefinitions.Select(handle => {
    var m = metadata.GetMethodDefinition(handle);
    var info = pdb.GetMethodDebugInformation(handle);
    var points = info.GetSequencePoints().Select(p=>new {offset=p.Offset,document=MetadataTokens.GetRowNumber(p.Document),line=p.StartLine,column=p.StartColumn,endLine=p.EndLine,endColumn=p.EndColumn,hidden=p.IsHidden});
    var scopes = pdb.GetLocalScopes(handle).Select(s=> {
        var scope=pdb.GetLocalScope(s);
        return new {start=scope.StartOffset,end=scope.StartOffset+scope.Length,variables=scope.GetLocalVariables().Select(v=>{var local=pdb.GetLocalVariable(v);return new {name=pdb.GetString(local.Name),slot=local.Index,hidden=(local.Attributes & LocalVariableAttributes.DebuggerHidden)!=0};})};
    });
    return new {token=MetadataTokens.GetToken(handle),name=metadata.GetString(m.Name),points,scopes};
});
var results=new {sum=PdbExamples.Calculations.Sum(10),twice=PdbExamples.Calculations.Twice(9),guarded=PdbExamples.Calculations.Guarded(int.MaxValue),cleanup=PdbExamples.Calculations.Cleanup};
File.WriteAllText(Path.Combine(output,"oracle.json"),JsonSerializer.Serialize(new {id=Convert.ToHexString(pdb.DebugMetadataHeader!.Id.ToArray()).ToLowerInvariant(),documents,methods,results},new JsonSerializerOptions{WriteIndented=true}));
