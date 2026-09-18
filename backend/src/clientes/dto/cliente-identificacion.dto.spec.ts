import { validate } from 'class-validator';

import { CreateClienteDto } from './create-cliente.dto';
import { UpdateClienteDto } from './update-cliente.dto';

describe('validacion de identificacion de cliente', () => {
  it.each([CreateClienteDto, UpdateClienteDto])(
    'acepta 10 digitos numericos en %p',
    async (DtoClass) => {
      const dto = createDto(DtoClass, '1726494899');

      const errors = await validate(dto);

      expect(errors).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'identificacion' }),
        ]),
      );
    },
  );

  it.each([
    '172649489',
    '17264948991',
    '17264A4899',
    '17264-4899',
    'abcdefghij',
  ])('rechaza la identificacion invalida %s', async (identificacion) => {
    const createErrors = await validate(
      createDto(CreateClienteDto, identificacion),
    );
    const updateErrors = await validate(
      createDto(UpdateClienteDto, identificacion),
    );

    expect(hasIdentificacionError(createErrors)).toBe(true);
    expect(hasIdentificacionError(updateErrors)).toBe(true);
  });
});

function createDto<T extends CreateClienteDto | UpdateClienteDto>(
  DtoClass: new () => T,
  identificacion: string,
): T {
  return Object.assign(new DtoClass(), {
    nombres: 'Cliente',
    apellidos: 'Prueba',
    identificacion,
    email: 'cliente@example.com',
    telefono: '+593987545679',
    direccion: null,
    estado: true,
  });
}

function hasIdentificacionError(
  errors: Awaited<ReturnType<typeof validate>>,
): boolean {
  return errors.some((error) => error.property === 'identificacion');
}
