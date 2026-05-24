# tblcopy

`tblcopy` reads CSV from stdin, converts it to a rich-text table, and copies the RTF table to the macOS clipboard. Useful for pasting into spreadsheets, or emails as tables.

## Requirements

- Node.js 20 or newer
- macOS, with `textutil` and `osascript` available on `PATH`

## Install

Install globally from npm:

```sh
npm install -g tblcopy
```

Or run without installing:

```sh
npx tblcopy < table.csv
```

## Usage

```sh
cat table.csv | tblcopy
```

Add visible table borders with `--border`:

```sh
cat table.csv | tblcopy --border
```

Example:

```sh
printf 'Name,Amount\nCoffee,4.50\nRent,1200\n' | tblcopy
```

The first CSV row is rendered as table headers. Quoted CSV fields, escaped quotes, CRLF line endings, and embedded newlines are supported.

## Development

```sh
npm install
npm test
npm start < table.csv
```
