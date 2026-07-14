/** API 根地址，开发时可在 .env.local 中配置 NEXT_PUBLIC_API_ROOT */
export function getApiRootUrl() {
  return process.env.NEXT_PUBLIC_API_ROOT || '';
}
