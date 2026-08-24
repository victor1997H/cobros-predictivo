export enum NivelRiesgo {
  BAJO = 'BAJO',
  MEDIO = 'MEDIO',
  ALTO = 'ALTO',
  CRITICO = 'CRITICO',
}

export enum CategoriaMorosidad {
  A1 = 'A1',
  A2 = 'A2',
  A3 = 'A3',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
  D = 'D',
  E = 'E',
}

export type CategoriaReferencia = CategoriaMorosidad | 'PREVENTIVO';

export const DESCRIPCION_REGLAS_NIVEL_RIESGO =
  'Categorias de referencia alineadas a rangos de morosidad SEPS para el prototipo CobrosPredictivo.';

export function clasificarCategoriaMorosidad(
  diasAtraso: number,
): CategoriaMorosidad {
  if (diasAtraso <= 0) {
    return CategoriaMorosidad.A1;
  }

  if (diasAtraso <= 15) {
    return CategoriaMorosidad.A2;
  }

  if (diasAtraso <= 30) {
    return CategoriaMorosidad.A3;
  }

  if (diasAtraso <= 45) {
    return CategoriaMorosidad.B1;
  }

  if (diasAtraso <= 60) {
    return CategoriaMorosidad.B2;
  }

  if (diasAtraso <= 75) {
    return CategoriaMorosidad.C1;
  }

  if (diasAtraso <= 90) {
    return CategoriaMorosidad.C2;
  }

  if (diasAtraso <= 120) {
    return CategoriaMorosidad.D;
  }

  return CategoriaMorosidad.E;
}

export function clasificarRiesgoPorCategoria(
  categoria: CategoriaMorosidad,
): NivelRiesgo {
  if (categoria === CategoriaMorosidad.A1) {
    return NivelRiesgo.BAJO;
  }

  if (
    categoria === CategoriaMorosidad.A2 ||
    categoria === CategoriaMorosidad.A3
  ) {
    return NivelRiesgo.MEDIO;
  }

  if (
    categoria === CategoriaMorosidad.B1 ||
    categoria === CategoriaMorosidad.B2 ||
    categoria === CategoriaMorosidad.C1 ||
    categoria === CategoriaMorosidad.C2
  ) {
    return NivelRiesgo.ALTO;
  }

  return NivelRiesgo.CRITICO;
}

export function clasificarRiesgo(diasAtraso: number): NivelRiesgo {
  return clasificarRiesgoPorCategoria(clasificarCategoriaMorosidad(diasAtraso));
}
