import { spawn } from "node:child_process";

const commands = [
  ["api", "node", ["server/index.js"]],
  ["web", "vite", ["--host", "0.0.0.0"]]
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" }
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
  return child;
});

const shutdown = () => {
  for (const child of children) child.kill("SIGTERM");
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
