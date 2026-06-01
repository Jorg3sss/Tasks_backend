"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
let MailService = MailService_1 = class MailService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(MailService_1.name);
    }
    async sendTaskReadyEmail(userEmail, taskTitle, pdfPublicUrl) {
        const apiKey = this.configService.get('RESEND_API_KEY');
        if (!apiKey) {
            this.logger.warn('RESEND_API_KEY no configurada — correo omitido.');
            return;
        }
        try {
            await axios_1.default.post('https://api.resend.com/emails', {
                from: 'TaskFlow <onboarding@resend.dev>',
                to: [userEmail],
                subject: `✅ Tu solución para "${taskTitle}" ya está lista`,
                html: this.buildHtml(taskTitle, pdfPublicUrl),
            }, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 15_000,
            });
            this.logger.log(`Correo enviado a ${userEmail} para tarea "${taskTitle}"`);
        }
        catch (err) {
            const detail = err?.response?.data ?? err.message;
            this.logger.error(`Error al enviar correo a ${userEmail}: ${JSON.stringify(detail)}`);
        }
    }
    buildHtml(taskTitle, pdfUrl) {
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
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map