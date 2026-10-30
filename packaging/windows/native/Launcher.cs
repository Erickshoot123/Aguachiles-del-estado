using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class PosLauncher {
  [STAThread] static int Main(string[] args) {
    PosCommon.Initialize();
    Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
    try {
      string root = PosCommon.Root(args, false);
      if (PosCommon.Has(args, "/stop")) { PosCommon.SendEvent(root, "stop"); return 0; }
      using (var mutex = new Mutex(false, PosCommon.EventName(root, "mutex"))) {
        bool acquired;
        try { acquired = mutex.WaitOne(0); } catch (AbandonedMutexException) { acquired = true; }
        if (!acquired && PosCommon.Has(args, "/wait")) { try { acquired = mutex.WaitOne(90000); } catch (AbandonedMutexException) { acquired = true; } }
        if (!acquired) { PosCommon.SendEvent(root, "open"); return 0; }
        try {
          var config = PosCommon.LoadConfig(root) ?? new Dictionary<string, object> {
            { "root", root }, { "locationName", "Sucursal principal" }, { "adminUsername", "admin" },
            { "dbPassword", PosCommon.Secret() }, { "appPassword", PosCommon.Secret() }, { "jwtSecret", PosCommon.Secret() },
            { "dbPort", 54329 }, { "webPort", 48880 }, { "apiPort", 48881 }, { "printPort", 48882 },
            { "timeZone", "America/Mazatlan" }, { "printerName", "" }
          };
          config["root"] = root;
          bool first = !File.Exists(Path.Combine(root, "data", "configured"));
          if (first || PosCommon.Has(args, "/printer")) {
            using (var form = new PosSetupForm(config, first)) if (form.ShowDialog() != DialogResult.OK) return 0;
            PosCommon.SaveConfig(root, config);
          }
          string version = File.ReadAllText(Path.Combine(root, "current-version")).Trim();
          if (!System.Text.RegularExpressions.Regex.IsMatch(version, "^[a-zA-Z0-9._-]+$")) throw new Exception("Versión instalada inválida.");
          Application.Run(new PosContext(root, Path.Combine(root, "versions", version), config, !PosCommon.Has(args, "/background")));
        } finally { mutex.ReleaseMutex(); }
      }
      return 0;
    } catch (Exception error) { MessageBox.Show(error.Message, "Aguachiles POS", MessageBoxButtons.OK, MessageBoxIcon.Error); return 1; }
  }
}

internal sealed class PosContext : ApplicationContext {
  readonly string root, appDir;
  readonly Dictionary<string, object> config;
  readonly NotifyIcon tray;
  readonly Form status;
  readonly Label label;
  readonly EventWaitHandle stopSignal, openSignal;
  readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
  Process node;
  string url;
  bool openWhenReady, closing, restartPrinter;
  internal PosContext(string rootPath, string application, Dictionary<string, object> settings, bool showBrowser) {
    root = rootPath; appDir = application; config = settings; openWhenReady = showBrowser;
    stopSignal = new EventWaitHandle(false, EventResetMode.AutoReset, PosCommon.EventName(root, "stop"));
    openSignal = new EventWaitHandle(false, EventResetMode.AutoReset, PosCommon.EventName(root, "open"));
    status = new Form { Text = "Aguachiles POS", Width = 480, Height = 150, StartPosition = FormStartPosition.CenterScreen, FormBorderStyle = FormBorderStyle.FixedDialog, ControlBox = false };
    label = new Label { Text = "Iniciando…", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter, Font = new Font("Segoe UI", 11) };
    status.Controls.Add(label); status.Show();
    var menu = new ContextMenuStrip();
    menu.Items.Add("Abrir POS", null, (s, e) => Open());
    menu.Items.Add("Configurar impresora", null, (s, e) => { restartPrinter = true; ClosePos(); });
    menu.Items.Add("Crear respaldo", null, (s, e) => Send("BACKUP"));
    menu.Items.Add("Abrir respaldos y registros", null, (s, e) => Process.Start("explorer.exe", PosCommon.Quote(Path.Combine(root, "data"))));
    menu.Items.Add("Cerrar POS", null, (s, e) => ClosePos());
    tray = new NotifyIcon { Icon = SystemIcons.Application, Text = "Aguachiles POS · iniciando", Visible = true, ContextMenuStrip = menu };
    tray.DoubleClick += (s, e) => Open();
    timer.Interval = 250; timer.Tick += (s, e) => { if (stopSignal.WaitOne(0)) ClosePos(); if (openSignal.WaitOne(0)) Open(); }; timer.Start();
    node = new Process { StartInfo = new ProcessStartInfo(Path.Combine(appDir, "node", "node.exe"), PosCommon.Quote(Path.Combine(appDir, "desktop", "supervisor.mjs"))) {
      WorkingDirectory = appDir, UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true,
      RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
    }, EnableRaisingEvents = true };
    node.OutputDataReceived += (s, e) => { if (e.Data != null) Ui(() => Receive(e.Data)); };
    node.ErrorDataReceived += (s, e) => { if (e.Data != null) File.AppendAllText(Path.Combine(root, "data", "logs", "launcher.log"), e.Data + Environment.NewLine); };
    node.Exited += (s, e) => Ui(() => {
      if (!closing && node.ExitCode != 0) MessageBox.Show("No se pudo iniciar el POS. Revisa la carpeta de registros. Tus datos se conservan.", "Aguachiles POS");
      Finish();
    });
    Directory.CreateDirectory(Path.Combine(root, "data", "logs"));
    node.Start(); node.BeginOutputReadLine(); node.BeginErrorReadLine();
    byte[] input = Encoding.UTF8.GetBytes(PosCommon.Json.Serialize(config) + "\n");
    node.StandardInput.BaseStream.Write(input, 0, input.Length); node.StandardInput.BaseStream.Flush();
    config.Remove("adminPassword");
  }
  void Ui(Action action) { if (!status.IsDisposed) try { status.BeginInvoke(action); } catch (InvalidOperationException) { } }
  void Receive(string line) {
    try {
      var item = PosCommon.Json.Deserialize<Dictionary<string, object>>(line);
      string type = Convert.ToString(item["type"]), message = Convert.ToString(item["message"]);
      if (type == "ready") { url = message; tray.Text = "Aguachiles POS · activo"; status.Hide(); if (openWhenReady && !closing) Open(); }
      else if (type == "status") label.Text = message;
      else if (type == "backup") { tray.ShowBalloonTip(6000, "Respaldo creado", message, ToolTipIcon.Info); }
      else if (type == "error") {
        File.AppendAllText(Path.Combine(root, "data", "logs", "launcher.log"), message + Environment.NewLine);
        MessageBox.Show(message, "Aguachiles POS", MessageBoxButtons.OK, MessageBoxIcon.Error);
      }
    } catch (ArgumentException) { }
  }
  void Open() { if (url != null && !closing) Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); else openWhenReady = true; }
  void Send(string command) { try { if (!node.HasExited) { byte[] data = Encoding.UTF8.GetBytes(command + "\n"); node.StandardInput.BaseStream.Write(data, 0, data.Length); node.StandardInput.BaseStream.Flush(); } } catch (IOException) { } }
  void ClosePos() { if (closing) return; closing = true; label.Text = "Cerrando servicios y base de datos…"; status.Show(); Send("STOP"); }
  void Finish() {
    timer.Stop(); tray.Dispose(); stopSignal.Dispose(); openSignal.Dispose(); status.Close();
    if (restartPrinter) Process.Start(new ProcessStartInfo(Path.Combine(root, "AguachilesPOS.exe"), "/printer /wait") { UseShellExecute = true });
    ExitThread();
  }
}
