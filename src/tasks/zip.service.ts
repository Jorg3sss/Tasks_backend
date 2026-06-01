import { Injectable, Logger } from '@nestjs/common';
import { join }         from 'path';
import { mkdir, writeFile } from 'fs/promises';

/** Mapeo lenguaje → extensión de archivo */
const LANG_EXT: Record<string, string> = {
  javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
  python: 'py', py: 'py', java: 'java', cpp: 'cpp', c: 'c',
  csharp: 'cs', cs: 'cs', php: 'php', ruby: 'rb', rb: 'rb',
  go: 'go', rust: 'rs', sql: 'sql', html: 'html', css: 'css',
  bash: 'sh', shell: 'sh', sh: 'sh', xml: 'xml', json: 'json',
  yaml: 'yaml', yml: 'yml', kotlin: 'kt', swift: 'swift',
  scala: 'scala', r: 'r', matlab: 'm',
};

interface CodeFile {
  filename: string;
  content:  string;
}

@Injectable()
export class ZipService {
  private readonly logger = new Logger(ZipService.name);

  /**
   * Extrae los bloques de código de un Markdown y genera un ZIP.
   * Formato de bloque soportado:
   *   ```lenguaje nombre_archivo.ext
   *   código
   *   ```
   * @returns ruta pública relativa del ZIP, o null si no hay código
   */
  async generateZipFromMarkdown(content: string, taskId: string): Promise<string | null> {
    const files = this.extractCodeFiles(content);
    if (files.length === 0) {
      this.logger.warn(`No se encontraron bloques de código para taskId=${taskId}`);
      return null;
    }

    return this.buildZip(files, taskId);
  }

  // ── Parsing de bloques de código ──────────────────────────────────

  private extractCodeFiles(content: string): CodeFile[] {
    const regex  = /```(\w+)(?:[ \t]+([^\n]+))?\n([\s\S]*?)```/g;
    const files: CodeFile[] = [];
    const used   = new Set<string>();
    let   counter = 1;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const lang     = (match[1] ?? 'txt').toLowerCase();
      const hint     = match[2]?.trim();
      const code     = match[3] ?? '';

      if (!code.trim()) continue;

      const ext = LANG_EXT[lang] ?? 'txt';

      let filename: string;
      if (hint && hint.includes('.')) {
        filename = hint;                          // nombre explícito con extensión
      } else if (hint) {
        filename = `${hint}.${ext}`;              // nombre sin extensión
      } else {
        filename = `archivo${counter}.${ext}`;    // nombre automático
      }

      // Evitar colisiones de nombre
      if (used.has(filename)) {
        const dot = filename.lastIndexOf('.');
        if (dot === -1) {
          filename = `${filename}_${counter}`;
        } else {
          filename = `${filename.slice(0, dot)}_${counter}${filename.slice(dot)}`;
        }
      }
      used.add(filename);
      counter++;

      files.push({ filename, content: code });
    }

    return files;
  }

  // ── Construcción del ZIP ──────────────────────────────────────────

  private async buildZip(files: CodeFile[], taskId: string): Promise<string> {
    const outputDir  = join(process.cwd(), 'public', 'uploads', 'zips');
    const filename   = `codigo-${taskId}.zip`;
    const outputPath = join(outputDir, filename);
    const publicPath = `/uploads/zips/${filename}`;

    await mkdir(outputDir, { recursive: true });

    // Crear ZIP manualmente (formato ZIP sin dependencias externas)
    const zipBuffer = await this.createZipBuffer(files, taskId);
    await writeFile(outputPath, zipBuffer);

    this.logger.log(`ZIP generado: ${publicPath} (${files.length} archivo(s))`);
    return publicPath;
  }

  /**
   * Genera un buffer ZIP válido usando la especificación ZIP de forma nativa.
   * Implementación mínima que funciona sin librerías externas.
   */
  private async createZipBuffer(files: CodeFile[], taskId: string): Promise<Buffer> {
    // Añadir README al ZIP
    const readme: CodeFile = {
      filename: 'README.md',
      content: [
        `# Solución de Código — TaskFlow`,
        ``,
        `Tarea ID: \`${taskId}\``,
        `Generado: ${new Date().toLocaleString('es-MX')}`,
        ``,
        `## Archivos incluidos`,
        ...files.map(f => `- \`${f.filename}\``),
        ``,
        `> Solución generada automáticamente por IA (Gemini via TaskFlow).`,
      ].join('\n'),
    };

    const allFiles = [...files, readme];

    // Usamos el módulo zlib de Node para comprimir cada archivo
    const { deflateRawSync } = await import('zlib');

    const localHeaders: Buffer[] = [];
    const centralDirectory: Buffer[] = [];
    let offset = 0;

    for (const file of allFiles) {
      const nameBuffer    = Buffer.from(file.filename, 'utf8');
      const contentBuffer = Buffer.from(file.content, 'utf8');
      const compressed    = deflateRawSync(contentBuffer, { level: 6 });

      const crc = this.crc32(contentBuffer);
      const dosTime = this.toDosTime(new Date());

      // Local file header
      const localHeader = Buffer.alloc(30 + nameBuffer.length);
      localHeader.writeUInt32LE(0x04034b50, 0); // signature
      localHeader.writeUInt16LE(20, 4);          // version needed
      localHeader.writeUInt16LE(2048, 6);        // flags (UTF-8)
      localHeader.writeUInt16LE(8, 8);           // compression: deflate
      localHeader.writeUInt32LE(dosTime, 10);    // mod time/date
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(compressed.length, 18);
      localHeader.writeUInt32LE(contentBuffer.length, 22);
      localHeader.writeUInt16LE(nameBuffer.length, 26);
      localHeader.writeUInt16LE(0, 28);
      nameBuffer.copy(localHeader, 30);

      localHeaders.push(Buffer.concat([localHeader, compressed]));

      // Central directory entry
      const centralEntry = Buffer.alloc(46 + nameBuffer.length);
      centralEntry.writeUInt32LE(0x02014b50, 0); // signature
      centralEntry.writeUInt16LE(20, 4);          // version made by
      centralEntry.writeUInt16LE(20, 6);          // version needed
      centralEntry.writeUInt16LE(2048, 8);        // flags
      centralEntry.writeUInt16LE(8, 10);          // compression
      centralEntry.writeUInt32LE(dosTime, 12);
      centralEntry.writeUInt32LE(crc, 16);
      centralEntry.writeUInt32LE(compressed.length, 20);
      centralEntry.writeUInt32LE(contentBuffer.length, 24);
      centralEntry.writeUInt16LE(nameBuffer.length, 28);
      centralEntry.writeUInt16LE(0, 30);          // extra
      centralEntry.writeUInt16LE(0, 32);          // comment
      centralEntry.writeUInt16LE(0, 34);          // disk start
      centralEntry.writeUInt16LE(0, 36);          // internal attrs
      centralEntry.writeUInt32LE(0, 38);          // external attrs
      centralEntry.writeUInt32LE(offset, 42);     // local header offset
      nameBuffer.copy(centralEntry, 46);

      centralDirectory.push(centralEntry);
      offset += localHeader.length + compressed.length;
    }

    const centralDirBuffer = Buffer.concat(centralDirectory);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);           // signature
    eocd.writeUInt16LE(0, 4);                    // disk number
    eocd.writeUInt16LE(0, 6);                    // start disk
    eocd.writeUInt16LE(allFiles.length, 8);
    eocd.writeUInt16LE(allFiles.length, 10);
    eocd.writeUInt32LE(centralDirBuffer.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);                   // comment length

    return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
  }

  private toDosTime(date: Date): number {
    const time = ((date.getHours() & 0x1f) << 11) |
                 ((date.getMinutes() & 0x3f) << 5) |
                 ((Math.floor(date.getSeconds() / 2)) & 0x1f);
    const day  = ((date.getFullYear() - 1980) << 25) |
                 (((date.getMonth() + 1) & 0xf) << 21) |
                 ((date.getDate() & 0x1f) << 16);
    return day | time;
  }

  private crc32(buf: Buffer): number {
    const table = ZipService.crc32Table;
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]!) & 0xff]!;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private static crc32Table: Uint32Array = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[i] = c;
    }
    return t;
  })();
}
