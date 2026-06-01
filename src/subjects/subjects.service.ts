import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }              from '@nestjs/typeorm';
import { Repository }                    from 'typeorm';
import { Subject }    from './entities/subject.entity';
import { UserSubject } from './entities/user-subject.entity';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,

    @InjectRepository(UserSubject)
    private readonly userSubjectRepo: Repository<UserSubject>,
  ) {}

  // ── Consultas ────────────────────────────────────────────────────

  /** Devuelve las asignaturas del alumno (join user_subjects → subjects). */
  async findAllByUser(userId: string): Promise<Subject[]> {
    const rows = await this.userSubjectRepo.find({
      where:     { userId },
      relations: ['subject'],
      order:     { subject: { name: 'ASC' } },
    });
    return rows.map((r) => r.subject);
  }

  // ── Mutaciones ───────────────────────────────────────────────────

  /**
   * Busca o crea la asignatura en el catálogo global y la asigna al alumno.
   * - Si ya existe globalmente: la reutiliza (sin duplicar).
   * - Si no: la inserta en subjects.
   * - Si el alumno ya la tiene asignada: no hace nada.
   */
  async findOrCreate(userId: string, name: string): Promise<Subject> {
    const normalized = name.trim().toLowerCase();

    // 1. Buscar en catálogo global
    let subject = await this.subjectRepo.findOne({
      where: { normalizedName: normalized },
    });

    // 2. Crear globalmente si no existe
    if (!subject) {
      subject = this.subjectRepo.create({
        name:           name.trim(),
        normalizedName: normalized,
      });
      subject = await this.subjectRepo.save(subject);
    }

    // 3. Asignar al alumno (upsert: el UNIQUE constraint evita duplicados)
    const alreadyAssigned = await this.userSubjectRepo.findOne({
      where: { userId, subjectId: subject.id },
    });

    if (!alreadyAssigned) {
      await this.userSubjectRepo.save(
        this.userSubjectRepo.create({ userId, subjectId: subject.id }),
      );
    }

    return subject;
  }

  /** Crea (o reutiliza) una asignatura y la asigna al alumno. Alias de findOrCreate. */
  create(userId: string, name: string): Promise<Subject> {
    return this.findOrCreate(userId, name);
  }

  /**
   * Desvincula la asignatura del alumno (elimina la fila de user_subjects).
   * NO borra la asignatura del catálogo global.
   */
  async remove(userId: string, subjectId: string): Promise<void> {
    const row = await this.userSubjectRepo.findOne({
      where: { userId, subjectId },
    });
    if (!row) throw new NotFoundException('Asignatura no encontrada en tu perfil.');
    await this.userSubjectRepo.remove(row);
  }
}
