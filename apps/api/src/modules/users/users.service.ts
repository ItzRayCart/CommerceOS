import argon2 from 'argon2';
import { Types } from 'mongoose';
import {
  BadRequestError,
  NotFoundError,
  UnauthenticatedError,
} from '@api/common/errors/app-error.js';
import { RefreshTokenModel } from '@api/modules/auth/auth.model.js';
import { UserModel } from '@api/modules/users/users.model.js';
import type {
  AddressInput,
  ChangePasswordInput,
  ProfileInput,
  UpdateAddressInput,
} from '@api/modules/users/users.schemas.js';

export async function updateProfile(userId: string, input: ProfileInput) {
  const updates = {
    ...(input.firstName === undefined ? {} : { firstName: input.firstName }),
    ...(input.lastName === undefined ? {} : { lastName: input.lastName }),
    ...(input.phone === undefined ? {} : { phone: input.phone }),
  };
  const user = await UserModel.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true },
  );
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user || !(await argon2.verify(user.passwordHash, input.currentPassword))) {
    throw new UnauthenticatedError('Current password is incorrect');
  }
  user.passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
  await user.save();
  await RefreshTokenModel.updateMany(
    { user: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}

export async function listAddresses(userId: string) {
  const user = await UserModel.findById(userId).lean();
  if (!user) throw new NotFoundError('User not found');
  return user.addresses;
}

export async function addAddress(userId: string, input: AddressInput) {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  if (user.addresses.length >= 10) throw new BadRequestError('Maximum 10 addresses');
  const isDefault = user.addresses.length === 0 || input.isDefault === true;
  if (isDefault)
    user.addresses.forEach((address) => {
      address.isDefault = false;
    });
  const { line2 } = input;
  const address = {
    label: input.label,
    fullName: input.fullName,
    line1: input.line1,
    city: input.city,
    region: input.region,
    postalCode: input.postalCode,
    country: input.country,
    phone: input.phone,
    ...(line2 === undefined ? {} : { line2 }),
    _id: new Types.ObjectId(),
    isDefault,
  };
  user.addresses.push(address);
  await user.save();
  return address;
}

export async function updateAddress(userId: string, addressId: string, input: UpdateAddressInput) {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  const address = user.addresses.find((item) => item._id.toString() === addressId);
  if (!address) throw new NotFoundError('Address not found');
  if (input.isDefault === false && address.isDefault && user.addresses.length > 1) {
    throw new BadRequestError('Choose another default address first');
  }
  if (input.isDefault === true)
    user.addresses.forEach((item) => {
      item.isDefault = false;
    });
  if (input.label !== undefined) address.label = input.label;
  if (input.fullName !== undefined) address.fullName = input.fullName;
  if (input.line1 !== undefined) address.line1 = input.line1;
  if (input.line2 !== undefined) address.line2 = input.line2;
  if (input.city !== undefined) address.city = input.city;
  if (input.region !== undefined) address.region = input.region;
  if (input.postalCode !== undefined) address.postalCode = input.postalCode;
  if (input.country !== undefined) address.country = input.country;
  if (input.phone !== undefined) address.phone = input.phone;
  if (input.isDefault !== undefined) address.isDefault = input.isDefault;
  if (user.addresses.length === 1) address.isDefault = true;
  await user.save();
  return address;
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  const index = user.addresses.findIndex((item) => item._id.toString() === addressId);
  if (index < 0) throw new NotFoundError('Address not found');
  const wasDefault = user.addresses[index]?.isDefault;
  user.addresses.splice(index, 1);
  if (wasDefault && user.addresses.length > 0 && user.addresses[0])
    user.addresses[0].isDefault = true;
  await user.save();
}
