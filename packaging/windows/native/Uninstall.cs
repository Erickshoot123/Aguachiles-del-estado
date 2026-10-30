using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class PosUninstall {
  [STAThread] static int Main(string[] args) {
    PosCommon.Initialize();
    Application.EnableVisualStyles();
    try {
      string root = PosCommon.Root(args, false);
      if (!PosCommon.IsInstallation(root)) throw new Exception("No se encontró una instalación reconocida. No se eliminaron archivos.");
      if (!PosCommon.Has(args, "/execute")) {
        if (!PosCommon.Has(args, "/silent") && MessageBox.Show("¿Desinstalar Aguachiles POS?\n\nLas ventas, respaldos y configuraciones se conservarán en la carpeta data.", "Desinstalar", MessageBoxButtons.YesNo) != DialogResult.Yes) return 0;
        string temporary = Path.Combine(Path.GetTempPath(), "Aguachiles-uninstall-" + Guid.NewGuid().ToString("N") + ".exe");
        File.Copy(Assembly.GetExecutingAssembly().Location, temporary);
        Process.Start(new ProcessStartInfo(temporary, "/execute /root=" + PosCommon.Quote(root) + (PosCommon.Has(args, "/silent") ? " /silent" : "")) { UseShellExecute = true });
        return 0;
      }
      PosCommon.Stop(root);
      string versions = Path.GetFullPath(Path.Combine(root, "versions"));
      if (!versions.StartsWith(Path.GetFullPath(root).TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase)) throw new Exception("Ruta de programa inválida.");
      if (Directory.Exists(versions)) Directory.Delete(PosCommon.FilePath(versions), true);
      foreach (string name in new[] { "AguachilesPOS.exe", "Uninstall.exe", "current-version" }) File.Delete(Path.Combine(root, name));
      string desktop = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Aguachiles POS.lnk");
      // Solo se registran accesos del directorio estándar del usuario.
      if (root.Equals(PosCommon.DefaultRoot, StringComparison.OrdinalIgnoreCase)) {
        File.Delete(desktop);
        if (Directory.Exists(PosCommon.ProgramsDirectory)) Directory.Delete(PosCommon.ProgramsDirectory, true);
        PosCommon.AutoStart(root, false);
        Registry.CurrentUser.DeleteSubKeyTree("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AguachilesPOS", false);
      }
      if (!PosCommon.Has(args, "/silent")) MessageBox.Show("Programa desinstalado. Tus datos se conservaron en:\n" + Path.Combine(root, "data"));
      return 0;
    } catch (Exception error) { if (!PosCommon.Has(args, "/silent")) MessageBox.Show(error.Message); return 1; }
  }
}
