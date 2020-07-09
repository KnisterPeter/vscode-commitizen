import * as assert from 'assert';

describe('Extension Test with webpack in workspace', () => {
  it('should be activated by default', () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });
});
