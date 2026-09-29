import { asyncHandler } from '@api/common/middleware/async-handler.js';
import type { EchoQuery } from '@api/modules/system/system.schemas.js';
import { echo } from '@api/modules/system/system.service.js';
import { toEchoDto } from '@api/modules/system/system.mapper.js';

export const echoController = asyncHandler((request, response) => {
  const query = request.validated['query'] as EchoQuery;
  response.json({ data: toEchoDto(echo(query.message)) });
});
