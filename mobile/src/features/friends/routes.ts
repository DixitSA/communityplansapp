import type { Href } from 'expo-router';

/** A person's page. Cast because typed routes are generated when the dev server starts. */
export const userHref = (id: string) => ({ pathname: '/user/[id]', params: { id } }) as unknown as Href;

/** The friends and requests list. */
export const friendsHref = '/friends' as Href;
