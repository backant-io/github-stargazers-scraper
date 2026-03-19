import { GitHubStargazerEdge, StargazerProfile } from '../types/stargazers';

export function normalizeProfile(edge: GitHubStargazerEdge): StargazerProfile {
  const { node, starredAt } = edge;

  if (!node) {
    return {
      username: 'unknown',
      name: null,
      email: null,
      company: null,
      location: null,
      bio: null,
      blog: null,
      twitter_username: null,
      profile_url: '',
      avatar_url: '',
      starred_at: starredAt,
    };
  }

  return {
    username: node.login,
    name: node.name || null,
    email: node.email || null,
    company: node.company?.trim() || null,
    location: node.location?.trim() || null,
    bio: node.bio?.trim() || null,
    blog: node.websiteUrl || null,
    twitter_username: node.twitterUsername || null,
    profile_url: `https://github.com/${node.login}`,
    avatar_url: node.avatarUrl,
    starred_at: starredAt,
  };
}
