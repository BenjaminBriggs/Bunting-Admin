import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const server = setupServer(
  http.get('https://thirdparty.example/api', () =>
    HttpResponse.json({ ok: true })
  )
);
