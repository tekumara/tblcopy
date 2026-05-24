import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatMessage, run } from '../src/index.js';

describe('tblcopy', () => {
  it('formats the default message', () => {
    assert.equal(formatMessage(), 'tblcopy is ready.');
  });

  it('writes the message to stdout', () => {
    let output = '';

    run({
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });

    assert.equal(output, 'tblcopy is ready.\n');
  });
});
