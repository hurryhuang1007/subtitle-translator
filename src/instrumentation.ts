export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { bootstrapServer } = await import('@/server/bootstrap');
  await bootstrapServer();
}
