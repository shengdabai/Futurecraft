/** Keep TLS verification enabled even when pg parses sslmode from the URL. */
export function databasePoolOptions(connectionString: string) {
  const url = new URL(connectionString);
  const mode = url.searchParams.get('sslmode');
  const tls = url.hostname.endsWith('.neon.tech') || url.hostname === 'neon.tech'
    || (mode !== null && mode !== 'disable') || url.searchParams.get('ssl') === 'true';
  url.searchParams.delete('sslmode');
  url.searchParams.delete('ssl');
  return {
    connectionString: url.toString(),
    ssl: tls ? { rejectUnauthorized: true } : false,
  };
}
