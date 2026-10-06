import { after } from 'next/server';
import { createHandler } from '../../../src/server/handler.js';
import { getService } from '../../../src/server/service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const handle = createHandler(getService, (task) =>
  after(async () => {
    await task();
  }),
);
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
