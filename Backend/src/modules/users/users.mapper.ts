import type { Types } from 'mongoose';
import type { Role } from '@commerceos/shared';
import type { Address, User } from '@api/modules/users/users.model.js';

export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: Role;
  status: 'active' | 'disabled';
}

export interface AddressDto extends Omit<Address, '_id'> {
  id: string;
}

export function toUserDto(user: User & { _id: Types.ObjectId }): UserDto {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    ...(user.phone ? { phone: user.phone } : {}),
    role: user.role,
    status: user.status,
  };
}

export function toAddressDto(address: Address): AddressDto {
  return {
    id: address._id.toString(),
    label: address.label,
    fullName: address.fullName,
    line1: address.line1,
    ...(address.line2 ? { line2: address.line2 } : {}),
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
    isDefault: address.isDefault,
  };
}
