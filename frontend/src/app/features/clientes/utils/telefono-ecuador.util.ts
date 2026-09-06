import { AbstractControl, ValidationErrors } from '@angular/forms';

export const ECUADOR_PHONE_ERROR_KEY = 'telefonoEcuador';

const ECUADOR_MOBILE_NUMBER_REGEX = /^9\d{8}$/;
const PHONE_FORMAT_CHARS_REGEX = /[\s\-().]/g;
const PHONE_ALLOWED_CHARS_REGEX = /^\+?\d+$/;

export function normalizeEcuadorianMobilePhone(value: string): string | null {
  const compactValue = value.trim().replace(PHONE_FORMAT_CHARS_REGEX, '');

  if (!compactValue || !PHONE_ALLOWED_CHARS_REGEX.test(compactValue)) {
    return null;
  }

  let nationalNumber: string;

  if (compactValue.startsWith('+593')) {
    nationalNumber = compactValue.slice(4);
  } else if (compactValue.startsWith('593')) {
    nationalNumber = compactValue.slice(3);
  } else if (compactValue.startsWith('09')) {
    nationalNumber = compactValue.slice(1);
  } else if (compactValue.startsWith('9')) {
    nationalNumber = compactValue;
  } else {
    return null;
  }

  if (!ECUADOR_MOBILE_NUMBER_REGEX.test(nationalNumber)) {
    return null;
  }

  return `+593${nationalNumber}`;
}

export function toEcuadorianNationalMobilePhone(value: string): string {
  const normalizedPhone = normalizeEcuadorianMobilePhone(value);

  return normalizedPhone ? normalizedPhone.replace('+593', '') : value;
}

export function ecuadorianMobilePhoneValidator(
  control: AbstractControl<string>,
): ValidationErrors | null {
  if (!control.value) {
    return null;
  }

  return normalizeEcuadorianMobilePhone(control.value)
    ? null
    : { [ECUADOR_PHONE_ERROR_KEY]: true };
}
