export function formatMessage(name = 'tblcopy') {
  return `${name} is ready.`;
}

export function run({ stdout = process.stdout } = {}) {
  stdout.write(`${formatMessage()}\n`);
}
