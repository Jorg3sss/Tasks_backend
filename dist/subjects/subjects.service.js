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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubjectsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const subject_entity_1 = require("./entities/subject.entity");
const user_subject_entity_1 = require("./entities/user-subject.entity");
let SubjectsService = class SubjectsService {
    constructor(subjectRepo, userSubjectRepo) {
        this.subjectRepo = subjectRepo;
        this.userSubjectRepo = userSubjectRepo;
    }
    async findAllByUser(userId) {
        const rows = await this.userSubjectRepo.find({
            where: { userId },
            relations: ['subject'],
            order: { subject: { name: 'ASC' } },
        });
        return rows.map((r) => r.subject);
    }
    async findOrCreate(userId, name) {
        const normalized = name.trim().toLowerCase();
        let subject = await this.subjectRepo.findOne({
            where: { normalizedName: normalized },
        });
        if (!subject) {
            subject = this.subjectRepo.create({
                name: name.trim(),
                normalizedName: normalized,
            });
            subject = await this.subjectRepo.save(subject);
        }
        const alreadyAssigned = await this.userSubjectRepo.findOne({
            where: { userId, subjectId: subject.id },
        });
        if (!alreadyAssigned) {
            await this.userSubjectRepo.save(this.userSubjectRepo.create({ userId, subjectId: subject.id }));
        }
        return subject;
    }
    create(userId, name) {
        return this.findOrCreate(userId, name);
    }
    async remove(userId, subjectId) {
        const row = await this.userSubjectRepo.findOne({
            where: { userId, subjectId },
        });
        if (!row)
            throw new common_1.NotFoundException('Asignatura no encontrada en tu perfil.');
        await this.userSubjectRepo.remove(row);
    }
};
exports.SubjectsService = SubjectsService;
exports.SubjectsService = SubjectsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(subject_entity_1.Subject)),
    __param(1, (0, typeorm_1.InjectRepository)(user_subject_entity_1.UserSubject)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], SubjectsService);
//# sourceMappingURL=subjects.service.js.map