using System;
using System.Collections.Generic;
using System.IO;

internal static class InstallActivation {
  // El marcador de versión se cambia al final. Los datos permanecen fuera de esta operación.
  internal static void Activate(string root, string destination, string version) {
    string journal = Path.Combine(root, "updates", "activation-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(journal);
    var changed = new List<string>(); var existing = new HashSet<string>();
    string[] names = { "Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll", "AguachilesPOS.exe", "Uninstall.exe", "installation.json", "current-version" };
    try {
      foreach (string name in names) {
        string target = Path.Combine(root, name), backup = Path.Combine(journal, name);
        if (File.Exists(target)) { File.Copy(target, backup); existing.Add(name); }
        changed.Add(name);
        if (name == "current-version") PosCommon.WriteAtomic(target, version);
        else if (name == "installation.json") PosCommon.WriteAtomic(target, PosCommon.Json.Serialize(new { product = "AguachilesPOS", version = version }));
        else {
          string pending = target + ".pending-" + Guid.NewGuid().ToString("N");
          File.Copy(Path.Combine(destination, name), pending);
          if (File.Exists(target)) File.Replace(pending, target, null); else File.Move(pending, target);
        }
      }
    } catch {
      changed.Reverse();
      foreach (string name in changed) {
        string target = Path.Combine(root, name);
        if (existing.Contains(name)) File.Copy(Path.Combine(journal, name), target, true);
        else if (File.Exists(target)) File.Delete(target);
      }
      throw;
    }
  }
}
