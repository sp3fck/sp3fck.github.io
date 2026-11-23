// Cloudflare Worker z Cron Trigger: co 30 minut uruchamia workflow mesh-sync.yml przez GitHub API (workflow_dispatch).
// Harmonogram w samym GitHubie realnie odpala się 3–4 razy na dobę, a workflow_dispatch startuje od razu.
// Token (fine-grained PAT, tylko to repo, uprawnienie Actions: Read and write) jest sekretem GITHUB_TOKEN — nie ma go w kodzie.
// Worker nie ma handlera fetch ani adresu workers.dev: działa wyłącznie z harmonogramu.

export async function dispatch(env, fetchImpl = fetch) {
  if (!env.GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN secret (npx wrangler secret put GITHUB_TOKEN)");
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW}/dispatches`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "mesh-sync-cron"
    },
    body: JSON.stringify({ ref: env.REF || "main" })
  });
  // GitHub odpowiada 204 bez treści, gdy workflow został zakolejkowany.
  if (res.status !== 204) throw new Error(`GitHub API HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  console.log(`Dispatched ${env.WORKFLOW} on ${env.REF || "main"}`);
}

export default {
  // Wyjątek oznacza w Cloudflare nieudane wywołanie crona (widać je w logach Workera).
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(dispatch(env));
  }
};
