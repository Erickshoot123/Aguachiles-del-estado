using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal sealed class PosWindow : Form {
  readonly WebView2 view = new WebView2();
  readonly Uri address;
  readonly string root;
  readonly Label loading = new Label { Dock = DockStyle.Fill, Text = "Abriendo Aguachiles POS…", TextAlign = ContentAlignment.MiddleCenter };
  internal PosWindow(string url, string dataRoot) {
    address = new Uri(url); root = dataRoot;
    if (!address.IsLoopback || address.Scheme != "http") throw new ArgumentException("La interfaz debe estar en esta computadora.");
    Icon = PosCommon.BrandIcon;
    Text = "Aguachiles POS"; StartPosition = FormStartPosition.CenterScreen;
    MinimumSize = new Size(900, 600); Width = 1280; Height = 800; WindowState = FormWindowState.Maximized;
    view.Dock = DockStyle.Fill; Controls.Add(view); Controls.Add(loading); loading.BringToFront();
    Shown += async (sender, args) => {
      try {
        var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(root, "data", "webview2"));
        if (IsDisposed) return;
        await view.EnsureCoreWebView2Async(environment);
        if (IsDisposed) return;
        var settings = view.CoreWebView2.Settings;
        settings.IsStatusBarEnabled = false; settings.AreDefaultContextMenusEnabled = false;
        settings.AreDevToolsEnabled = false; settings.AreBrowserAcceleratorKeysEnabled = false;
        settings.IsPasswordAutosaveEnabled = false; settings.IsGeneralAutofillEnabled = false;
        view.CoreWebView2.NavigationStarting += (s, e) => {
          Uri destination;
          if (e.Uri.StartsWith("blob:" + address.GetLeftPart(UriPartial.Authority) + "/", StringComparison.Ordinal)) return;
          if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out destination) || destination.GetLeftPart(UriPartial.Authority) != address.GetLeftPart(UriPartial.Authority)) e.Cancel = true;
        };
        view.CoreWebView2.NewWindowRequested += (s, e) => { e.Handled = true; OpenWhatsApp(e.Uri); };
        view.CoreWebView2.NavigationCompleted += (s, e) => {
          if (e.IsSuccess) loading.Visible = false;
          else if (e.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled) {
            loading.Visible = true;
            loading.Text = "No se pudo cargar el POS. Cierra la aplicación y vuelve a abrirla.";
          }
        };
        view.CoreWebView2.Navigate(address.AbsoluteUri);
      } catch (Exception error) {
        if (IsDisposed) return;
        Directory.CreateDirectory(Path.Combine(root, "data", "logs"));
        File.AppendAllText(Path.Combine(root, "data", "logs", "window.log"), error.GetType().Name + ": " + error.Message + Environment.NewLine);
        loading.Text = "No se pudo abrir la ventana del POS. Ejecuta otra vez el instalador para reparar WebView2. Tus datos se conservan.";
      }
    };
  }
  static void OpenWhatsApp(string value) {
    Uri target;
    if (!Uri.TryCreate(value, UriKind.Absolute, out target) || target.Scheme != "https" || (target.Host != "wa.me" && target.Host != "web.whatsapp.com" && target.Host != "api.whatsapp.com")) return;
    try { Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true }); }
    catch (Exception) { MessageBox.Show("No se pudo abrir WhatsApp. Revisa la aplicación predeterminada de Windows.", "Aguachiles POS"); }
  }
}
