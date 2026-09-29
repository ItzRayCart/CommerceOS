export interface EchoDto {
  message: string;
}

export function toEchoDto(message: string): EchoDto {
  return { message };
}
