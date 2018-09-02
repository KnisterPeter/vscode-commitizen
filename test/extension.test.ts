import * as assert from 'assert';

// import * as vscode from 'vscode';
// import * as myExtension from '../src/extension';

suite('Extension Tests', () => {

    test('Something 1', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });
});
