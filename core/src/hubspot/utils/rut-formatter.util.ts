/**
 * Utilidad para formatear RUT chileno
 * Convierte diferentes formatos de RUT a formato limpio (solo números)
 *
 * Ejemplos de entrada:
 * - "1.234567-8"
 * - "1-2345.67-8"
 * - "1234567-8"
 * - "12345678"
 *
 * Salida: "12345678" (solo números)
 */
export class RutFormatter {
  /**
   * Formatea un RUT eliminando puntos, guiones y espacios
   */
  static formatRut(rut: string | null | undefined): string {
    if (!rut || typeof rut !== 'string') {
      return '';
    }

    // Eliminar todos los caracteres que no sean números
    const rutFormateado = rut.replace(/[^0-9]/g, '');

    return rutFormateado;
  }

  /**
   * Valida si un RUT tiene formato válido (al menos 7 dígitos)
   */
  static isValidRut(rut: string | null | undefined): boolean {
    const rutFormateado = this.formatRut(rut);
    // RUT chileno debe tener al menos 7 dígitos y máximo 9
    return rutFormateado.length >= 7 && rutFormateado.length <= 9;
  }
}
