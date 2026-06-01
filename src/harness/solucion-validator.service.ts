import { Injectable, Logger } from '@nestjs/common';
import { SolucionAcademicaDto, RequisitosFormatoDto } from './dto/n8n-solution-response.dto';

/** Resultado de la validación de una solución académica. */
export interface ValidacionSolucion {
  valida: boolean;
  errores: string[];
  estadisticas: {
    palabras: number;
    cuartillasEstimadas: number;
    parrafos: number;
    lineasCodigo: number;
  };
  estilosRenderizado: {
    fuente: string;
    tamanoFuente: number;
    interlineado: number;
  };
}

@Injectable()
export class SolucionValidatorService {
  private readonly logger = new Logger(SolucionValidatorService.name);

  /** Fuentes y tamaños por defecto si la IA no especifica requisitos. */
  private readonly DEFAULTS = {
    fuente: 'Arial',
    tamanoFuente: 12,
    interlineado: 1.5,
    palabrasPorCuartilla: 300,
    minPalabras: 100,
    maxPalabras: 15000,
  };

  /**
   * Valida que la solución cumpla con los requisitos de extensión y formato.
   * Inyecta dinámicamente las variables de tipografía para el renderizado.
   */
  validar(
    solucion: SolucionAcademicaDto,
    requisitos?: RequisitosFormatoDto | null,
  ): ValidacionSolucion {
    const errores: string[] = [];

    // ── Validaciones básicas ──────────────────────────────────────
    if (!solucion.titulo?.trim()) {
      errores.push('El titulo de la solucion esta vacio.');
    }

    if (!solucion.desarrollo_markdown?.trim()) {
      errores.push('El desarrollo_markdown esta vacio.');
    }

    // ── Estadísticas del contenido ────────────────────────────────
    const texto = solucion.desarrollo_markdown ?? '';
    const palabras = this.contarPalabras(texto);
    const cuartillasEstimadas = Math.ceil(palabras / this.DEFAULTS.palabrasPorCuartilla);
    const parrafos = texto.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    const lineasCodigo = this.contarLineasCodigo(texto);

    // ── Validación de extensión ───────────────────────────────────
    if (palabras < this.DEFAULTS.minPalabras) {
      errores.push(
        `La solucion tiene ${palabras} palabras. Minimo requerido: ${this.DEFAULTS.minPalabras}.`,
      );
    }

    if (palabras > this.DEFAULTS.maxPalabras) {
      errores.push(
        `La solucion tiene ${palabras} palabras. Maximo permitido: ${this.DEFAULTS.maxPalabras}.`,
      );
    }

    // ── Inyección dinámica de estilos ─────────────────────────────
    const estilosRenderizado = this.construirEstilos(requisitos);

    this.logger.debug(
      `Validacion: ${palabras} palabras, ~${cuartillasEstimadas} cuartillas, ${parrafos} parrafos, ${lineasCodigo} lineas codigo`,
    );

    return {
      valida: errores.length === 0,
      errores,
      estadisticas: { palabras, cuartillasEstimadas, parrafos, lineasCodigo },
      estilosRenderizado,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private contarPalabras(texto: string): number {
    return texto
      .replace(/```[\s\S]*?```/g, '')   // quitar bloques de código
      .replace(/[#*_`>\[\]()]/g, '')     // quitar sintaxis markdown
      .split(/\s+/)
      .filter(w => w.length > 0).length;
  }

  private contarLineasCodigo(texto: string): number {
    const codeBlocks: string[] = texto.match(/```[\s\S]*?```/g) ?? [];
    return codeBlocks.reduce((total: number, block: string) => {
      const inner = block.replace(/```\w*\n?/g, '').replace(/```$/g, '');
      return total + inner.split('\n').filter(l => l.trim().length > 0).length;
    }, 0);
  }

  private construirEstilos(requisitos?: RequisitosFormatoDto | null) {
    return {
      fuente: requisitos?.fuente ?? this.DEFAULTS.fuente,
      tamanoFuente: requisitos?.tamano_fuente ?? this.DEFAULTS.tamanoFuente,
      interlineado: this.DEFAULTS.interlineado,
    };
  }
}
