// Compilado solo por la prueba del instalador; no se distribuye dentro del producto.
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
internal static class ConfigProbe {
  static int Main() {
    PosCommon.Initialize();
    Console.InputEncoding = Encoding.UTF8;
    var config = PosCommon.Json.Deserialize<Dictionary<string, object>>(Console.In.ReadToEnd());
    string root = Convert.ToString(config["root"]);
    PosCommon.SaveConfig(root, config);
    var loaded = PosCommon.LoadConfig(root);
    if (loaded.ContainsKey("adminPassword") || Convert.ToString(loaded["dbPassword"]) != Convert.ToString(config["dbPassword"])) return 1;
    if (Encoding.UTF8.GetString(File.ReadAllBytes(Path.Combine(root, "data", "config.dat"))).Contains(Convert.ToString(config["dbPassword"]))) return 2;
    string longFolder = Path.Combine(root, "long-path-test", new String('x', 150), new String('y', 150));
    Directory.CreateDirectory(PosCommon.FilePath(longFolder));
    string longFile = Path.Combine(longFolder, "probe.txt");
    File.WriteAllText(PosCommon.FilePath(longFile), "test");
    if (File.ReadAllText(PosCommon.FilePath(longFile)) != "test") return 3;
    Directory.Delete(PosCommon.FilePath(Path.Combine(root, "long-path-test")), true);
    Console.WriteLine("Configuración protegida y recuperada correctamente.");
    return 0;
  }
}
