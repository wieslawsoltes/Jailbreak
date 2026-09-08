/** Shared managed exception identity; typed catches never compare message strings. */
export class Exception extends Error {
  constructor(message='',inner=null){super(message??'');this.name=new.target.name;this.InnerException=inner;}
  get Message(){return this.message;}
  get StackTrace(){return this.stack;}
}
export class SystemException extends Exception {}
export class ArithmeticException extends SystemException {}
export class OverflowException extends ArithmeticException {}
export class DivideByZeroException extends ArithmeticException {}
export class NullReferenceException extends SystemException {}
export class IndexOutOfRangeException extends SystemException {}
export class InvalidCastException extends SystemException {}
export class ArgumentException extends SystemException {}
export class ArgumentNullException extends ArgumentException {}
export class ArgumentOutOfRangeException extends ArgumentException {}
export class InvalidOperationException extends SystemException {}
export class NotSupportedException extends SystemException {}
export class FormatException extends SystemException {}
export class TypeInitializationException extends SystemException {}
const core=new Set(['System.Runtime','System.Private.CoreLib','mscorlib','netstandard']);
const constructors={Exception,SystemException,ArithmeticException,OverflowException,DivideByZeroException,
  NullReferenceException,IndexOutOfRangeException,InvalidCastException,ArgumentException,ArgumentNullException,
  ArgumentOutOfRangeException,InvalidOperationException,NotSupportedException,FormatException,TypeInitializationException};
export function resolveExceptionType(type){
  if(!type||!core.has(type.assembly)||!type.name?.startsWith('System.'))return null;
  const name=type.name.slice(7);return Object.hasOwn(constructors,name)?constructors[name]:null;
}
export function exceptionTypeNames(){return Object.keys(constructors).map(n=>'System.'+n);}
export function matchesException(error,type){
  if(core.has(type.assembly)&&type.name==='System.Object')return error!=null;
  const Constructor=resolveExceptionType(type);return !!Constructor&&error instanceof Constructor;
}
