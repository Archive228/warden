#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write
import { Command } from "commander";

const program = new Command();

program
  .name("warden")
  .description("Agentic vetting for new token launches")
  .version("0.1.0");

program.parse(Deno.args, { from: "user" });
