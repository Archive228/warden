import { githubGet, githubGetRaw } from "./github.ts";

// GitHub restricted stargazer-listing (and its starred_at timestamps) to
// admin/collaborators as of ~July 2026. REST 404s for a third-party repo;
// GraphQL silently returns an empty edges array even when stargazerCount
// confirms real stars exist — so star-burst timing is a signal that no
// longer exists for arbitrary repos. Never treat "couldn't check" as "no
// burst found." Fork timing is unaffected and is the load-bearing signal
// here instead.
const FORK_BURST_WINDOW_MINUTES = 30;

// Deliberately kept separate, not merged into one "token mention" signal:
// a bare hex address is weak on its own (any protocol-integration repo's
// README is full of them — ponsdotdev/ponsfamily's own README matched this
// pattern 4 times over legitimate, pre-existing factory addresses with no
// self-promotion angle at all). A `$TICKER`-style match is a much sharper,
// far less common signal of a repo shilling something.
const CONTRACT_ADDRESS_RE = /0x[a-fA-F0-9]{40}/g;
const TICKER_RE = /\$[A-Z]{2,10}\b/g;

interface GitHubUser {
  login: string;
  created_at: string;
  bio: string | null;
  public_repos: number;
}

interface GitHubRepo {
  created_at: string;
  default_branch: string;
  stargazers_count: number;
  owner: { login: string };
}

interface GitHubFork {
  created_at: string;
}

export interface TextMention {
  location: "readme" | "bio";
  match: string;
}

export interface RepoFingerprint {
  owner: string;
  repo: string;
  repoCreatedAt: string;
  accountCreatedAt: string;
  oldestVisibleRepoCreatedAt: string | null;
  dormancyGapDays: number | null;
  forkCount: number;
  forkBurst: {
    windowMinutes: number;
    count: number;
    first: string;
    last: string;
  } | null;
  starCount: number;
  starTimingAvailable: false;
  // Weak signal alone — common in any legitimate protocol-integration repo.
  contractAddressMentions: TextMention[];
  // Much sharper signal: a repo advertising a specific token ticker.
  tickerMentions: TextMention[];
}

export async function vetRepo(
  owner: string,
  repo: string,
): Promise<RepoFingerprint> {
  const [repoInfo, ownerInfo, forks] = await Promise.all([
    githubGet<GitHubRepo>(`/repos/${owner}/${repo}`),
    githubGet<GitHubUser>(`/users/${owner}`),
    githubGet<GitHubFork[]>(
      `/repos/${owner}/${repo}/forks?per_page=100&sort=newest`,
    ),
  ]);

  const [oldestRepo, readme] = await Promise.all([
    fetchOldestRepo(owner),
    githubGetRaw(
      `https://raw.githubusercontent.com/${owner}/${repo}/${repoInfo.default_branch}/README.md`,
    ),
  ]);

  const dormancyGapDays = oldestRepo
    ? daysBetween(ownerInfo.created_at, oldestRepo.created_at)
    : null;

  return {
    owner,
    repo,
    repoCreatedAt: repoInfo.created_at,
    accountCreatedAt: ownerInfo.created_at,
    oldestVisibleRepoCreatedAt: oldestRepo?.created_at ?? null,
    dormancyGapDays,
    forkCount: forks.length,
    forkBurst: findForkBurst(forks),
    starCount: repoInfo.stargazers_count,
    starTimingAvailable: false,
    contractAddressMentions: [
      ...findMentions(readme ?? "", "readme", CONTRACT_ADDRESS_RE),
      ...findMentions(ownerInfo.bio ?? "", "bio", CONTRACT_ADDRESS_RE),
    ],
    tickerMentions: [
      ...findMentions(readme ?? "", "readme", TICKER_RE),
      ...findMentions(ownerInfo.bio ?? "", "bio", TICKER_RE),
    ],
  };
}

async function fetchOldestRepo(
  owner: string,
): Promise<{ created_at: string } | null> {
  const repos = await githubGet<Array<{ created_at: string }>>(
    `/users/${owner}/repos?sort=created&direction=asc&per_page=1`,
  );
  return repos[0] ?? null;
}

function daysBetween(earlierIso: string, laterIso: string): number {
  const ms = new Date(laterIso).getTime() - new Date(earlierIso).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function findForkBurst(
  forks: GitHubFork[],
): RepoFingerprint["forkBurst"] {
  if (forks.length < 2) return null;

  const timestamps = forks
    .map((f) => new Date(f.created_at).getTime())
    .sort((a, b) => a - b);

  const windowMs = FORK_BURST_WINDOW_MINUTES * 60 * 1000;
  let best = { count: 1, start: 0, end: 0 };

  let left = 0;
  for (let right = 0; right < timestamps.length; right++) {
    while (timestamps[right] - timestamps[left] > windowMs) left++;
    const count = right - left + 1;
    if (count > best.count) {
      best = { count, start: left, end: right };
    }
  }

  if (best.count < 2) return null;

  return {
    windowMinutes: FORK_BURST_WINDOW_MINUTES,
    count: best.count,
    first: new Date(timestamps[best.start]).toISOString(),
    last: new Date(timestamps[best.end]).toISOString(),
  };
}

function findMentions(
  text: string,
  location: TextMention["location"],
  pattern: RegExp,
): TextMention[] {
  return [...text.matchAll(pattern)].map((m) => ({ location, match: m[0] }));
}
