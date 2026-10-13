type Endpoint = { url: string; method: string };

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly data: Record<string, unknown>,
    ) {
        super(message);
    }
}

function csrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

async function send(endpoint: Endpoint, body?: unknown): Promise<Response> {
    const isForm = body instanceof FormData;

    let response: Response;

    try {
        response = await fetch(endpoint.url, {
            method: endpoint.method.toUpperCase(),
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': csrfToken(),
                ...(body !== undefined && !isForm
                    ? { 'Content-Type': 'application/json' }
                    : {}),
            },
            body:
                body === undefined
                    ? undefined
                    : isForm
                      ? body
                      : JSON.stringify(body),
        });
    } catch {
        throw new ApiError('Tidak dapat terhubung ke server.', 0, {});
    }

    if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as Record<
            string,
            unknown
        >;
        const fallback =
            response.status === 419
                ? 'Sesi berakhir. Muat ulang halaman.'
                : response.status === 429
                  ? 'Terlalu banyak permintaan. Coba lagi sebentar lagi.'
                  : `Permintaan gagal (${response.status}).`;

        throw new ApiError(
            typeof data.message === 'string' && response.status !== 500
                ? data.message
                : fallback,
            response.status,
            data,
        );
    }

    return response;
}

/**
 * Call one of the app's JSON endpoints (a Wayfinder route definition).
 */
export async function api<T = unknown>(
    endpoint: Endpoint,
    body?: unknown,
): Promise<T> {
    const response = await send(endpoint, body);

    return response.status === 204
        ? (undefined as T)
        : ((await response.json()) as T);
}

/**
 * Like `api`, for endpoints that answer with a file.
 */
export async function apiBlob(
    endpoint: Endpoint,
    body?: unknown,
): Promise<Blob> {
    return (await send(endpoint, body)).blob();
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Terjadi kesalahan.';
}
