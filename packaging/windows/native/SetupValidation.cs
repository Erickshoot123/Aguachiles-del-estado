using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

internal static class PosSetupValidation {
  internal static Dictionary<string, string> Validate(string location, string user, string password, string confirmation) {
    var errors = new Dictionary<string, string>();
    if (String.IsNullOrWhiteSpace(location)) errors["location"] = "Falta el nombre de la sucursal.";
    if (String.IsNullOrWhiteSpace(user)) errors["user"] = "Falta el usuario administrador.";
    else if (!Regex.IsMatch(user.Trim(), "^[a-zA-Z0-9._-]{3,40}$"))
      errors["user"] = "Usa de 3 a 40 caracteres: letras sin acentos, números, punto, guion o guion bajo. No uses espacios.";
    if (String.IsNullOrWhiteSpace(password)) errors["password"] = "Falta la contraseña del administrador.";
    else if (password.Length < 6) errors["password"] = "La contraseña necesita al menos 6 caracteres. Faltan " + (6 - password.Length) + ".";
    if (String.IsNullOrEmpty(confirmation)) errors["confirm"] = "Falta repetir la contraseña.";
    else if (password != confirmation) errors["confirm"] = "Las contraseñas no coinciden. Escríbelas exactamente iguales.";
    return errors;
  }
}
