/** "1 mutual friend", "3 mutual friends". */
export function mutualFriendsLabel(count: number): string {
  return `${count} mutual ${count === 1 ? 'friend' : 'friends'}`;
}

/** "1 friend", "12 friends". */
export function friendCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'friend' : 'friends'}`;
}
