'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectDirectory = path.resolve(__dirname, '..');
const packageJson = require(path.join(projectDirectory, 'package.json'));
const artifactName = `Stage-Deck-Calculator-${packageJson.version}.exe`;
const temporaryOutput = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-deck-calculator-build-'));
const releaseDirectory = path.join(projectDirectory, 'release');
const builderCli = path.join(projectDirectory, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');

console.log(`Building ${artifactName}…`);

try {
  const result = spawnSync(process.execPath, [
    builderCli,
    '--win',
    'portable',
    `--config.directories.output=${temporaryOutput.replaceAll('\\', '/')}`
  ], {
    cwd: projectDirectory,
    stdio: 'inherit'
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);

  const builtArtifact = path.join(temporaryOutput, artifactName);
  if (!fs.existsSync(builtArtifact)) {
    throw new Error(`The build completed without producing ${artifactName}.`);
  }

  fs.mkdirSync(releaseDirectory, { recursive: true });
  fs.copyFileSync(builtArtifact, path.join(releaseDirectory, artifactName));
  console.log(`Portable executable created: ${path.join(releaseDirectory, artifactName)}`);
} finally {
  fs.rmSync(temporaryOutput, { recursive: true, force: true });
}
