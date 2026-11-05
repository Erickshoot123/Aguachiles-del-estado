using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Text;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;

internal static class NativeUiProbe {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool SetDllDirectory(string path);
  static readonly BindingFlags Hidden = BindingFlags.Instance | BindingFlags.NonPublic;
  [STAThread] static int Main(string[] args) {
    Console.OutputEncoding = Encoding.UTF8; Console.InputEncoding = Encoding.UTF8;
    Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
    try {
      string root = Path.GetFullPath(args[0]); SetDllDirectory(root);
      var app = Assembly.LoadFrom(Path.Combine(root, "AguachilesPOS.exe"));
      app.GetType("PosCommon", true).GetMethod("Initialize", BindingFlags.Static | BindingFlags.NonPublic).Invoke(null, null);
      ValidateSetup(app);
      if (args.Length > 1) ValidateWindow(app, root, args[1]);
      Console.WriteLine("Validación nativa aprobada."); return 0;
    } catch (Exception error) { Console.Error.WriteLine(error.GetBaseException().Message); return 1; }
  }
  static void Check(bool valid, string message) { if (!valid) throw new Exception(message); }
  static void ValidateSetup(Assembly app) {
    var settings = new Dictionary<string, object> { { "locationName", "" }, { "adminUsername", "" }, { "printerName", "" }, { "timeZone", "America/Mazatlan" } };
    Type type = app.GetType("PosSetupForm", true);
    using (var form = (Form)Activator.CreateInstance(type, Hidden, null, new object[] { settings, true }, null)) {
      Func<string, TextBox> field = key => (TextBox)type.GetField(key, Hidden).GetValue(form);
      var messages = (Dictionary<string, Label>)type.GetField("messages", Hidden).GetValue(form);
      Func<bool> validate = () => (bool)type.GetMethod("ValidateFields", Hidden).Invoke(form, new object[] { false });
      Check(!validate(), "El formulario vacío no debe continuar");
      foreach (string key in new[] { "location", "user", "password", "confirm" }) Check(messages[key].Text.Length > 0, "Falta mensaje específico: " + key);
      field("location").Text = "Sucursal de prueba"; field("user").Text = "nombre con espacios";
      field("password").Text = "corta"; field("confirm").Text = "distinta";
      Check(messages["location"].Text == "", "El error debe desaparecer al corregir el campo");
      Check(messages["user"].Text.Contains("3 a 40"), "Falta explicación de caracteres del usuario");
      Check(messages["password"].Text.Contains("6"), "Falta longitud de contraseña");
      Check(messages["confirm"].Text.Contains("no coinciden"), "Falta aviso de contraseñas distintas");
      field("user").Text = "  erick_01  "; field("password").Text = "123456"; field("confirm").Text = "123456";
      Check(validate(), "Los datos válidos deben permitirse");
      foreach (Label label in messages.Values) Check(label.Text == "", "No deben quedar errores después de corregir");
      Check(field("password").UseSystemPasswordChar && field("confirm").UseSystemPasswordChar, "Las contraseñas deben comenzar ocultas");
      Console.WriteLine("Formulario: campos faltantes, usuario inválido, longitud, coincidencia y corrección en vivo aprobados.");
    }
  }
  static void ValidateWindow(Assembly app, string root, string url) {
    Type type = app.GetType("PosWindow", true);
    using (var form = (Form)Activator.CreateInstance(type, Hidden, null, new object[] { url, root }, null)) {
      form.Opacity = 0; form.ShowInTaskbar = false; form.WindowState = FormWindowState.Normal;
      var view = (WebView2)type.GetField("view", Hidden).GetValue(form);
      var testAddress = new Uri(url);
      view.CoreWebView2InitializationCompleted += (sender, args) => {
        if (!args.IsSuccess) return;
        view.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
        view.CoreWebView2.WebResourceRequested += (s, e) => {
          Uri request;
          if (Uri.TryCreate(e.Request.Uri, UriKind.Absolute, out request) && request.IsLoopback
            && request.Port >= testAddress.Port && request.Port <= testAddress.Port + 2) return;
          e.Response = view.CoreWebView2.Environment.CreateWebResourceResponse(new MemoryStream(new byte[0]), 403, "Blocked by isolated test", "");
        };
      };
      Exception failure = null;
      form.Shown += async (sender, args) => {
        try {
          var deadline = DateTime.UtcNow.AddSeconds(40); bool loaded = false;
          while (DateTime.UtcNow < deadline) {
            if (view.CoreWebView2 != null && await view.CoreWebView2.ExecuteScriptAsync("document.querySelector('input[type=password]') !== null") == "true") { loaded = true; break; }
            await Task.Delay(200);
          }
          Check(loaded, "La ventana integrada no cargó el login");
          Check(form.Text == "Aguachiles POS", "El título no debe mostrar la URL");
          Check(!view.CoreWebView2.Settings.IsStatusBarEnabled && !view.CoreWebView2.Settings.AreDevToolsEnabled, "No deben aparecer direcciones ni herramientas del navegador");
          foreach (Control control in form.Controls) Check(!(control is TextBox) && !(control is ToolStrip), "No debe existir barra de direcciones");
          Console.WriteLine("Ventana WebView2: login real cargado, sin barra de direcciones ni barra de estado.");
        } catch (Exception error) { failure = error; }
        finally { form.Close(); }
      };
      Application.Run(form);
      if (failure != null) throw failure;
    }
  }
}
