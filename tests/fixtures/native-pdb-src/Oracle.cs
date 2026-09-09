using System;
using System.Diagnostics;
using System.Reflection;
using System.IO;
using NativeSymbols;
class Oracle
{
    static void Main(string[] args)
    {
        int line = 0;
        string file = "";
        try { Calculations.Fail(); }
        catch (Exception error)
        {
            StackFrame frame = new StackTrace(error, true).GetFrame(0);
            line = frame.GetFileLineNumber();
            file = Path.GetFileName(frame.GetFileName());
        }
        if (line == 0 || file != "Library.cs") throw new Exception("CLR could not read native PDB source locations");
        string methods = "";
        foreach (MethodInfo method in typeof(Calculations).GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly))
        {
            if (methods.Length > 0) methods += ",";
            methods += "{\"name\":\"" + method.Name + "\",\"token\":" + method.MetadataToken + "}";
        }
        File.WriteAllText(args[0], "{\"sum\":" + Calculations.Sum(10) + ",\"twice\":" + Calculations.Twice(21) + ",\"throwLine\":" + line + ",\"methods\":[" + methods + "]}");
    }
}
