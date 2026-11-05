using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class UpdateRunner {
  [STAThread] static int Main(string[] args) {
    PosCommon.Initialize(); Application.EnableVisualStyles();
    string root = PosCommon.Root(args, false);
    if (!PosCommon.IsInstallation(root)) return 1;
    using (var mutex = new Mutex(false, PosCommon.EventName(root, "update"))) {
      if (!mutex.WaitOne(0)) return 1;
      bool updateLocked = true;
      using (var form = new Form { Text = "Actualizando Aguachiles POS", Icon = PosCommon.BrandIcon, Width = 520, Height = 170,
        StartPosition = FormStartPosition.CenterScreen, ControlBox = false, FormBorderStyle = FormBorderStyle.FixedDialog }) {
        var label = new Label { Text = "Verificando actualización…", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter, Font = new Font("Segoe UI", 11) };
        form.Controls.Add(label); int result = 0;
        form.Shown += async (s, e) => {
          try {
            await Task.Run(() => {
              var update = UpdatePackage.Verify(root, AppDomain.CurrentDomain.BaseDirectory);
              form.BeginInvoke(new Action(() => label.Text = "Cerrando servicios e instalando la nueva versión…"));
              PosCommon.Stop(root);
              using (var installer = Process.Start(new ProcessStartInfo(update.FilePath, "/silent /dir=" + PosCommon.Quote(root)) { UseShellExecute = false, CreateNoWindow = true })) {
                if (!installer.WaitForExit(600000)) throw new Exception("La instalación sigue en curso. Espera a que termine antes de volver a abrir el POS.");
                if (installer.ExitCode != 0) throw new Exception("La instalación no pudo completarse. Tus datos se conservaron. Revisa el registro de instalación.");
              }
              form.BeginInvoke(new Action(() => label.Text = "Abriendo y comprobando la nueva versión…"));
              form.Invoke(new Action(() => { mutex.ReleaseMutex(); updateLocked = false; Open(root); }));
              var config = PosCommon.LoadConfig(root);
              DateTime until = DateTime.UtcNow.AddMinutes(3);
              while (DateTime.UtcNow < until) {
                try {
                  var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + Convert.ToString(config["apiPort"]) + "/health");
                  request.Timeout = 1500; request.Proxy = null;
                  using (var response = (HttpWebResponse)request.GetResponse()) {
                    if (response.StatusCode == HttpStatusCode.OK && File.ReadAllText(Path.Combine(root, "data", "schema-version")).Trim() == update.Version) {
                      PosCommon.WriteAtomic(Path.Combine(root, "updates", "last-result.json"), PosCommon.Json.Serialize(new { success = true, version = update.Version })); return;
                    }
                  }
                } catch (WebException) { } catch (IOException) { }
                Thread.Sleep(500);
              }
              throw new Exception("No se pudo confirmar el arranque de la nueva versión. No se restauró la base automáticamente. Conserva los respaldos y solicita revisión.");
            });
          } catch (Exception error) {
            result = 1;
            PosCommon.WriteAtomic(Path.Combine(root, "updates", "last-result.json"), PosCommon.Json.Serialize(new { success = false, message = error.Message }));
            MessageBox.Show(error.Message, "Actualización de Aguachiles POS", MessageBoxButtons.OK, MessageBoxIcon.Error);
            // No restaurar una base o reiniciar otro instalador: podría haber migraciones aplicadas.
          } finally { form.Close(); }
        };
        Application.Run(form); if (updateLocked) mutex.ReleaseMutex(); return result;
      }
    }
  }
  static void Open(string root) {
    Process.Start(new ProcessStartInfo(Path.Combine(root, "AguachilesPOS.exe"), "/wait /root=" + PosCommon.Quote(root)) { UseShellExecute = true });
  }
}
