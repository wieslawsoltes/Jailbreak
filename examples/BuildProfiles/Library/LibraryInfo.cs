namespace SampleLibrary;
public static class LibraryInfo
{
#if LIBRARY && NETSTANDARD2_0 && !APP
    public static string Label => "Referenced library: netstandard2.0 / isolated symbols";
#else
#error Library received an incorrect project symbol profile
#endif
}
