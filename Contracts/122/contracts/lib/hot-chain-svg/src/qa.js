const fs = require('fs');
const os = require('os');
const path = require('path');
const boot = require('./boot');
const call = require('./call');
const compile = require('./compile');
const deploy = require('./deploy');
const { DOMParser } = require('xmldom');

const SOURCE = path.join(__dirname, '..', 'contracts', 'Renderer.sol');

async function main() {
  const { vm, pk } = await boot();
  const { abi, bytecode } = compile(SOURCE);
  const address = await deploy(vm, pk, bytecode);

  const tempFolder = fs.mkdtempSync(os.tmpdir());
  console.log('Saving to', tempFolder);

  for (let i = 1; i < 256; i++) {
    const fileName = path.join(tempFolder, i + '.svg');
    console.log('Rendering', fileName);
    const svg = await call(vm, address, abi, 'render', [i]);
    fs.writeFileSync(fileName, svg);

    // Throws on invalid XML
    new DOMParser().parseFromString(svg);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
