import {
  CategoriaMorosidad,
  clasificarCategoriaMorosidad,
  clasificarRiesgo,
  clasificarRiesgoPorCategoria,
  NivelRiesgo,
} from './nivel-riesgo';

describe('clasificarCategoriaMorosidad', () => {
  it.each([
    [0, CategoriaMorosidad.A1],
    [1, CategoriaMorosidad.A2],
    [15, CategoriaMorosidad.A2],
    [16, CategoriaMorosidad.A3],
    [30, CategoriaMorosidad.A3],
    [31, CategoriaMorosidad.B1],
    [45, CategoriaMorosidad.B1],
    [46, CategoriaMorosidad.B2],
    [60, CategoriaMorosidad.B2],
    [61, CategoriaMorosidad.C1],
    [75, CategoriaMorosidad.C1],
    [76, CategoriaMorosidad.C2],
    [90, CategoriaMorosidad.C2],
    [91, CategoriaMorosidad.D],
    [120, CategoriaMorosidad.D],
    [121, CategoriaMorosidad.E],
    [365, CategoriaMorosidad.E],
  ])('clasifica %i dias como %s', (diasAtraso, categoriaEsperada) => {
    expect(clasificarCategoriaMorosidad(diasAtraso)).toBe(categoriaEsperada);
  });

  it('clasifica valores negativos como A1 para mantener compatibilidad', () => {
    expect(clasificarCategoriaMorosidad(-1)).toBe(CategoriaMorosidad.A1);
  });
});

describe('clasificarRiesgoPorCategoria', () => {
  it.each([
    [CategoriaMorosidad.A1, NivelRiesgo.BAJO],
    [CategoriaMorosidad.A2, NivelRiesgo.MEDIO],
    [CategoriaMorosidad.A3, NivelRiesgo.MEDIO],
    [CategoriaMorosidad.B1, NivelRiesgo.ALTO],
    [CategoriaMorosidad.B2, NivelRiesgo.ALTO],
    [CategoriaMorosidad.C1, NivelRiesgo.ALTO],
    [CategoriaMorosidad.C2, NivelRiesgo.ALTO],
    [CategoriaMorosidad.D, NivelRiesgo.CRITICO],
    [CategoriaMorosidad.E, NivelRiesgo.CRITICO],
  ])('convierte %s en %s', (categoria, nivelEsperado) => {
    expect(clasificarRiesgoPorCategoria(categoria)).toBe(nivelEsperado);
  });
});

describe('clasificarRiesgo', () => {
  it('clasifica 0 dias de atraso como BAJO', () => {
    expect(clasificarRiesgo(0)).toBe(NivelRiesgo.BAJO);
  });

  it('clasifica valores negativos como BAJO', () => {
    expect(clasificarRiesgo(-1)).toBe(NivelRiesgo.BAJO);
  });

  it('clasifica 1 dia de atraso como MEDIO', () => {
    expect(clasificarRiesgo(1)).toBe(NivelRiesgo.MEDIO);
  });

  it('clasifica 15 dias de atraso como MEDIO', () => {
    expect(clasificarRiesgo(15)).toBe(NivelRiesgo.MEDIO);
  });

  it('clasifica 16 dias de atraso como MEDIO', () => {
    expect(clasificarRiesgo(16)).toBe(NivelRiesgo.MEDIO);
  });

  it('clasifica 30 dias de atraso como MEDIO', () => {
    expect(clasificarRiesgo(30)).toBe(NivelRiesgo.MEDIO);
  });

  it('clasifica 31 dias de atraso como ALTO', () => {
    expect(clasificarRiesgo(31)).toBe(NivelRiesgo.ALTO);
  });

  it('clasifica 45 dias de atraso como ALTO', () => {
    expect(clasificarRiesgo(45)).toBe(NivelRiesgo.ALTO);
  });

  it('clasifica 46 dias de atraso como ALTO', () => {
    expect(clasificarRiesgo(46)).toBe(NivelRiesgo.ALTO);
  });

  it('clasifica 60 dias de atraso como ALTO', () => {
    expect(clasificarRiesgo(60)).toBe(NivelRiesgo.ALTO);
  });

  it('clasifica 61 dias de atraso como ALTO', () => {
    expect(clasificarRiesgo(61)).toBe(NivelRiesgo.ALTO);
  });

  it('clasifica 75 dias de atraso como ALTO', () => {
    expect(clasificarRiesgo(75)).toBe(NivelRiesgo.ALTO);
  });

  it('clasifica 76 dias de atraso como ALTO', () => {
    expect(clasificarRiesgo(76)).toBe(NivelRiesgo.ALTO);
  });

  it('clasifica 90 dias de atraso como ALTO', () => {
    expect(clasificarRiesgo(90)).toBe(NivelRiesgo.ALTO);
  });

  it('clasifica 91 dias de atraso como CRITICO', () => {
    expect(clasificarRiesgo(91)).toBe(NivelRiesgo.CRITICO);
  });

  it('clasifica 120 dias de atraso como CRITICO', () => {
    expect(clasificarRiesgo(120)).toBe(NivelRiesgo.CRITICO);
  });

  it('clasifica 121 dias de atraso como CRITICO', () => {
    expect(clasificarRiesgo(121)).toBe(NivelRiesgo.CRITICO);
  });

  it('clasifica 365 dias de atraso como CRITICO', () => {
    expect(clasificarRiesgo(365)).toBe(NivelRiesgo.CRITICO);
  });
});
