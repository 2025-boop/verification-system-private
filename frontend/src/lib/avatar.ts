import { createAvatar } from '@dicebear/core';
import { thumbs } from '@dicebear/collection';

/**
 * Generates a deterministic avatar using DiceBear
 * @param seed - Username or identifier to generate avatar from
 * @returns Data URI of the generated avatar
 */
export function generateAvatar(seed: string): string {
  const avatar = createAvatar(thumbs, {
    seed,
    backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9'],
  });
  return avatar.toDataUri();
}

/**
 * Retrieves a cookie value by name
 * @param name - Cookie name
 * @returns Cookie value or null if not found
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}
