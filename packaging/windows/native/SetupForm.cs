using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Printing;
using System.Windows.Forms;

internal sealed class PosSetupForm : Form {
  readonly TextBox location = new TextBox(), user = new TextBox(), password = new TextBox(), confirm = new TextBox();
  readonly ComboBox printer = new ComboBox(), zone = new ComboBox();
  readonly Dictionary<string, object> config;
  readonly Dictionary<string, Control> fields = new Dictionary<string, Control>();
  readonly Dictionary<string, Label> messages = new Dictionary<string, Label>();
  readonly Label summary = new Label();
  readonly bool initial;
  bool validationShown;
  internal PosSetupForm(Dictionary<string, object> current, bool first) {
    config = current; initial = first;
    Text = first ? "Aguachiles POS · Primera instalación" : "Aguachiles POS · Impresora";
    ClientSize = new Size(590, first ? Math.Min(710, Screen.PrimaryScreen.WorkingArea.Height - 90) : 300);
    StartPosition = FormStartPosition.CenterScreen; FormBorderStyle = FormBorderStyle.FixedDialog;
    KeyPreview = true; KeyDown += (sender, e) => { if (e.KeyCode == Keys.Escape) { e.SuppressKeyPress = true; DialogResult = DialogResult.Cancel; Close(); } };
    MaximizeBox = false; MinimizeBox = false; Font = new Font("Segoe UI", 10);
    var panel = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(24), ColumnCount = 1, AutoScroll = true };
    panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); Controls.Add(panel);
    Add(panel, new Label { Text = first ? "Configura tu sucursal y crea la cuenta del administrador. Todos sus campos son obligatorios." : "Selecciona la impresora instalada en Windows. Las comandas serán de 58 mm.", AutoSize = true, MaximumSize = new Size(520, 60) });
    summary.AutoSize = true; summary.ForeColor = Color.FromArgb(160, 30, 30); summary.MaximumSize = new Size(520, 60);
    summary.Visible = false; summary.Margin = new Padding(0, 10, 0, 0); Add(panel, summary);
    location.Text = Convert.ToString(config["locationName"]); user.Text = Convert.ToString(config["adminUsername"]);
    password.UseSystemPasswordChar = true; confirm.UseSystemPasswordChar = true;
    if (first) {
      AddField(panel, "Nombre de la sucursal", location, "location");
      AddField(panel, "Usuario administrador", user, "user");
      Add(panel, new Label { Text = "3–40 caracteres. Ejemplo: admin, erick_01 o sucursal.centro", AutoSize = true, Font = new Font("Segoe UI", 9), ForeColor = Color.DimGray });
      AddField(panel, "Contraseña (mínimo 12 caracteres)", password, "password");
      AddField(panel, "Repite la contraseña", confirm, "confirm");
      var show = new CheckBox { Text = "Mostrar contraseñas", AutoSize = true, Margin = new Padding(0, 8, 0, 0) };
      show.CheckedChanged += (s, e) => { password.UseSystemPasswordChar = confirm.UseSystemPasswordChar = !show.Checked; };
      Add(panel, show);
      foreach (Control field in fields.Values) field.TextChanged += (s, e) => { if (validationShown) ValidateFields(false); };
    }
    printer.DropDownStyle = ComboBoxStyle.DropDownList;
    printer.Items.Add("Guardar en archivo de prueba (sin impresora)");
    foreach (string name in PrinterSettings.InstalledPrinters) printer.Items.Add(name);
    printer.SelectedIndex = 0;
    string selected = Convert.ToString(config["printerName"]);
    for (int i = 1; i < printer.Items.Count; i++) if (Convert.ToString(printer.Items[i]) == selected) printer.SelectedIndex = i;
    AddField(panel, "Impresora", printer, null);
    zone.DropDownStyle = ComboBoxStyle.DropDownList;
    zone.Items.AddRange(new object[] { "America/Mazatlan", "America/Chihuahua", "America/Mexico_City", "America/Tijuana" });
    zone.SelectedItem = Convert.ToString(config["timeZone"]); if (zone.SelectedIndex < 0) zone.SelectedIndex = 0;
    if (first) AddField(panel, "Zona horaria para los platos diarios", zone, null);
    var save = new Button { Text = first ? "Preparar y abrir POS" : "Guardar y reiniciar POS", AutoSize = true, Height = 40,
      BackColor = Color.FromArgb(234, 88, 12), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Margin = new Padding(0, 16, 0, 4) };
    Add(panel, save); AcceptButton = save;
    save.Click += (sender, e) => {
      if (first && !ValidateFields(true)) return;
      config["printerName"] = printer.SelectedIndex == 0 ? "" : Convert.ToString(printer.SelectedItem);
      if (first) { config["locationName"] = location.Text.Trim(); config["adminUsername"] = user.Text.Trim(); config["adminPassword"] = password.Text; config["timeZone"] = Convert.ToString(zone.SelectedItem); }
      DialogResult = DialogResult.OK; Close();
    };
  }
  bool ValidateFields(bool focus) {
    validationShown = true;
    var errors = PosSetupValidation.Validate(location.Text, user.Text, password.Text, confirm.Text);
    foreach (var item in messages) {
      string error; bool invalid = errors.TryGetValue(item.Key, out error);
      item.Value.Text = invalid ? error : ""; item.Value.Visible = invalid;
      fields[item.Key].BackColor = invalid ? Color.FromArgb(255, 240, 240) : SystemColors.Window;
    }
    summary.Visible = errors.Count > 0;
    summary.Text = errors.Count == 1 ? "Revisa el campo marcado en rojo." : "Revisa los " + errors.Count + " campos marcados en rojo.";
    if (focus) foreach (string key in new[] { "location", "user", "password", "confirm" }) {
      if (!errors.ContainsKey(key)) continue;
      fields[key].Focus(); var textbox = fields[key] as TextBox; if (textbox != null) textbox.SelectAll(); break;
    }
    return errors.Count == 0;
  }
  static void Add(TableLayoutPanel panel, Control control) {
    int row = panel.RowCount++; panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
    panel.Controls.Add(control, 0, row);
  }
  void AddField(TableLayoutPanel panel, string text, Control field, string key) {
    Add(panel, new Label { Text = text, AutoSize = true, Margin = new Padding(0, 10, 0, 3) });
    field.Dock = DockStyle.Top; field.AccessibleName = text; Add(panel, field);
    if (key == null) return;
    fields[key] = field;
    var error = new Label { AutoSize = true, MaximumSize = new Size(510, 70), ForeColor = Color.FromArgb(160, 30, 30),
      Font = new Font("Segoe UI", 9), Visible = false, Margin = new Padding(0, 2, 0, 0) };
    messages[key] = error; Add(panel, error);
  }
}
