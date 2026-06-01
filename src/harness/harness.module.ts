import { Global, Module } from '@nestjs/common';
import { SolucionValidatorService } from './solucion-validator.service';
import { PresentationValidatorService } from './presentation-validator.service';

/**
 * Módulo global del Engineering Harness.
 *
 * Provee servicios de validación deterministas que se inyectan
 * en cualquier módulo que los necesite sin importar jerarquía.
 *
 * Servicios:
 * - SolucionValidatorService: Valida soluciones académicas (extensión, formato, tipografía)
 * - PresentationValidatorService: Valida planos de diapositivas (estructura, layouts)
 */
@Global()
@Module({
  providers: [SolucionValidatorService, PresentationValidatorService],
  exports: [SolucionValidatorService, PresentationValidatorService],
})
export class HarnessModule {}
