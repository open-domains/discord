import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Collection } from 'discord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commandsDirectory = path.join(__dirname, '..', 'commands');

async function loadCommandModules() {
  const files = await fs.promises.readdir(commandsDirectory);
  const modules = [];
  const seenCommandNames = new Set();

  for (const file of files) {
    if (!file.endsWith('.js')) continue;

    const moduleUrl = pathToFileURL(path.join(commandsDirectory, file));
    const module = await import(moduleUrl.href);
    const command = module?.command;

    if (command?.data && typeof command.execute === 'function') {
      const commandName = command.data.name;
      if (seenCommandNames.has(commandName)) {
        console.warn(`Skipping duplicate command name "${commandName}" from ${file}`);
        continue;
      }

      seenCommandNames.add(commandName);
      modules.push(command);
    } else {
      console.warn(`Skipping invalid command file: ${file}`);
    }
  }

  return modules;
}

export async function loadCommands() {
  const modules = await loadCommandModules();
  const collection = new Collection();

  for (const command of modules) {
    collection.set(command.data.name, command);
  }

  return collection;
}

export async function getCommandData() {
  const modules = await loadCommandModules();
  return modules.map((command) => command.data.toJSON());
}
