import type { Request } from 'express';
import { UnauthenticatedError } from '@api/common/errors/app-error.js';
import { asyncHandler } from '@api/common/middleware/async-handler.js';
import { toAddressDto, toUserDto } from '@api/modules/users/users.mapper.js';
import type {
  AddressInput,
  ChangePasswordInput,
  ProfileInput,
  UpdateAddressInput,
} from '@api/modules/users/users.schemas.js';
import {
  addAddress,
  changePassword,
  deleteAddress,
  listAddresses,
  updateAddress,
  updateProfile,
} from '@api/modules/users/users.service.js';

function userId(request: Request): string {
  if (!request.auth) throw new UnauthenticatedError();
  return request.auth.userId;
}

export function createUsersController() {
  return {
    updateProfile: asyncHandler(async (request, response) => {
      const user = await updateProfile(userId(request), request.validated['body'] as ProfileInput);
      response.json({ data: toUserDto(user) });
    }),
    changePassword: asyncHandler(async (request, response) => {
      await changePassword(userId(request), request.validated['body'] as ChangePasswordInput);
      response.status(204).end();
    }),
    listAddresses: asyncHandler(async (request, response) => {
      const addresses = await listAddresses(userId(request));
      response.json({ data: addresses.map(toAddressDto) });
    }),
    addAddress: asyncHandler(async (request, response) => {
      const address = await addAddress(userId(request), request.validated['body'] as AddressInput);
      response.status(201).json({ data: toAddressDto(address) });
    }),
    updateAddress: asyncHandler(async (request, response) => {
      const address = await updateAddress(
        userId(request),
        request.params['id'] ?? '',
        request.validated['body'] as UpdateAddressInput,
      );
      response.json({ data: toAddressDto(address) });
    }),
    deleteAddress: asyncHandler(async (request, response) => {
      await deleteAddress(userId(request), request.params['id'] ?? '');
      response.status(204).end();
    }),
  };
}
