import { assertEquals } from "@std/assert";

// Regression test for a real bug caught live: a shell substitution that
// produced an empty string fed `watch --once ""` through, and
// `if (opts.once)` treated the empty-but-provided string as "no value
// given," silently falling into the infinite poll loop instead of failing
// validation - the process had to be killed by hand rather than exiting on
// its own. Spawns the real CLI as a subprocess (not just calling the
// action function directly) so this actually exercises commander's arg
// parsing too, not just the code after it.
Deno.test('watch --once "" fails validation immediately instead of falling into the poll loop', async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-net",
      "--allow-env",
      "--allow-read",
      "--allow-write",
      "src/cli.ts",
      "watch",
      "--once",
      "",
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const child = command.spawn();
  const timeoutId = setTimeout(() => {
    try {
      child.kill();
    } catch {
      // already exited
    }
  }, 8_000);

  const { code, stderr } = await child.output();
  clearTimeout(timeoutId);

  assertEquals(code, 1);
  const stderrText = new TextDecoder().decode(stderr);
  assertEquals(stderrText.includes("not a valid address"), true);
  assertEquals(stderrText.includes("watching for new"), false);
});
