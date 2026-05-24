import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { promisify } from "node:util";

import { copyRtf, csvRowsToHtmlTable, parseCsv, run } from "../src/index.js";

const execFile = promisify(execFileCallback);

describe("parseCsv", () => {
  it("parses basic comma-separated rows", () => {
    assert.deepEqual(parseCsv("Name,Amount\nCoffee,4.50\nRent,1200\n"), [
      ["Name", "Amount"],
      ["Coffee", "4.50"],
      ["Rent", "1200"],
    ]);
  });

  it("parses quoted fields, escaped quotes, CRLFs, and embedded newlines", () => {
    assert.deepEqual(parseCsv('Name,Notes\r\n"Ada, Lovelace","Said ""hi""\nand left"'), [
      ["Name", "Notes"],
      ["Ada, Lovelace", 'Said "hi"\nand left'],
    ]);
  });

  it("throws for unterminated quoted fields", () => {
    assert.throws(() => parseCsv('Name\n"Ada'), /unterminated quoted field/);
  });
});

describe("csvRowsToHtmlTable", () => {
  it("renders the first CSV row as a header row and escapes HTML", () => {
    assert.equal(
      csvRowsToHtmlTable([
        ["Name", "Note"],
        ["Ada", "<coder> & mathematician"],
      ]),
      '<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1" cellpadding="4" cellspacing="0"><tr><th>Name</th><th>Note</th></tr><tr><td>Ada</td><td>&lt;coder&gt; &amp; mathematician</td></tr></table></body></html>',
    );
  });

  it("pads ragged rows so the table remains rectangular", () => {
    assert.equal(
      csvRowsToHtmlTable([
        ["A"],
        ["1", "2"],
      ]),
      '<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1" cellpadding="4" cellspacing="0"><tr><th>A</th><th></th></tr><tr><td>1</td><td>2</td></tr></table></body></html>',
    );
  });

  it(
    "declares UTF-8 so textutil preserves em dashes instead of mojibake",
    { skip: process.platform !== "darwin" },
    async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "tblcopy-textutil-test-"));
      const htmlPath = path.join(tempDir, "table.html");
      const rtfPath = path.join(tempDir, "table.rtf");

      try {
        await writeFile(
          htmlPath,
          csvRowsToHtmlTable([
            ["Name", "Note"],
            ["Ada", "A — B"],
          ]),
          "utf8",
        );
        await execFile("textutil", ["-convert", "rtf", htmlPath, "-output", rtfPath]);
        const rtf = await readFile(rtfPath);

        assert.equal(rtf.includes(Buffer.from("\\'e2\\'80\\'94")), false);
        assert.equal(rtf.includes(Buffer.from("\\'97")), true);
      } finally {
        await rm(tempDir, { force: true, recursive: true });
      }
    },
  );
});

describe("copyRtf", () => {
  it("converts HTML to RTF and writes the RTF data to the clipboard", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "tblcopy-test-"));
    const calls = [];

    try {
      await copyRtf("<html><body>table</body></html>", {
        tempRoot,
        execFile: async (command, args) => {
          calls.push({ command, args });
        },
      });
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }

    assert.equal(calls.length, 2);
    assert.equal(calls[0].command, "textutil");
    assert.deepEqual(calls[0].args.slice(0, 2), ["-convert", "rtf"]);
    assert.equal(calls[0].args[3], "-output");
    assert.equal(calls[1].command, "osascript");
    assert.equal(calls[1].args[0], "-e");
    assert.match(calls[1].args[1], /set the clipboard to \(read POSIX file .+ as «class RTF »\)/);
  });
});

describe("run", () => {
  it("reads CSV from stdin, copies rich text, and reports success", async () => {
    let copiedHtml = "";
    let output = "";

    await run({
      stdin: Readable.from(["Name,Amount\nCoffee,4.50\n"]),
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
      copyRtf: async (html) => {
        copiedHtml = html;
      },
    });

    assert.equal(output, "Copied table to clipboard.\n");
    assert.equal(
      copiedHtml,
      '<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1" cellpadding="4" cellspacing="0"><tr><th>Name</th><th>Amount</th></tr><tr><td>Coffee</td><td>4.50</td></tr></table></body></html>',
    );
  });

  it("fails when no CSV is provided", async () => {
    await assert.rejects(
      () =>
        run({
          stdin: Readable.from([""]),
          copyRtf: async () => {},
        }),
      /No CSV input received/,
    );
  });
});
