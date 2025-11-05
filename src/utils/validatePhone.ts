export function validatePhone(phone: string): boolean {
  // предполагаем формат +7XXXXXXXXXX
  const re = /^\+7\d{10}$/;
  return re.test(phone);
}
