"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ZipService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZipService = void 0;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const promises_1 = require("fs/promises");
const LANG_EXT = {
    javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
    python: 'py', py: 'py', java: 'java', cpp: 'cpp', c: 'c',
    csharp: 'cs', cs: 'cs', php: 'php', ruby: 'rb', rb: 'rb',
    go: 'go', rust: 'rs', sql: 'sql', html: 'html', css: 'css',
    bash: 'sh', shell: 'sh', sh: 'sh', xml: 'xml', json: 'json',
    yaml: 'yaml', yml: 'yml', kotlin: 'kt', swift: 'swift',
    scala: 'scala', r: 'r', matlab: 'm',
};
let ZipService = ZipService_1 = class ZipService {
    constructor() {
        this.logger = new common_1.Logger(ZipService_1.name);
    }
    async generateZipFromMarkdown(content, taskId) {
        const files = this.extractCodeFiles(content);
        if (files.length === 0) {
            this.logger.warn(`No se encontraron bloques de código para taskId=${taskId}`);
            return null;
        }
        return this.buildZip(files, taskId);
    }
    extractCodeFiles(content) {
        const regex = /```(\w+)(?:[ \t]+([^\n]+))?\n([\s\S]*?)```/g;
        const files = [];
        const used = new Set();
        let counter = 1;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const lang = (match[1] ?? 'txt').toLowerCase();
            const hint = match[2]?.trim();
            const code = match[3] ?? '';
            if (!code.trim())
                continue;
            const ext = LANG_EXT[lang] ?? 'txt';
            let filename;
            if (hint && hint.includes('.')) {
                filename = hint;
            }
            else if (hint) {
                filename = `${hint}.${ext}`;
            }
            else {
                filename = `archivo${counter}.${ext}`;
            }
            if (used.has(filename)) {
                const dot = filename.lastIndexOf('.');
                if (dot === -1) {
                    filename = `${filename}_${counter}`;
                }
                else {
                    filename = `${filename.slice(0, dot)}_${counter}${filename.slice(dot)}`;
                }
            }
            used.add(filename);
            counter++;
            files.push({ filename, content: code });
        }
        return files;
    }
    async buildZip(files, taskId) {
        const outputDir = (0, path_1.join)(process.cwd(), 'public', 'uploads', 'zips');
        const filename = `codigo-${taskId}.zip`;
        const outputPath = (0, path_1.join)(outputDir, filename);
        const publicPath = `/uploads/zips/${filename}`;
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        const zipBuffer = await this.createZipBuffer(files, taskId);
        await (0, promises_1.writeFile)(outputPath, zipBuffer);
        this.logger.log(`ZIP generado: ${publicPath} (${files.length} archivo(s))`);
        return publicPath;
    }
    async createZipBuffer(files, taskId) {
        const readme = {
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
        const { deflateRawSync } = await Promise.resolve().then(() => require('zlib'));
        const localHeaders = [];
        const centralDirectory = [];
        let offset = 0;
        for (const file of allFiles) {
            const nameBuffer = Buffer.from(file.filename, 'utf8');
            const contentBuffer = Buffer.from(file.content, 'utf8');
            const compressed = deflateRawSync(contentBuffer, { level: 6 });
            const crc = this.crc32(contentBuffer);
            const dosTime = this.toDosTime(new Date());
            const localHeader = Buffer.alloc(30 + nameBuffer.length);
            localHeader.writeUInt32LE(0x04034b50, 0);
            localHeader.writeUInt16LE(20, 4);
            localHeader.writeUInt16LE(2048, 6);
            localHeader.writeUInt16LE(8, 8);
            localHeader.writeUInt32LE(dosTime, 10);
            localHeader.writeUInt32LE(crc, 14);
            localHeader.writeUInt32LE(compressed.length, 18);
            localHeader.writeUInt32LE(contentBuffer.length, 22);
            localHeader.writeUInt16LE(nameBuffer.length, 26);
            localHeader.writeUInt16LE(0, 28);
            nameBuffer.copy(localHeader, 30);
            localHeaders.push(Buffer.concat([localHeader, compressed]));
            const centralEntry = Buffer.alloc(46 + nameBuffer.length);
            centralEntry.writeUInt32LE(0x02014b50, 0);
            centralEntry.writeUInt16LE(20, 4);
            centralEntry.writeUInt16LE(20, 6);
            centralEntry.writeUInt16LE(2048, 8);
            centralEntry.writeUInt16LE(8, 10);
            centralEntry.writeUInt32LE(dosTime, 12);
            centralEntry.writeUInt32LE(crc, 16);
            centralEntry.writeUInt32LE(compressed.length, 20);
            centralEntry.writeUInt32LE(contentBuffer.length, 24);
            centralEntry.writeUInt16LE(nameBuffer.length, 28);
            centralEntry.writeUInt16LE(0, 30);
            centralEntry.writeUInt16LE(0, 32);
            centralEntry.writeUInt16LE(0, 34);
            centralEntry.writeUInt16LE(0, 36);
            centralEntry.writeUInt32LE(0, 38);
            centralEntry.writeUInt32LE(offset, 42);
            nameBuffer.copy(centralEntry, 46);
            centralDirectory.push(centralEntry);
            offset += localHeader.length + compressed.length;
        }
        const centralDirBuffer = Buffer.concat(centralDirectory);
        const eocd = Buffer.alloc(22);
        eocd.writeUInt32LE(0x06054b50, 0);
        eocd.writeUInt16LE(0, 4);
        eocd.writeUInt16LE(0, 6);
        eocd.writeUInt16LE(allFiles.length, 8);
        eocd.writeUInt16LE(allFiles.length, 10);
        eocd.writeUInt32LE(centralDirBuffer.length, 12);
        eocd.writeUInt32LE(offset, 16);
        eocd.writeUInt16LE(0, 20);
        return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
    }
    toDosTime(date) {
        const time = ((date.getHours() & 0x1f) << 11) |
            ((date.getMinutes() & 0x3f) << 5) |
            ((Math.floor(date.getSeconds() / 2)) & 0x1f);
        const day = ((date.getFullYear() - 1980) << 25) |
            (((date.getMonth() + 1) & 0xf) << 21) |
            ((date.getDate() & 0x1f) << 16);
        return day | time;
    }
    crc32(buf) {
        const table = ZipService_1.crc32Table;
        let crc = 0xffffffff;
        for (let i = 0; i < buf.length; i++) {
            crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
        }
        return (crc ^ 0xffffffff) >>> 0;
    }
};
exports.ZipService = ZipService;
ZipService.crc32Table = (() => {
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
exports.ZipService = ZipService = ZipService_1 = __decorate([
    (0, common_1.Injectable)()
], ZipService);
//# sourceMappingURL=zip.service.js.map