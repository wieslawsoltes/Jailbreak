/** ECMA-335 II.22 table layouts. Numeric entries are simple table indices. */
export const codedIndices={
  TypeDefOrRef:[2,[2,1,27]],HasConstant:[2,[4,8,23]],HasCustomAttribute:[5,[6,4,1,2,8,9,10,0,14,23,20,17,26,27,32,35,38,39,40,42,44,43]],
  HasFieldMarshal:[1,[4,8]],HasDeclSecurity:[2,[2,6,32]],MemberRefParent:[3,[2,1,26,6,27]],HasSemantics:[1,[20,23]],MethodDefOrRef:[1,[6,10]],
  MemberForwarded:[1,[4,6]],Implementation:[2,[38,35,39]],CustomAttributeType:[3,[-1,-1,6,10,-1]],ResolutionScope:[2,[0,26,35,1]],TypeOrMethodDef:[1,[2,6]]
};
const s='string',b='blob',g='guid',u2='u16',u4='u32';
export const tableNames=['Module','TypeRef','TypeDef','FieldPtr','Field','MethodPtr','MethodDef','ParamPtr','Param','InterfaceImpl','MemberRef','Constant','CustomAttribute','FieldMarshal','DeclSecurity','ClassLayout','FieldLayout','StandAloneSig','EventMap','EventPtr','Event','PropertyMap','PropertyPtr','Property','MethodSemantics','MethodImpl','ModuleRef','TypeSpec','ImplMap','FieldRVA','ENCLog','ENCMap','Assembly','AssemblyProcessor','AssemblyOS','AssemblyRef','AssemblyRefProcessor','AssemblyRefOS','File','ExportedType','ManifestResource','NestedClass','GenericParam','MethodSpec','GenericParamConstraint'];
export const tableSchemas=[
  [['Generation',u2],['Name',s],['Mvid',g],['EncId',g],['EncBaseId',g]],
  [['ResolutionScope','ResolutionScope'],['Name',s],['Namespace',s]],
  [['Flags',u4],['Name',s],['Namespace',s],['Extends','TypeDefOrRef'],['FieldList',4],['MethodList',6]],
  [['Field',4]], [['Flags',u2],['Name',s],['Signature',b]], [['Method',6]],
  [['RVA',u4],['ImplFlags',u2],['Flags',u2],['Name',s],['Signature',b],['ParamList',8]],
  [['Param',8]], [['Flags',u2],['Sequence',u2],['Name',s]], [['Class',2],['Interface','TypeDefOrRef']],
  [['Class','MemberRefParent'],['Name',s],['Signature',b]], [['Type',u2],['Parent','HasConstant'],['Value',b]],
  [['Parent','HasCustomAttribute'],['Type','CustomAttributeType'],['Value',b]], [['Parent','HasFieldMarshal'],['NativeType',b]],
  [['Action',u2],['Parent','HasDeclSecurity'],['PermissionSet',b]], [['PackingSize',u2],['ClassSize',u4],['Parent',2]], [['Offset',u4],['Field',4]],
  [['Signature',b]], [['Parent',2],['EventList',20]], [['Event',20]], [['EventFlags',u2],['Name',s],['EventType','TypeDefOrRef']],
  [['Parent',2],['PropertyList',23]], [['Property',23]], [['Flags',u2],['Name',s],['Type',b]],
  [['Semantics',u2],['Method',6],['Association','HasSemantics']], [['Class',2],['MethodBody','MethodDefOrRef'],['MethodDeclaration','MethodDefOrRef']],
  [['Name',s]], [['Signature',b]], [['MappingFlags',u2],['MemberForwarded','MemberForwarded'],['ImportName',s],['ImportScope',26]],
  [['RVA',u4],['Field',4]], [['Token',u4],['FuncCode',u4]], [['Token',u4]],
  [['HashAlgId',u4],['MajorVersion',u2],['MinorVersion',u2],['BuildNumber',u2],['RevisionNumber',u2],['Flags',u4],['PublicKey',b],['Name',s],['Culture',s]],
  [['Processor',u4]], [['OSPlatformId',u4],['OSMajorVersion',u4],['OSMinorVersion',u4]],
  [['MajorVersion',u2],['MinorVersion',u2],['BuildNumber',u2],['RevisionNumber',u2],['Flags',u4],['PublicKeyOrToken',b],['Name',s],['Culture',s],['HashValue',b]],
  [['Processor',u4],['AssemblyRef',35]], [['OSPlatformId',u4],['OSMajorVersion',u4],['OSMinorVersion',u4],['AssemblyRef',35]],
  [['Flags',u4],['Name',s],['HashValue',b]], [['Flags',u4],['TypeDefId',u4],['TypeName',s],['TypeNamespace',s],['Implementation','Implementation']],
  [['Offset',u4],['Flags',u4],['Name',s],['Implementation','Implementation']], [['NestedClass',2],['EnclosingClass',2]],
  [['Number',u2],['Flags',u2],['Owner','TypeOrMethodDef'],['Name',s]], [['Method','MethodDefOrRef'],['Instantiation',b]], [['Owner',42],['Constraint','TypeDefOrRef']]
];
export function decodeCoded(value,kind){const [bits,tables]=codedIndices[kind];const row=value>>>bits,table=tables[value&((1<<bits)-1)];if(!value)return 0;if(table==null||table<0)throw new Error('Invalid coded metadata index '+kind);return table*16777216+row;}
