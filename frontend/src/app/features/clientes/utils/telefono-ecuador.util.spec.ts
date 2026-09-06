import {
  ecuadorianMobilePhoneValidator,
  normalizeEcuadorianMobilePhone,
} from './telefono-ecuador.util';

describe('telefono Ecuador utils', () => {
  it.each([
    ['0987545679', '+593987545679'],
    ['987545679', '+593987545679'],
    ['+593987545679', '+593987545679'],
    ['593987545679', '+593987545679'],
    ['+593 98 754 5679', '+593987545679'],
    ['098 754 5679', '+593987545679'],
  ])('normaliza %s como %s', (input, expected) => {
    expect(normalizeEcuadorianMobilePhone(input)).toBe(expected);
  });

  it.each(['abc123', '09875', '+593593987545679'])(
    'rechaza %s',
    (input) => {
      expect(normalizeEcuadorianMobilePhone(input)).toBeNull();
      expect(
        ecuadorianMobilePhoneValidator({
          value: input,
        } as never),
      ).toEqual({ telefonoEcuador: true });
    },
  );
});
