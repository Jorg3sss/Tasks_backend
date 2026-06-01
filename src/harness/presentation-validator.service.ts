import { Injectable, Logger } from '@nestjs/common';
import { PlanoDiapositivasDto, SlideDto } from './dto/n8n-solution-response.dto';

/** Resultado de la validación del plano de diapositivas. */
export interface ValidacionPresentacion {
  valida: boolean;
  errores: string[];
  totalSlides: number;
  layoutsDetectados: Record<string, number>;
}

@Injectable()
export class PresentationValidatorService {
  private readonly logger = new Logger(PresentationValidatorService.name);

  /**
   * Valida el plano de diapositivas.
   * Se activa ÚNICAMENTE si plano_diapositivas NO es nulo.
   * Actúa como puente de control hacia el motor de diapositivas en Puppeteer.
   */
  validar(plano: PlanoDiapositivasDto | null | undefined): ValidacionPresentacion {
    if (!plano) {
      return {
        valida: true,
        errores: [],
        totalSlides: 0,
        layoutsDetectados: {},
      };
    }

    const errores: string[] = [];

    // ── Validar estilo visual ─────────────────────────────────────
    if (!['minimal_light', 'minimal_dark'].includes(plano.estilo_visual)) {
      errores.push(`estilo_visual "${plano.estilo_visual}" no es valido.`);
    }

    // ── Validar slides ────────────────────────────────────────────
    if (!Array.isArray(plano.slides) || plano.slides.length === 0) {
      errores.push('El arreglo de slides esta vacio o no es valido.');
      return { valida: false, errores, totalSlides: 0, layoutsDetectados: {} };
    }

    const layoutsDetectados: Record<string, number> = {};

    for (const slide of plano.slides) {
      const slideErrors = this.validarSlide(slide);
      errores.push(...slideErrors);

      layoutsDetectados[slide.layout] = (layoutsDetectados[slide.layout] || 0) + 1;
    }

    // ── Validar numeración secuencial ─────────────────────────────
    const nums = plano.slides.map(s => s.num_slide);
    const numsEsperados = Array.from({ length: plano.slides.length }, (_, i) => i + 1);
    const numsOrdenados = [...nums].sort((a, b) => a - b);
    if (JSON.stringify(numsOrdenados) !== JSON.stringify(numsEsperados)) {
      errores.push(
        `Los num_slide no son secuenciales. Se esperaba: [${numsEsperados}], se encontro: [${numsOrdenados}].`,
      );
    }

    this.logger.debug(
      `Presentacion validada: ${plano.slides.length} slides, layouts: ${JSON.stringify(layoutsDetectados)}`,
    );

    return {
      valida: errores.length === 0,
      errores,
      totalSlides: plano.slides.length,
      layoutsDetectados,
    };
  }

  /**
   * Determina si el plano indica que se debe generar una presentación.
   * Retorna true si hay datos válidos para procesar.
   */
  requiereGeneracionPresentacion(
    plano: PlanoDiapositivasDto | null | undefined,
  ): boolean {
    return !!plano && Array.isArray(plano.slides) && plano.slides.length > 0;
  }

  // ── Validación individual de slide ─────────────────────────────

  private validarSlide(slide: SlideDto): string[] {
    const errores: string[] = [];
    const prefix = `Slide #${slide.num_slide}:`;

    if (!slide.titulo?.trim()) {
      errores.push(`${prefix} titulo esta vacio.`);
    }

    const layoutsValidos = ['titulo_centrado', 'dos_columnas', 'lista_bullets'];
    if (!layoutsValidos.includes(slide.layout)) {
      errores.push(`${prefix} layout "${slide.layout}" no es valido.`);
    }

    if (!Array.isArray(slide.contenido) || slide.contenido.length === 0) {
      errores.push(`${prefix} contenido debe ser un arreglo con al menos un elemento.`);
    }

    // Validar contenido según layout
    if (slide.layout === 'dos_columnas' && slide.contenido.length < 2) {
      errores.push(`${prefix} layout dos_columnas requiere al menos 2 elementos en contenido.`);
    }

    return errores;
  }
}
