using System;
using System.IO;

internal static class UpdateProbe {
  static int Main(string[] args) {
    try {
      if (args[0] == "verify") { Console.WriteLine(UpdatePackage.Verify(args[1], args[2]).Version); return 0; }
      if (args[0] == "reject") {
        try { UpdatePackage.Verify(args[1], args[2]); } catch { Console.WriteLine("Rechazado"); return 0; }
        throw new Exception("Se aceptó un paquete inválido");
      }
      string root = args[1], source = args[2];
      try { InstallActivation.Activate(root, source, "0.2.7"); throw new Exception("La activación incompleta debió fallar"); }
      catch (FileNotFoundException) { }
      if (File.ReadAllText(Path.Combine(root, "current-version")) != "0.2.6" || File.ReadAllText(Path.Combine(root, "AguachilesPOS.exe")) != "anterior") throw new Exception("No se restauraron los archivos anteriores");
      File.WriteAllText(Path.Combine(source, "Uninstall.exe"), "nuevo"); InstallActivation.Activate(root, source, "0.2.7");
      if (File.ReadAllText(Path.Combine(root, "current-version")) != "0.2.7" || File.ReadAllText(Path.Combine(root, "data", "sentinel")) != "conservar") throw new Exception("Activación incorrecta");
      Console.WriteLine("Activación y reversión de archivos verificadas; datos intactos"); return 0;
    } catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
  }
}
