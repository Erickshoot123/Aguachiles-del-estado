using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Printing;
using System.IO;
using System.Windows.Forms;

internal sealed class PosSetupForm : Form {
  readonly TextBox location = new TextBox(), user = new TextBox(), password = new TextBox(), confirm = new TextBox();
  readonly ComboBox printer = new ComboBox(), zone = new ComboBox();
  readonly Dictionary<string, object> config;
  readonly bool initial;
  internal PosSetupForm(Dictionary<string, object> current, bool first) {
    config = current; initial = first;
    Text = first ? "Aguachiles POS · Primera instalación" : "Aguachiles POS · Impresora";
    Width = 580; Height = first ? 560 : 320;
    StartPosition = FormStartPosition.CenterScreen; FormBorderStyle = FormBorderStyle.FixedDialog;
    MaximizeBox = false; MinimizeBox = false; Font = new Font("Segoe UI", 10);
    var panel = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(20), ColumnCount = 1, AutoScroll = true };
    Controls.Add(panel);
    panel.Controls.Add(new Label { Text = first ? "Configura esta sucursal. Se creará una base local nueva con el menú y sin ventas de prueba." : "Selecciona la impresora instalada en Windows. Los tickets serán de 58 mm.", AutoSize = true, MaximumSize = new Size(510, 60) });
    location.Text = Convert.ToString(config["locationName"]); user.Text = Convert.ToString(config["adminUsername"]);
    password.UseSystemPasswordChar = true; confirm.UseSystemPasswordChar = true;
    if (first) { AddField(panel, "Nombre de la sucursal", location); AddField(panel, "Usuario administrador", user);
      AddField(panel, "Contraseña (mínimo 12 caracteres)", password); AddField(panel, "Repite la contraseña", confirm); }
    printer.DropDownStyle = ComboBoxStyle.DropDownList;
    printer.Items.Add("Guardar en archivo de prueba (sin impresora)");
    foreach (string name in PrinterSettings.InstalledPrinters) printer.Items.Add(name);
    printer.SelectedIndex = 0;
    string selected = Convert.ToString(config["printerName"]);
    for (int i = 1; i < printer.Items.Count; i++) if (Convert.ToString(printer.Items[i]) == selected) printer.SelectedIndex = i;
    AddField(panel, "Impresora", printer);
    zone.DropDownStyle = ComboBoxStyle.DropDownList;
    zone.Items.AddRange(new object[] { "America/Mazatlan", "America/Chihuahua", "America/Mexico_City", "America/Tijuana" });
    zone.SelectedItem = Convert.ToString(config["timeZone"]); if (zone.SelectedIndex < 0) zone.SelectedIndex = 0;
    if (first) AddField(panel, "Zona horaria para los platos diarios", zone);
    var save = new Button { Text = first ? "Preparar y abrir POS" : "Guardar y reiniciar POS", AutoSize = true, Height = 38, Margin = new Padding(0, 15, 0, 0) };
    panel.Controls.Add(save); AcceptButton = save;
    save.Click += (sender, e) => {
      if (first && (String.IsNullOrWhiteSpace(location.Text) || !System.Text.RegularExpressions.Regex.IsMatch(user.Text, "^[a-zA-Z0-9._-]{3,40}$") || password.Text.Length < 12 || password.Text != confirm.Text)) {
        MessageBox.Show("Ingresa la sucursal, un usuario de 3–40 letras o números y contraseñas iguales de al menos 12 caracteres."); return;
      }
      config["printerName"] = printer.SelectedIndex == 0 ? "" : Convert.ToString(printer.SelectedItem);
      if (first) { config["locationName"] = location.Text.Trim(); config["adminUsername"] = user.Text; config["adminPassword"] = password.Text; config["timeZone"] = Convert.ToString(zone.SelectedItem); }
      DialogResult = DialogResult.OK; Close();
    };
  }
  static void AddField(TableLayoutPanel panel, string text, Control field) {
    panel.Controls.Add(new Label { Text = text, AutoSize = true, Margin = new Padding(0, 10, 0, 3) });
    field.Dock = DockStyle.Top; panel.Controls.Add(field);
  }
}
