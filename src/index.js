import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export async function readAll(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const source = input.startsWith("\uFEFF") ? input.slice(1) : input;

  function endField() {
    row.push(field);
    field = "";
  }

  function endRow() {
    endField();
    rows.push(row);
    row = [];
  }

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      inQuotes = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n") {
      endRow();
    } else if (char === "\r") {
      if (source[index + 1] === "\n") {
        index += 1;
      }
      endRow();
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error("CSV input has an unterminated quoted field.");
  }

  if (field.length > 0 || row.length > 0 || source.length > 0) {
    const endedWithNewline = source.endsWith("\n") || source.endsWith("\r");
    if (!endedWithNewline) {
      endField();
      rows.push(row);
    }
  }

  return rows;
}

function htmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function csvRowsToHtmlTable(rows) {
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  const [header = [], ...bodyRows] = rows;

  const renderCell = (tagName, value) => `<${tagName}>${htmlEscape(value ?? "")}</${tagName}>`;
  const renderRow = (tagName, values) => {
    const cells = [];
    for (let index = 0; index < columnCount; index += 1) {
      cells.push(renderCell(tagName, values[index] ?? ""));
    }
    return `<tr>${cells.join("")}</tr>`;
  };

  const renderedRows = [];
  if (rows.length > 0) {
    renderedRows.push(renderRow("th", header));
  }
  for (const row of bodyRows) {
    renderedRows.push(renderRow("td", row));
  }

  return (
    "<html><body>" +
    `<table border="1" cellpadding="4" cellspacing="0">${renderedRows.join("")}</table>` +
    "</body></html>"
  );
}

function appleScriptString(value) {
  return JSON.stringify(value);
}

export async function copyRtf(
  html,
  {
    execFile: execFileFn = execFile,
    mkdtemp: mkdtempFn = mkdtemp,
    rm: rmFn = rm,
    tempRoot = os.tmpdir(),
    writeFile: writeFileFn = writeFile,
  } = {},
) {
  const tempDir = await mkdtempFn(path.join(tempRoot, "tblcopy-"));
  const htmlPath = path.join(tempDir, "table.html");
  const rtfPath = path.join(tempDir, "table.rtf");

  try {
    await writeFileFn(htmlPath, html, "utf8");
    await execFileFn("textutil", ["-convert", "rtf", htmlPath, "-output", rtfPath]);
    await execFileFn("osascript", [
      "-e",
      `set the clipboard to (read POSIX file ${appleScriptString(rtfPath)} as «class RTF »)`,
    ]);
  } finally {
    if (existsSync(htmlPath)) {
      await unlink(htmlPath);
    }
    if (existsSync(rtfPath)) {
      await unlink(rtfPath);
    }
    await rmFn(tempDir, { force: true, recursive: true });
  }
}

export async function run({
  copyRtf: copyRtfFn = copyRtf,
  stdin = process.stdin,
  stdout = process.stdout,
} = {}) {
  const input = await readAll(stdin);
  if (input.trim().length === 0) {
    throw new Error("No CSV input received on stdin.");
  }

  const rows = parseCsv(input);
  const html = csvRowsToHtmlTable(rows);

  await copyRtfFn(html);
  stdout.write("Copied table to clipboard.\n");
}
