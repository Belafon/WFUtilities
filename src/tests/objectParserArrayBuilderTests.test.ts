import * as assert from 'assert';
import {
  TypeScriptArrayBuilder,
  TypeScriptCodeBuilder,
  TypeScriptObjectBuilder,
} from '../typescriptObjectParser/ObjectParser'; // Adjust path as needed

// Helper function to create an ArrayBuilder instance for testing
async function createArrayBuilder(
  arrayLiteral: string
): Promise<{ builder: TypeScriptArrayBuilder; codeBuilder: TypeScriptCodeBuilder; originalCode: string }> {
  const originalCode = `const testArray = ${arrayLiteral};`;
  const codeBuilder = new TypeScriptCodeBuilder(originalCode);

  return new Promise((resolve, reject) => {
    codeBuilder.findArray('testArray', {
      onFound: (builder) => resolve({ builder, codeBuilder, originalCode }),
      onNotFound: () => reject(new Error('Array "testArray" not found during test setup')),
    });
  });
}

suite('TypeScriptArrayBuilder', () => {
  suite('addItem', () => {
    test('should add an item to an empty array', async () => {
      const { builder, codeBuilder } = await createArrayBuilder('[]');
      builder.addItem("'newItem'");
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = [ 'newItem' ];");
    });

    test('should add an item to a non-empty array', async () => {
      const { builder, codeBuilder } = await createArrayBuilder("['existing']");
      builder.addItem('42');
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = ['existing', 42];");
    });

    test('should add an item to a non-empty array with trailing comma possibility (no new comma needed if exists)', async () => {
      const { builder, codeBuilder } = await createArrayBuilder("['existing', ]");
      builder.addItem('42');
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = ['existing', 42, ];"); // Assumes parseItems/addItem preserves trailing comma style
    });

    test('should add an object literal item', async () => {
      const { builder, codeBuilder } = await createArrayBuilder("['first']");
      builder.addItem("{ id: 1, name: 'obj' }");
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = ['first', { id: 1, name: 'obj' }];");
    });

    test('should add an array literal item', async () => {
        const { builder, codeBuilder } = await createArrayBuilder("['first']");
        builder.addItem("[10, 20]");
        const result = await codeBuilder.toString();
        assert.strictEqual(result, "const testArray = ['first', [10, 20]];");
    });
  });

  suite('insertItemAtIndex', () => {
    test('should insert an item at the beginning of an empty array', async () => {
      const { builder, codeBuilder } = await createArrayBuilder('[]');
      builder.insertItemAtIndex(0, "'first'");
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = [ 'first' ];");
    });

    test('should insert an item at the beginning of a non-empty array', async () => {
      const { builder, codeBuilder } = await createArrayBuilder("['second']");
      builder.insertItemAtIndex(0, "'first'");
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = ['first', 'second'];");
    });

    test('should insert an item at the end of a non-empty array (using insertItemAtIndex)', async () => {
      const { builder, codeBuilder } = await createArrayBuilder("['first']");
      builder.insertItemAtIndex(1, "'second'"); // index 1 is after 'first'
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = ['first', 'second'];");
    });

    test('should insert an item in the middle of a non-empty array', async () => {
      const { builder, codeBuilder } = await createArrayBuilder("['first', 'third']");
      builder.insertItemAtIndex(1, "'middle'");
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = ['first', 'middle', 'third'];");
    });

    test('should throw error for negative index', async () => {
      const { builder } = await createArrayBuilder('[]');
      assert.throws(
        () => builder.insertItemAtIndex(-1, "'item'"),
        /Invalid index -1/
      );
    });

    test('should throw error for index too large', async () => {
      const { builder } = await createArrayBuilder("['one']"); // length 1
      assert.throws(
        () => builder.insertItemAtIndex(2, "'item'"), // valid indices 0, 1
        /Invalid index 2/
      );
    });
  });

  suite('removeItemAtIndex', () => {
    test('should remove an item from the beginning', async () => {
      const { builder, codeBuilder } = await createArrayBuilder("['first', 'second', 'third']");
      builder.removeItemAtIndex(0);
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = ['second', 'third'];");
    });

    test('should remove an item from the end', async () => {
      const { builder, codeBuilder } = await createArrayBuilder("['first', 'second', 'third']");
      builder.removeItemAtIndex(2);
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = ['first', 'second'];");
    });

    test('should remove an item from the middle', async () => {
      const { builder, codeBuilder } = await createArrayBuilder("['first', 'second', 'third']");
      builder.removeItemAtIndex(1);
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = ['first', 'third'];");
    });

    test('should remove the only item in an array', async () => {
        const { builder, codeBuilder } = await createArrayBuilder("['only']");
        builder.removeItemAtIndex(0);
        const result = await codeBuilder.toString();
        assert.strictEqual(result, "const testArray = [];");
    });

    test('should remove item from array with varied spacing', async () => {
        const { builder, codeBuilder } = await createArrayBuilder("[ 'a' , 'b' , 'c' ]");
        builder.removeItemAtIndex(1); // remove 'b'
        const result = await codeBuilder.toString();
        assert.strictEqual(result, "const testArray = [ 'a' , 'c' ];");
    });

    test('should throw error for invalid index when removing (too large)', async () => {
        const { builder } = await createArrayBuilder("['item']");
        assert.throws(() => builder.removeItemAtIndex(1), /Index out of bounds/);
    });
    test('should throw error for invalid index when removing (negative)', async () => {
        const { builder } = await createArrayBuilder("['item']");
        assert.throws(() => builder.removeItemAtIndex(-1), /Index out of bounds/);
    });
  });

  suite('replaceItemAtIndex', () => {
    test('should replace an item at the beginning', async () => {
      const { builder, codeBuilder } = await createArrayBuilder("['oldFirst', 'second']");
      builder.replaceItemAtIndex(0, "'newFirst'");
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = ['newFirst', 'second'];");
    });

    test('should replace an item at the end', async () => {
      const { builder, codeBuilder } = await createArrayBuilder("['first', 'oldLast']");
      builder.replaceItemAtIndex(1, "'newLast'");
      const result = await codeBuilder.toString();
      assert.strictEqual(result, "const testArray = ['first', 'newLast'];");
    });

    test('should replace an item in the middle', async () => {
        const { builder, codeBuilder } = await createArrayBuilder("['first', 'oldMiddle', 'third']");
        builder.replaceItemAtIndex(1, "'newMiddle'");
        const result = await codeBuilder.toString();
        assert.strictEqual(result, "const testArray = ['first', 'newMiddle', 'third'];");
    });

    test('should replace the only item', async () => {
        const { builder, codeBuilder } = await createArrayBuilder("['onlyOld']");
        builder.replaceItemAtIndex(0, "'onlyNew'");
        const result = await codeBuilder.toString();
        assert.strictEqual(result, "const testArray = ['onlyNew'];");
    });

    test('should throw error for invalid index when replacing (too large)', async () => {
        const { builder } = await createArrayBuilder("['item']");
        assert.throws(() => builder.replaceItemAtIndex(1, "'newItem'"), /Index out of bounds/);
    });
    test('should throw error for invalid index when replacing (negative)', async () => {
        const { builder } = await createArrayBuilder("['item']");
        assert.throws(() => builder.replaceItemAtIndex(-1, "'newItem'"), /Index out of bounds/);
    });
  });

  suite('getObjectItems', () => {
    test('should get object items from an array of objects', async () => {
      const { builder } = await createArrayBuilder("[{ id: 1, name: 'a' }, { id: 2, name: 'b' }]");
      const items = builder.getObjectItems();
      assert.strictEqual(items.length, 2);
      assert.ok(items[0] instanceof TypeScriptObjectBuilder);
      assert.ok(items[1] instanceof TypeScriptObjectBuilder);
      assert.strictEqual(items[0].getFullText().trim(), "{ id: 1, name: 'a' }");
      assert.strictEqual(items[1].getFullText().trim(), "{ id: 2, name: 'b' }");
    });

    test('should get object items from a mixed array', async () => {
      const { builder } = await createArrayBuilder("[1, { id: 1 }, 'text', { id: 2 }]");
      const items = builder.getObjectItems();
      assert.strictEqual(items.length, 2);
      assert.strictEqual(items[0].getFullText().trim(), "{ id: 1 }");
      assert.strictEqual(items[1].getFullText().trim(), "{ id: 2 }");
    });

    test('should return an empty array if no object items', async () => {
        const { builder } = await createArrayBuilder("[1, 'text', []]");
        const items = builder.getObjectItems();
        assert.strictEqual(items.length, 0);
    });

    test('should return an empty array for an empty array input', async () => {
        const { builder } = await createArrayBuilder("[]");
        const items = builder.getObjectItems();
        assert.strictEqual(items.length, 0);
    });
  });

  suite('getArrayItems', () => {
    test('should get array items from an array of arrays', async () => {
      const { builder } = await createArrayBuilder("[[1], [2, 3]]");
      const items = builder.getArrayItems();
      assert.strictEqual(items.length, 2);
      assert.ok(items[0] instanceof TypeScriptArrayBuilder);
      assert.ok(items[1] instanceof TypeScriptArrayBuilder);
      assert.strictEqual(items[0].getFullText(), "[1]");
      assert.strictEqual(items[1].getFullText(), "[2, 3]");
    });

    test('should get array items from a mixed array', async () => {
      const { builder } = await createArrayBuilder("[1, [10], 'text', [20, 30]]");
      const items = builder.getArrayItems();
      assert.strictEqual(items.length, 2);
      assert.strictEqual(items[0].getFullText(), "[10]");
      assert.strictEqual(items[1].getFullText(), "[20, 30]");
    });

    test('should return an empty array if no array items', async () => {
        const { builder } = await createArrayBuilder("[1, 'text', {}]");
        const items = builder.getArrayItems();
        assert.strictEqual(items.length, 0);
    });
  });

  suite('getItemTexts', () => {
    test('should get texts of simple literal items', async () => {
      const { builder } = await createArrayBuilder("[1, 'hello', true, null]");
      const items = builder.getItemTexts();
      assert.deepStrictEqual(items, ['1', "'hello'", 'true', 'null']);
    });

    test('should get texts of items including objects and arrays', async () => {
      const { builder } = await createArrayBuilder("[{ a: 1 }, [10, 20], 'text']");
      const items = builder.getItemTexts();
      assert.deepStrictEqual(items, ['{ a: 1 }', '[10, 20]', "'text'"]);
    });

    test('should get texts with varied spacing', async () => {
        const { builder } = await createArrayBuilder("[ 1 ,  'hello' ,true  ]");
        const items = builder.getItemTexts();
        assert.deepStrictEqual(items, ['1', "'hello'", 'true']);
    });

    test('should return an empty array for an empty array', async () => {
      const { builder } = await createArrayBuilder('[]');
      const items = builder.getItemTexts();
      assert.deepStrictEqual(items, []);
    });

    test('should handle array with only whitespace content', async () => {
        const { builder } = await createArrayBuilder('[   ]');
        const items = builder.getItemTexts();
        assert.deepStrictEqual(items, []);
    });

    test('should handle array with trailing comma before closing bracket', async () => {
        const { builder } = await createArrayBuilder("[1, 2, ]");
        const items = builder.getItemTexts();
        assert.deepStrictEqual(items, ['1', '2']);
    });
  });

  suite('getItemCount', () => {
    test('should count items in a non-empty array', async () => {
      const { builder } = await createArrayBuilder("[1, 'hello', { a: 1 }]");
      assert.strictEqual(builder.getItemCount(), 3);
    });

    test('should return 0 for an empty array', async () => {
      const { builder } = await createArrayBuilder('[]');
      assert.strictEqual(builder.getItemCount(), 0);
    });

    test('should count items correctly with trailing comma', async () => {
        const { builder } = await createArrayBuilder("[1, 2, 3, ]");
        assert.strictEqual(builder.getItemCount(), 3);
    });
  });

  suite('getContentText', () => {
    test('should get content of a non-empty array', async () => {
      const { builder } = await createArrayBuilder("[1, 'text', true]");
      assert.strictEqual(builder.getContentText(), "1, 'text', true");
    });

    test('should get empty string for an empty array', async () => {
      const { builder } = await createArrayBuilder('[]');
      assert.strictEqual(builder.getContentText(), '');
    });

    test('should get content including spaces', async () => {
        const { builder } = await createArrayBuilder('[ 1,  2 ]');
        assert.strictEqual(builder.getContentText(), ' 1,  2 ');
    });
  });

  suite('getFullText', () => {
    test('should get full text of a non-empty array', async () => {
      const arrayLit = "[1, 'text', true]";
      const { builder } = await createArrayBuilder(arrayLit);
      assert.strictEqual(builder.getFullText(), arrayLit);
    });

    test('should get full text of an empty array', async () => {
      const { builder } = await createArrayBuilder('[]');
      assert.strictEqual(builder.getFullText(), '[]');
    });
  });

  suite('parseItems (indirect testing via public methods)', () => {
    test('should correctly parse items with nested structures for getItemTexts', async () => {
        const { builder } = await createArrayBuilder("[1, { name: 'obj', value: [10, 20] }, 3]");
        const items = builder.getItemTexts();
        assert.deepStrictEqual(items, ['1', "{ name: 'obj', value: [10, 20] }", '3']);
    });

    test('should correctly parse items with function calls or complex expressions for getItemTexts', async () => {
        const { builder } = await createArrayBuilder("[getValue(), obj.method(1, 'a'), new MyClass()]");
        const items = builder.getItemTexts();
        assert.deepStrictEqual(items, ["getValue()", "obj.method(1, 'a')", "new MyClass()"]);
    });

    test('should handle items separated by newlines for getItemTexts', async () => {
        const { builder } = await createArrayBuilder(`[
            1,
            'two',
            {
                three: 3
            }
        ]`);
        const items = builder.getItemTexts();
        // The parseItems implementation might produce slightly different spacing for the object.
        // We are interested in the core values.
        assert.strictEqual(items[0], "1");
        assert.strictEqual(items[1], "'two'");
        assert.ok(items[2].includes("three: 3")); // Check for key content
    });
  });
});