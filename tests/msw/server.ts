import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const server = setupServer(
	http.get('https://thirdparty.example/api', () =>
		HttpResponse.json({ ok: true }),
	),
);
