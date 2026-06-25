export const STORAGE_KEYS = {
  VOTER_TOKEN: "costume_vote_voter_token",
  ADMIN_TOKEN: "costume_vote_admin_token",
};

export function getVoterToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.VOTER_TOKEN);
}

export function setVoterToken(token: string) {
  localStorage.setItem(STORAGE_KEYS.VOTER_TOKEN, token);
}

export function clearVoterToken() {
  localStorage.removeItem(STORAGE_KEYS.VOTER_TOKEN);
}

export function getAdminToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
}

export function setAdminToken(token: string) {
  localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);
}

export function clearAdminToken() {
  localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
}
