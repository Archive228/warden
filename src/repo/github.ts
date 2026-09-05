const GITHUB_API = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(public status: number, public url: string) {
    super(`GitHub API ${status}: ${url}`);
  }
}

export async function githubGet<T>(path: string): Promise<T> {
  const token = Deno.env.get("GITHUB_TOKEN");
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": "warden",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new GitHubApiError(res.status, path);
  return res.json();
}

export async function githubGetRaw(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { "User-Agent": "warden" } });
  if (!res.ok) return null;
  return res.text();
}
