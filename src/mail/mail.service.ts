import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import axios                  from 'axios';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Envía un correo al usuario indicándole que la solución IA de su tarea está lista.
   * Usa la API HTTP de Resend (HTTPS, no SMTP) para evitar restricciones de puerto en el VPS.
   */
  async sendTaskReadyEmail(
    userEmail: string,
    taskTitle: string,
    pdfPublicUrl: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY no configurada — correo omitido.');
      return;
    }

    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from:    'TaskFlow <onboarding@resend.dev>',
          to:      [userEmail],
          subject: `✅ Tu solución para "${taskTitle}" ya está lista`,
          html:    this.buildHtml(taskTitle, pdfPublicUrl),
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15_000,
        },
      );
      this.logger.log(`Correo enviado a ${userEmail} para tarea "${taskTitle}"`);
    } catch (err: any) {
      const detail = err?.response?.data ?? err.message;
      this.logger.error(`Error al enviar correo a ${userEmail}: ${JSON.stringify(detail)}`);
    }
  }

  // ── Plantilla HTML inline ──────────────────────────────────────────
  private buildHtml(taskTitle: string, pdfUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Solución lista — TaskFlow</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:ui-sans-serif,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background:#f5f5f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;
          overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#2563eb;padding:28px 32px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                TaskFlow
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">
                Sistema de gestión escolar con IA
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;">
                ¡Tu solución está lista! 🎉
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                La inteligencia artificial ha generado la solución para tu tarea:
              </p>

              <!-- Tarea destacada -->
              <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;
                padding:16px 20px;margin-bottom:28px;">
                <p style="margin:0;font-size:12px;font-weight:600;color:#0369a1;
                  text-transform:uppercase;letter-spacing:.5px;">Tarea</p>
                <p style="margin:6px 0 0;font-size:17px;font-weight:600;color:#0c4a6e;">
                  ${taskTitle}
                </p>
              </div>

              <!-- Botón de descarga -->
              <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
                <tr>
                  <td align="center">
                    <a href="${pdfUrl}"
                      style="display:inline-block;background:#2563eb;color:#ffffff;
                        font-size:15px;font-weight:600;text-decoration:none;
                        border-radius:10px;padding:14px 36px;
                        box-shadow:0 4px 12px rgba(37,99,235,0.35);">
                      ⬇ Descargar solución en PDF
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
                <a href="${pdfUrl}" style="color:#2563eb;word-break:break-all;">${pdfUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;
              padding:18px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Este correo fue enviado automáticamente por TaskFlow.<br/>
                Si tienes dudas, contacta a tu institución.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
