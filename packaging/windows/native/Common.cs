using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using Microsoft.Win32;

[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.8", FrameworkDisplayName = ".NET Framework 4.8")]

internal static class PosCommon {
  static PosCommon() {
    AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling", false);
    AppContext.SetSwitch("Switch.System.IO.BlockLongPaths", false);
  }
  internal static void Initialize() { }
  internal static string FilePath(string value) {
    string path = Path.GetFullPath(value);
    if (path.StartsWith("\\\\?\\")) return path;
    return path.StartsWith("\\\\") ? "\\\\?\\UNC\\" + path.Substring(2) : "\\\\?\\" + path;
  }
  internal static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 16777216 };
  internal static string Argument(string[] args, string key) {
    foreach (string arg in args) if (arg.StartsWith(key + "=", StringComparison.OrdinalIgnoreCase)) return arg.Substring(key.Length + 1);
    return null;
  }
  internal static bool Has(string[] args, string flag) { return Array.Exists(args, x => x.Equals(flag, StringComparison.OrdinalIgnoreCase)); }
  internal static string DefaultRoot { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AguachilesPOS"); } }
  internal static string Root(string[] args, bool installer) {
    string value = Argument(args, "/root") ?? Argument(args, "/dir");
    return Path.GetFullPath(value ?? (installer ? DefaultRoot : Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)));
  }
  internal static string EventName(string root, string action) {
    using (var hash = SHA256.Create()) return "Local\\AguachilesPOS-" + action + "-" + BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(root.ToLowerInvariant()))).Replace("-", "").Substring(0, 24);
  }
  internal static string Quote(string value) { return "\"" + value.Replace("\"", "\\\"") + "\""; }
  internal static bool IsInstallation(string root) {
    try {
      var marker = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(root, "installation.json")));
      return marker.ContainsKey("product") && Convert.ToString(marker["product"]) == "AguachilesPOS";
    } catch { return false; }
  }
  internal static void SendEvent(string root, string action) {
    try { using (var signal = EventWaitHandle.OpenExisting(EventName(root, action))) signal.Set(); } catch (WaitHandleCannotBeOpenedException) { }
  }
  internal static void Stop(string root) {
    SendEvent(root, "stop");
    using (var mutex = new Mutex(false, EventName(root, "mutex"))) {
      bool locked = false;
      try { locked = mutex.WaitOne(90000); } catch (AbandonedMutexException) { locked = true; }
      if (!locked) throw new Exception("Cierra Aguachiles POS antes de continuar. No se detuvieron otros programas.");
      mutex.ReleaseMutex();
    }
  }
  internal static void ProtectDataDirectory(string root) {
    string data = Path.Combine(root, "data");
    Directory.CreateDirectory(data);
    var user = WindowsIdentity.GetCurrent().User;
    var acl = new DirectorySecurity();
    acl.SetAccessRuleProtection(true, false);
    acl.SetOwner(user);
    foreach (var sid in new[] { user, new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null) })
      acl.AddAccessRule(new FileSystemAccessRule(sid, FileSystemRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
    new DirectoryInfo(data).SetAccessControl(acl);
  }
  internal static Dictionary<string, object> LoadConfig(string root) {
    string path = Path.Combine(root, "data", "config.dat");
    if (!File.Exists(path)) return null;
    byte[] value = ProtectedData.Unprotect(File.ReadAllBytes(path), null, DataProtectionScope.CurrentUser);
    return Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(value));
  }
  internal static void SaveConfig(string root, Dictionary<string, object> config) {
    ProtectDataDirectory(root);
    var stored = new Dictionary<string, object>(config);
    stored.Remove("adminPassword");
    byte[] data = ProtectedData.Protect(Encoding.UTF8.GetBytes(Json.Serialize(stored)), null, DataProtectionScope.CurrentUser);
    string path = Path.Combine(root, "data", "config.dat");
    string pending = path + ".new";
    File.WriteAllBytes(pending, data);
    if (File.Exists(path)) File.Replace(pending, path, null); else File.Move(pending, path);
  }
  internal static string Secret() {
    var bytes = new byte[32];
    using (var random = RandomNumberGenerator.Create()) random.GetBytes(bytes);
    return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
  }
  internal static void AutoStart(string root, bool enabled) {
    using (var key = Registry.CurrentUser.CreateSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Run")) {
      if (enabled) key.SetValue("AguachilesPOS", Quote(Path.Combine(root, "AguachilesPOS.exe")) + " /background");
      else key.DeleteValue("AguachilesPOS", false);
    }
  }
  internal static void Shortcut(string path, string executable, string arguments) {
    dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
    dynamic shortcut = shell.CreateShortcut(path);
    shortcut.TargetPath = executable;
    shortcut.Arguments = arguments;
    shortcut.WorkingDirectory = Path.GetDirectoryName(executable);
    shortcut.Description = "Aguachiles del Estado · Punto de venta";
    shortcut.Save();
  }
  internal static string ProgramsDirectory { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Aguachiles POS"); } }
}
