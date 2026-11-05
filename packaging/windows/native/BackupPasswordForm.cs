using System;
using System.Drawing;
using System.Windows.Forms;
internal sealed class BackupPasswordForm : Form {
  internal string Password { get { return password.Text; } }
  readonly TextBox password = new TextBox { UseSystemPasswordChar = true, Dock = DockStyle.Top };
  internal BackupPasswordForm(bool confirm) {
    Icon = PosCommon.BrandIcon;
    Text = confirm ? "Proteger respaldo" : "Desbloquear respaldo"; ClientSize = new Size(440, 270);
    StartPosition = FormStartPosition.CenterScreen; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false; Font = new Font("Segoe UI", 10);
    var panel = new FlowLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(20), FlowDirection = FlowDirection.TopDown, WrapContents = false };
    Controls.Add(panel); panel.Controls.Add(new Label { Text = "Contraseña: mínimo 6 caracteres", AutoSize = true }); password.Width = 390; panel.Controls.Add(password);
    var repeat = new TextBox { Width = 390, UseSystemPasswordChar = true };
    if (confirm) { panel.Controls.Add(new Label { Text = "Repite la contraseña", AutoSize = true }); panel.Controls.Add(repeat); }
    var show = new CheckBox { Text = "Mostrar contraseña", AutoSize = true }; panel.Controls.Add(show);
    show.CheckedChanged += (s,e) => { password.UseSystemPasswordChar = repeat.UseSystemPasswordChar = !show.Checked; };
    var error = new Label { ForeColor = Color.Firebrick, Width = 390, Height = 40 }; panel.Controls.Add(error);
    var save = new Button { Text = "Continuar", AutoSize = true, BackColor = Color.FromArgb(234,88,12), ForeColor = Color.White }; panel.Controls.Add(save); AcceptButton = save;
    save.Click += (s,e) => { if (password.Text.Length < 6) { error.Text = "La contraseña necesita al menos 6 caracteres."; password.Focus(); return; } if (confirm && password.Text != repeat.Text) { error.Text = "Las contraseñas no coinciden."; repeat.Focus(); return; } DialogResult = DialogResult.OK; Close(); };
    KeyPreview = true; KeyDown += (s,e) => { if (e.KeyCode == Keys.Escape) { DialogResult = DialogResult.Cancel; Close(); } };
  }
}
