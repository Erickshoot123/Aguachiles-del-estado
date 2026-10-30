using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class PosInstaller {
  [STAThread] static int Main(string[] args) {
    PosCommon.Initialize();
    Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
    string root = PosCommon.Root(args, true);
    if (PosCommon.Has(args, "/silent")) {
      try { Install(root, false, false, text => {}); return 0; }
      catch (Exception error) { File.WriteAllText(Path.Combine(Path.GetTempPath(), "AguachilesPOS-install-error.txt"), error.ToString()); return 1; }
    }
    using (var form = new Form { Text = "Instalar Aguachiles POS", Width = 560, Height = 330, StartPosition = FormStartPosition.CenterScreen,
      FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, Font = new Font("Segoe UI", 10) }) {
      var info = new Label { Text = "Instalación local para Windows de 64 bits.\n\nIncluye aplicación, PostgreSQL y agente de impresión.\nLas actualizaciones conservan tus datos.\n\nCarpeta: " + root, Left = 20, Top = 20, Width = 500, Height = 125 };
      var desktop = new CheckBox { Text = "Crear acceso directo en el escritorio", Checked = true, Left = 20, Top = 150, Width = 450 };
      var startup = new CheckBox { Text = "Iniciar el POS al entrar a Windows", Checked = true, Left = 20, Top = 180, Width = 450 };
      var button = new Button { Text = "Instalar", Left = 360, Top = 225, Width = 150, Height = 38 };
      form.Controls.AddRange(new Control[] { info, desktop, startup, button });
      bool installed = false, working = false;
      form.FormClosing += (s, e) => { if (working) e.Cancel = true; };
      button.Click += async (s, e) => {
        if (installed) { Process.Start(new ProcessStartInfo(Path.Combine(root, "AguachilesPOS.exe")) { UseShellExecute = true }); form.Close(); return; }
        working = true; button.Enabled = false; desktop.Enabled = false; startup.Enabled = false;
        bool makeDesktop = desktop.Checked, autoStart = startup.Checked;
        try {
          await Task.Run(() => Install(root, makeDesktop, autoStart, text => form.BeginInvoke(new Action(() => info.Text = text))));
          installed = true; info.Text = "Instalación completada.\n\nAbre el POS para configurar la sucursal y el administrador.\n\nTus datos estarán en: " + Path.Combine(root, "data"); button.Text = "Abrir POS";
        } catch (Exception error) { MessageBox.Show(error.Message, "No se pudo instalar", MessageBoxButtons.OK, MessageBoxIcon.Error); }
        finally { working = false; button.Enabled = true; }
      };
      Application.Run(form);
    }
    return 0;
  }
  static void Install(string root, bool desktop, bool startup, Action<string> progress) {
    if (!Environment.Is64BitOperatingSystem || Environment.OSVersion.Version.Major < 10) throw new Exception("Se requiere Windows 10 u 11 de 64 bits.");
    if (!new DriveInfo(Path.GetPathRoot(root)).DriveFormat.Equals("NTFS", StringComparison.OrdinalIgnoreCase))
      throw new Exception("Instala el POS en una unidad NTFS, normalmente C:. Puedes llevar el instalador en USB, pero la base de datos se instala en Windows.");
    if (root.TrimEnd('\\') == Path.GetPathRoot(root).TrimEnd('\\')) throw new Exception("Selecciona una carpeta de instalación, no la raíz de una unidad.");
    if (Directory.Exists(root) && Directory.GetFileSystemEntries(root).Length > 0 && !PosCommon.IsInstallation(root))
      throw new Exception("La carpeta ya contiene archivos ajenos a esta instalación. Selecciona una carpeta nueva.");
    progress("Cerrando la instalación anterior, si está abierta…"); PosCommon.Stop(root);
    Directory.CreateDirectory(root);
    if (!PosCommon.IsInstallation(root)) File.WriteAllText(Path.Combine(root, "installation.json"), "{\"product\":\"AguachilesPOS\",\"state\":\"installing\"}");
    using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload"))
    using (var zip = new ZipArchive(resource, ZipArchiveMode.Read)) {
      var manifestEntry = zip.GetEntry("manifest.json");
      Dictionary<string, object> manifest;
      using (var reader = new StreamReader(manifestEntry.Open(), Encoding.UTF8)) manifest = PosCommon.Json.Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
      string version = Convert.ToString(manifest["version"]);
      if (!System.Text.RegularExpressions.Regex.IsMatch(version, "^[a-zA-Z0-9._-]+$")) throw new Exception("Versión de paquete inválida.");
      string destination = Path.GetFullPath(Path.Combine(root, "versions", version));
      Directory.CreateDirectory(destination);
      int current = 0;
      foreach (var entry in zip.Entries) {
        string relativeName = entry.FullName.Replace('\\', '/');
        string path = Path.GetFullPath(Path.Combine(destination, relativeName.Replace('/', Path.DirectorySeparatorChar)));
        if (!path.StartsWith(destination + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new Exception("Ruta no válida en el paquete.");
        if (relativeName.EndsWith("/")) { Directory.CreateDirectory(PosCommon.FilePath(path)); continue; }
        Directory.CreateDirectory(PosCommon.FilePath(Path.GetDirectoryName(path)));
        using (var input = entry.Open()) using (var output = File.Create(PosCommon.FilePath(path))) input.CopyTo(output);
        if (++current % 150 == 0) progress("Instalando archivos… " + current + " de " + zip.Entries.Count);
      }
      progress("Verificando la integridad de los archivos…");
      var files = (Dictionary<string, object>)manifest["files"];
      foreach (var item in files) {
        string path = Path.GetFullPath(Path.Combine(destination, item.Key.Replace('/', Path.DirectorySeparatorChar)));
        if (!path.StartsWith(destination + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new Exception("Ruta de verificación inválida.");
        using (var hash = SHA256.Create()) using (var input = File.OpenRead(PosCommon.FilePath(path))) {
          string actual = BitConverter.ToString(hash.ComputeHash(input)).Replace("-", "").ToLowerInvariant();
          if (actual != Convert.ToString(item.Value)) throw new Exception("Archivo dañado: " + item.Key);
        }
      }
      EnsureVisualCpp(destination, progress);
      File.Copy(Path.Combine(destination, "AguachilesPOS.exe"), Path.Combine(root, "AguachilesPOS.exe"), true);
      File.Copy(Path.Combine(destination, "Uninstall.exe"), Path.Combine(root, "Uninstall.exe"), true);
      File.WriteAllText(Path.Combine(root, "current-version"), version, new UTF8Encoding(false));
      File.WriteAllText(Path.Combine(root, "installation.json"), PosCommon.Json.Serialize(new { product = "AguachilesPOS", version = version }), new UTF8Encoding(false));
      PosCommon.ProtectDataDirectory(root);
      if (desktop) PosCommon.Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Aguachiles POS.lnk"), Path.Combine(root, "AguachilesPOS.exe"), "");
      if (desktop || startup) {
        Directory.CreateDirectory(PosCommon.ProgramsDirectory);
        PosCommon.Shortcut(Path.Combine(PosCommon.ProgramsDirectory, "Aguachiles POS.lnk"), Path.Combine(root, "AguachilesPOS.exe"), "");
        PosCommon.Shortcut(Path.Combine(PosCommon.ProgramsDirectory, "Desinstalar.lnk"), Path.Combine(root, "Uninstall.exe"), "");
        using (var key = Registry.CurrentUser.CreateSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AguachilesPOS")) {
          key.SetValue("DisplayName", "Aguachiles POS"); key.SetValue("Publisher", "Aguachiles del Estado"); key.SetValue("DisplayVersion", version);
          key.SetValue("UninstallString", PosCommon.Quote(Path.Combine(root, "Uninstall.exe"))); key.SetValue("NoModify", 1); key.SetValue("NoRepair", 1);
        }
        PosCommon.AutoStart(root, startup);
      }
    }
  }
  static void EnsureVisualCpp(string destination, Action<string> progress) {
    using (var registry = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64))
    using (var key = registry.OpenSubKey("SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64")) {
      Version version;
      if (key != null && Convert.ToInt32(key.GetValue("Installed", 0)) == 1 && Version.TryParse(Convert.ToString(key.GetValue("Version", "")).TrimStart('v'), out version)
        && version >= new Version(14, 44)) return;
    }
    progress("Preparando Microsoft Visual C++. Windows puede pedir permiso de administrador para este componente.");
    var start = new ProcessStartInfo(Path.Combine(destination, "prerequisites", "vc_redist.x64.exe"), "/install /passive /norestart") {
      UseShellExecute = true, Verb = "runas"
    };
    using (var process = Process.Start(start)) {
      process.WaitForExit();
      if (process.ExitCode != 0 && process.ExitCode != 1638 && process.ExitCode != 3010) throw new Exception("No se pudo instalar el componente de Microsoft. Código " + process.ExitCode);
    }
  }
}
