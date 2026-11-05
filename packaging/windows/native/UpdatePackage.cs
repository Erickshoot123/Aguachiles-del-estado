using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

internal sealed class VerifiedUpdate {
  internal string Version, FilePath;
}
internal static class UpdatePackage {
  internal static VerifiedUpdate Verify(string root, string application) {
    var channel = PosCommon.Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(application, "update-channel.json")));
    string key = Convert.ToString(channel["publicKeyXml"]);
    if (String.IsNullOrEmpty(key)) throw new Exception("No se configuró la clave pública de actualizaciones.");
    string planPath = Path.Combine(root, "updates", "install-plan.json");
    if (new FileInfo(planPath).Length > 100000) throw new Exception("Plan de actualización inválido.");
    var plan = PosCommon.Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(planPath));
    byte[] manifestBytes = Convert.FromBase64String(Convert.ToString(plan["manifest"]));
    byte[] signature = Convert.FromBase64String(Convert.ToString(plan["signature"]));
    if (manifestBytes.Length > 65536 || signature.Length > 2048) throw new Exception("Manifiesto inválido.");
    using (var rsa = new RSACryptoServiceProvider()) {
      rsa.PersistKeyInCsp = false; rsa.FromXmlString(key);
      if (rsa.KeySize < 3072 || !rsa.VerifyData(manifestBytes, CryptoConfig.MapNameToOID("SHA256"), signature))
        throw new Exception("La firma del paquete no es válida. No se ejecutó el instalador.");
    }
    var data = PosCommon.Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(manifestBytes));
    string version = Convert.ToString(data["version"]);
    Version parsed;
    if (!Regex.IsMatch(version, @"^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$") || !Version.TryParse(version, out parsed)) throw new Exception("Versión inválida.");
    Version minimum;
    if (!Version.TryParse(Convert.ToString(data["minimumUpdaterVersion"]), out minimum) || minimum > new Version(1, 0, 0)) throw new Exception("Se requiere un actualizador más reciente.");
    string installed = File.ReadAllText(Path.Combine(root, "current-version")).Trim();
    Version current;
    var currentMatch = Regex.Match(installed, @"^(\d+\.\d+\.\d+)(-preview-\d+)?$");
    if (!currentMatch.Success || !Version.TryParse(currentMatch.Groups[1].Value, out current)
      || parsed < current || (parsed == current && !currentMatch.Groups[2].Success)) throw new Exception("El paquete no es más reciente que la versión instalada.");
    string expectedName = "AguachilesPOS-Instalador-" + version + ".exe";
    if (Convert.ToInt32(data["formatVersion"]) != 1 || Convert.ToString(data["product"]) != "AguachilesPOS"
      || Convert.ToString(data["platform"]) != "windows-x64" || Convert.ToString(data["asset"]) != expectedName) throw new Exception("El paquete no corresponde a este POS.");
    string path = Path.Combine(root, "updates", version, expectedName);
    long size = Convert.ToInt64(data["size"]);
    string expectedHash = Convert.ToString(data["sha256"]);
    if (size < 1 || size > 1073741824 || new FileInfo(path).Length != size || !Regex.IsMatch(expectedHash, "^[a-f0-9]{64}$")) throw new Exception("El tamaño del paquete no coincide.");
    using (var hash = SHA256.Create()) using (var input = File.OpenRead(path)) {
      string actual = BitConverter.ToString(hash.ComputeHash(input)).Replace("-", "").ToLowerInvariant();
      if (actual != expectedHash) throw new Exception("El paquete fue alterado. No se ejecutó el instalador.");
    }
    return new VerifiedUpdate { Version = version, FilePath = path };
  }
}
