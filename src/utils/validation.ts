export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const REPO_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}\/[a-zA-Z0-9._-]{1,100}$/;

export function validateRepoIdentifier(repo: string | null | undefined): ValidationResult {
  if (!repo || repo.trim() === '') {
    return {
      valid: false,
      error: 'Repository identifier is required. Expected format: owner/repo',
    };
  }

  const trimmed = repo.trim();

  if (!REPO_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: `Invalid repository identifier "${trimmed}". Expected format: owner/repo (e.g., "facebook/react")`,
    };
  }

  return { valid: true };
}
