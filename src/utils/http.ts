/** Bound API requests so a lost connection cannot leave a form busy forever. */
export async function fetchApi(input: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(30_000) });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new Error('Сервер отвечает слишком долго. Попробуйте ещё раз — введённые данные сохранены.');
    throw new Error('Не удалось связаться с сервером. Проверьте подключение к интернету.');
  }
}
