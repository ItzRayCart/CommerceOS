import { z } from 'zod';

const COMMON_PASSWORDS = new Set(
  `password 123456 12345678 qwerty abc123 monkey 1234567 letmein trustno1 dragon baseball
  iloveyou master sunshine ashley bailey passw0rd shadow 123123 654321 superman qazwsx
  michael football welcome jesus ninja mustang password1 123456789 1234567890 admin
  princess solo starwars hello charlie donald login flower hottie loveme zaq1zaq1
  freedom whatever qwerty123 1q2w3e4r 666666 111111 000000 121212 7777777
  888888 999999 555555 112233 123321 987654321 123qwe qwertyuiop 1qaz2wsx
  password123 changeme secret test1234 mypassword access computer internet killer
  jordan jennifer hunter harley batman tigger summer winter spring autumn cookie
  pepper cheese banana orange purple yellow soccer hockey tennis liverpool chelsea
  arsenal manchester pokemon pikachu matrix android samsung iphone google default
  administrator root toor guest user support service manager`.split(/\s+/),
);

export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a digit')
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), 'Password is too common');
