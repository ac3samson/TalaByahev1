export const ADMIN_USERNAME = 'admin@talabyahe.ph';

export function isAdminSession(value) {
  return value === ADMIN_USERNAME;
}
