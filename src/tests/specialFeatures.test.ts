import * as assert from 'assert';
import {
    TypeScriptCodeBuilder,
    TypeScriptArrayBuilder, // For findNestedProperty returning array builder
} from '../typescriptObjectParser/ObjectParser'; // Adjust path as needed
import { TypeScriptObjectBuilder } from "../typescriptObjectParser/TypeScriptObjectBuilder";

// Helper to create a TypeScriptCodeBuilder instance for testing
function createCodeBuilder(code: string): TypeScriptCodeBuilder {
    return new TypeScriptCodeBuilder(code);
}

// Helper to get a TypeScriptObjectBuilder for a variable (promisified for async find)
async function getObjectBuilder(
    codeBuilder: TypeScriptCodeBuilder,
    variableName: string // This is 'C' in the test
): Promise<TypeScriptObjectBuilder | null> {
    return new Promise((resolve) => {
        codeBuilder.findObject(variableName, {
            onFound: (builder) => {
                // Crucially, set the name of the root objectGroup if findObject doesn't.
                // The TokenGroup for the object literal itself usually doesn't have a name.
                // The variable 'C' is the conceptual name.
                if (builder.objectGroup && !builder.objectGroup.name) {
                    builder.objectGroup.name = variableName;
                }
                resolve(builder);
            },
            onNotFound: () => resolve(null),
        });
    });
}


suite('TypeScriptCodeBuilder Extended Features', () => {
    suite('findReturnObjectInFunction', () => {
        test('should find an object returned by a simple function', (done) => {
            const code = `
                function getConfig() {
                    return {
                        host: 'localhost',
                        port: 8080
                    };
                }
            `;
            const builder = createCodeBuilder(code);
            builder.findReturnObjectInFunction('getConfig', {
                onFound: (objectBuilder) => {
                    assert.ok(objectBuilder instanceof TypeScriptObjectBuilder, 'Should return an TypeScriptObjectBuilder');
                    assert.strictEqual(objectBuilder.getFullText().replace(/\s+/g, ''), '{host:\'localhost\',port:8080}');
                    done();
                },
                onNotFound: () => {
                    assert.fail('Object not found in return statement');
                    done();
                },
            });
        });

        test('should find an empty object {} returned by a function', (done) => {
            const code = `
                function getEmpty() {
                    return {};
                }
            `;
            const builder = createCodeBuilder(code);
            builder.findReturnObjectInFunction('getEmpty', {
                onFound: (objectBuilder) => {
                    assert.ok(objectBuilder instanceof TypeScriptObjectBuilder);
                    assert.strictEqual(objectBuilder.getFullText().replace(/\s+/g, ''), '{}');
                    done();
                },
                onNotFound: () => {
                    assert.fail('Empty object not found');
                    done();
                },
            });
        });

        test('should call onNotFound if function does not return an object literal', (done) => {
            const code = `
                function getNumber() {
                    const num = 123;
                    return num;
                }
            `;
            const builder = createCodeBuilder(code);
            builder.findReturnObjectInFunction('getNumber', {
                onFound: () => {
                    assert.fail('Should not have found an object');
                    done();
                },
                onNotFound: () => {
                    assert.ok(true, 'onNotFound correctly called');
                    done();
                },
            });
        });

        test('should call onNotFound if function has no return statement', (done) => {
            const code = `
                function noReturn() {
                    console.log('hello');
                }
            `;
            const builder = createCodeBuilder(code);
            builder.findReturnObjectInFunction('noReturn', {
                onFound: () => {
                    assert.fail('Should not have found an object');
                    done();
                },
                onNotFound: () => {
                    assert.ok(true, 'onNotFound correctly called for no return');
                    done();
                },
            });
        });

        test('should call onNotFound if function name does not exist', (done) => {
            const code = `function existingFunc() { return { a: 1 }; }`;
            const builder = createCodeBuilder(code);
            builder.findReturnObjectInFunction('nonExistentFunc', {
                onFound: () => {
                    assert.fail('Should not have found the function');
                    done();
                },
                onNotFound: () => {
                    assert.ok(true, 'onNotFound correctly called for non-existent function');
                    done();
                },
            });
        });

        test('should handle object returned with varied whitespace', (done) => {
            const code = `
                function getSpacedConfig() {
                    return      {
                        key   :   "value"
                    }  ;
                }
            `;
            const builder = createCodeBuilder(code);
            builder.findReturnObjectInFunction('getSpacedConfig', {
                onFound: (objectBuilder) => {
                    assert.ok(objectBuilder instanceof TypeScriptObjectBuilder);
                    assert.strictEqual(objectBuilder.getFullText().replace(/\s+/g, ''), '{key:"value"}');
                    done();
                },
                onNotFound: () => {
                    assert.fail('Object not found with varied spacing');
                    done();
                },
            });
        });
    });
});

suite('TypeScriptObjectBuilder Extended Features', () => {
    suite('addPropertyIfMissing', () => {
        test('should add a property to an empty object', async () => {
            const code = `const myObj = {};`;
            const builder = createCodeBuilder(code);
            const objBuilder = await getObjectBuilder(builder, 'myObj');
            assert.ok(objBuilder, 'Object builder should be found');

            const added = objBuilder!.addPropertyIfMissing('newProp', '42');
            assert.strictEqual(added, true, 'Should return true as property was added');

            const result = await builder.toString();
            assert.ok(result.includes('newProp: 42'), 'Result should contain the new property');
            assert.ok(result.includes('{') && result.includes('}'), 'Object braces should remain');
        });

        test('should add a property to an object with existing properties', async () => {
            const code = `const myObj = { existing: "value" };`;
            const builder = createCodeBuilder(code);
            const objBuilder = await getObjectBuilder(builder, 'myObj');
            assert.ok(objBuilder);

            const added = objBuilder!.addPropertyIfMissing('anotherProp', 'true');
            assert.strictEqual(added, true);

            const result = await builder.toString();
            assert.ok(result.includes('existing: "value"'), 'Existing property should remain');
            assert.ok(result.includes('anotherProp: true'), 'New property should be added');
        });

        test('should not add a property if it already exists and return false', async () => {
            const code = `const myObj = { name: "Alice" };`;
            const builder = createCodeBuilder(code);
            const objBuilder = await getObjectBuilder(builder, 'myObj');
            assert.ok(objBuilder);

            const added = objBuilder!.addPropertyIfMissing('name', '"Bob"');
            assert.strictEqual(added, false, 'Should return false as property exists');

            const result = await builder.toString();
            assert.strictEqual(result.replace(/\s+/g, ''), 'constmyObj={name:"Alice"};', 'Object should not be changed');
        });

        test('should correctly format the added property (e.g. with newline and comma)', async () => {
            const code = `const myObj = {\n  prop1: "val1"\n};`;
            const builder = createCodeBuilder(code);
            const objBuilder = await getObjectBuilder(builder, 'myObj');
            assert.ok(objBuilder);

            objBuilder!.addPropertyIfMissing('prop2', '123');
            const result = await builder.toString();
            // Adjusted regex to expect newline between comma and next property if object was multi-line
            const expectedPattern = /prop1:\s*"val1",\s*\n\s*prop2:\s*123,\s*\n\s*};/;
            assert.ok(expectedPattern.test(result), `Result:\n${result}\nDid not match pattern: ${expectedPattern}`);
        });

        test('should add first property to empty object with correct formatting', async () => {
            const code = `const myObj = {};`; // Test with {}
            const builder1 = createCodeBuilder(code);
            const objBuilder1 = await getObjectBuilder(builder1, 'myObj');
            assert.ok(objBuilder1);

            objBuilder1!.addPropertyIfMissing('firstProp', '"hello"');
            const result1 = await builder1.toString();
            let expectedPattern1 = /{\s*firstProp:\s*"hello"\s*}/; // For {}
            assert.ok(expectedPattern1.test(result1), `Result 1:\n${result1}\nDid not match pattern: ${expectedPattern1}`);

            const code2 = `const myObj = {\n};`; // Test with { \n }
            const builder2 = createCodeBuilder(code2);
            const objBuilder2 = await getObjectBuilder(builder2, 'myObj');
            assert.ok(objBuilder2);

            objBuilder2!.addPropertyIfMissing('firstProp', '"hello"');
            const result2 = await builder2.toString();
            // Expected: const myObj = {\n  firstProp: "hello"\n};
            const expectedPattern2 = /{\s*\n\s*firstProp:\s*"hello"\s*\n\s*}/;
            assert.ok(expectedPattern2.test(result2), `Result 2:\n${result2}\nDid not match pattern: ${expectedPattern2}`);
        });
    });

    suite('findNestedProperty', () => {
        const nestedObjectCode = `
            const data = {
                name: "App",
                version: "1.0",
                config: {
                    user: "admin",
                    settings: {
                        theme: "dark",
                        notifications: true
                    }
                },
                users: [
                    { id: 1, name: "Alice", roles: ["editor", "viewer"] },
                    { id: 2, name: "Bob" }
                ],
                matrix: [[1, 2], [3, 4]],
                primitiveArray: [10, 20, 30]
            };
        `;

        async function findNestedPropPromise(
            objBuilder: TypeScriptObjectBuilder,
            path: string
        ): Promise<{ builder?: TypeScriptObjectBuilder | TypeScriptArrayBuilder; value?: string; start?: number; end?: number } | null> {
            return new Promise((resolve) => {
                objBuilder.findNestedProperty(path, {
                    onFound: (res) => resolve(res),
                    onNotFound: () => resolve(null)
                });
            });
        }


        test('should find a top-level primitive property', async () => {
            const builder = createCodeBuilder(nestedObjectCode);
            const objBuilder = await getObjectBuilder(builder, 'data');
            assert.ok(objBuilder);
            const result = await findNestedPropPromise(objBuilder!, 'version');
            assert.ok(result, 'Top-level property "version" not found by promise');
            assert.strictEqual(result!.value, '"1.0"');
            assert.ok(typeof result!.start === 'number');
            assert.ok(typeof result!.end === 'number');
            assert.ok(!result!.builder, "Should not return a builder for primitive");
        });

        test('should find a deeply nested primitive property', async () => {
            const builder = createCodeBuilder(nestedObjectCode);
            const objBuilder = await getObjectBuilder(builder, 'data');
            assert.ok(objBuilder);
            const result = await findNestedPropPromise(objBuilder!, 'config.settings.theme');
            assert.ok(result, 'Deeply nested property "config.settings.theme" not found');
            assert.strictEqual(result!.value, '"dark"');
        });

        test('should find a nested object and return its builder', async () => {
            const builder = createCodeBuilder(nestedObjectCode);
            const objBuilder = await getObjectBuilder(builder, 'data');
            assert.ok(objBuilder);
            const result = await findNestedPropPromise(objBuilder!, 'config.settings');
            assert.ok(result, 'Nested object "config.settings" not found');
            assert.ok(result!.builder instanceof TypeScriptObjectBuilder, "Should return an ObjectBuilder");
            assert.ok(!result!.value, "Should not return a primitive value for object");
            const settingsBuilder = result!.builder as TypeScriptObjectBuilder;
            assert.ok(settingsBuilder.getFullText().includes('theme: "dark"'));
        });

        test('should find an array and return its builder', async () => {
            const builder = createCodeBuilder(nestedObjectCode);
            const objBuilder = await getObjectBuilder(builder, 'data');
            assert.ok(objBuilder);
            const result = await findNestedPropPromise(objBuilder!, 'users');
            assert.ok(result, 'Array property "users" not found');
            assert.ok(result!.builder instanceof TypeScriptArrayBuilder, "Should return an ArrayBuilder");
            const arrayBuilder = result!.builder as TypeScriptArrayBuilder;
            assert.strictEqual(arrayBuilder.getItemCount(), 2);
        });

        test('should find an object within an array and return its builder', async () => {
            const builder = createCodeBuilder(nestedObjectCode);
            const objBuilder = await getObjectBuilder(builder, 'data');
            assert.ok(objBuilder);
            const result = await findNestedPropPromise(objBuilder!, 'users[0]');
            assert.ok(result, 'Object in array "users[0]" not found');
            assert.ok(result!.builder instanceof TypeScriptObjectBuilder, "Should return an ObjectBuilder for array item");
            const itemBuilder = result!.builder as TypeScriptObjectBuilder;

            const namePropResult = await findNestedPropPromise(itemBuilder, 'name');
            assert.ok(namePropResult, 'Property "name" in users[0] not found');
            assert.strictEqual(namePropResult!.value, '"Alice"');
        });

        test('should find a primitive property of an object within an array', async () => {
            const builder = createCodeBuilder(nestedObjectCode);
            const objBuilder = await getObjectBuilder(builder, 'data');
            assert.ok(objBuilder);
            const result = await findNestedPropPromise(objBuilder!, 'users[1].name');
            assert.ok(result, 'Primitive property "users[1].name" not found');
            assert.strictEqual(result!.value, '"Bob"');
        });

        test('should find a primitive element directly in an array', async () => {
            const builder = createCodeBuilder(nestedObjectCode);
            const objBuilder = await getObjectBuilder(builder, 'data');
            assert.ok(objBuilder);
            const result = await findNestedPropPromise(objBuilder!, 'primitiveArray[1]');
            assert.ok(result, 'Primitive array element "primitiveArray[1]" not found');
            assert.strictEqual(result!.value, '20');
            assert.ok(typeof result!.start === 'number');
            assert.ok(typeof result!.end === 'number');
        });

        test('should find a nested array within an array and return its builder', async () => {
            const builder = createCodeBuilder(nestedObjectCode);
            const objBuilder = await getObjectBuilder(builder, 'data');
            assert.ok(objBuilder);
            const result = await findNestedPropPromise(objBuilder!, 'matrix[1]');
            assert.ok(result, 'Nested array "matrix[1]" not found');
            assert.ok(result!.builder instanceof TypeScriptArrayBuilder);
            const subArrayBuilder = result!.builder as TypeScriptArrayBuilder;
            assert.strictEqual(subArrayBuilder.getItemTexts().join(','), '3,4');
        });


        test('should call onNotFound for a non-existent top-level property', async () => {
            const builder = createCodeBuilder(nestedObjectCode);
            const objBuilder = await getObjectBuilder(builder, 'data');
            assert.ok(objBuilder);
            const result = await findNestedPropPromise(objBuilder!, 'nonExistent');
            assert.strictEqual(result, null, 'Should return null for nonExistent property');
        });

        test('should call onNotFound for a non-existent nested property', async () => {
            const builder = createCodeBuilder(nestedObjectCode);
            const objBuilder = await getObjectBuilder(builder, 'data');
            assert.ok(objBuilder);
            const result = await findNestedPropPromise(objBuilder!, 'config.settings.nonExistent');
            assert.strictEqual(result, null, 'Should return null for nonExistent nested property');
        });

        test('should call onNotFound for an out-of-bounds array index', async () => {
            const builder = createCodeBuilder(nestedObjectCode);
            const objBuilder = await getObjectBuilder(builder, 'data');
            assert.ok(objBuilder);
            const result = await findNestedPropPromise(objBuilder!, 'users[5]');
            assert.strictEqual(result, null, 'Should return null for out-of-bounds array item');
        });

        test('should call onNotFound if path expects object but finds primitive', async () => {
            const builder = createCodeBuilder(nestedObjectCode);
            const objBuilder = await getObjectBuilder(builder, 'data');
            assert.ok(objBuilder);
            const result = await findNestedPropPromise(objBuilder!, 'name.something');
            assert.strictEqual(result, null, 'Should return null when proceeding past primitive');
        });
    });

    suite('traverseObjectTree', () => {
        const traverseCode = `
            const C = {
                p1: "v1",
                obj: {
                    p2: 123,
                    nestedArr: [true, { p3: "v3" }]
                },
                arr: ["a", "b"]
            };
        `;
        const variableNameForRootInTest = 'C'; // Or get it from objBuilder.objectGroup.name
        test('should traverse a complex object and call appropriate callbacks', async () => {
            const builder = createCodeBuilder(traverseCode);
            const objBuilder = await getObjectBuilder(builder, 'C'); // 'C' is the variable name
            assert.ok(objBuilder);

            const chapters: string[] = [];

            const simplifiedExpectedChapters = [
                "objEnter:C|C",
                "prop:C|p1|\"v1\"|primitive",
                "primitive:C|p1|\"v1\"",
                "prop:C|obj|{p2:123,nestedArr:[true,{p3:\"v3\"}]}|object",
                "objEnter:C.obj|obj", // Expected path for nested object 'obj'
                "prop:C.obj|p2|123|primitive",
                "primitive:C.obj|p2|123",
                "prop:C.obj|nestedArr|[true,{p3:\"v3\"}]|array",
                "arrEnter:C.obj.nestedArr|nestedArr", // Expected path for array 'nestedArr'
                "arrItem:C.obj.nestedArr.0|true|primitive",
                "arrItem:C.obj.nestedArr.1|{p3:\"v3\"}|object",
                "arrLeave:C.obj.nestedArr|nestedArr",
                "objLeave:C.obj|obj",
                "prop:C|arr|[\"a\",\"b\"]|array",
                "arrEnter:C.arr|arr", // Expected path for array 'arr'
                "arrItem:C.arr.0|\"a\"|primitive",
                "arrItem:C.arr.1|\"b\"|primitive",
                "arrLeave:C.arr|arr",
                "objLeave:C|C",
            ];

            // Pass 'C' as the initial currentObjectPath
            objBuilder!.traverseObjectTree({
                onProperty: (path, name, valueText, valueType) => {
                    // Use `path` directly. If path is empty for root, test output handles it.
                    chapters.push(`prop:${path || variableNameForRootInTest}|${name}|${valueText.replace(/\s+/g, '')}|${valueType}`);
                },
                onObjectEnter: (path, name) => {
                    chapters.push(`objEnter:${path || variableNameForRootInTest}|${name || variableNameForRootInTest}`);
                },
                onObjectLeave: (path, name) => {
                    chapters.push(`objLeave:${path || variableNameForRootInTest}|${name || variableNameForRootInTest}`);
                },
                onArrayEnter: (path, name) => {
                    chapters.push(`arrEnter:${path || variableNameForRootInTest}|${name}`);
                },
                onArrayLeave: (path, name) => {
                    chapters.push(`arrLeave:${path || variableNameForRootInTest}|${name}`);
                },
                onArrayItem: (path, index, itemText, itemType) => {
                    // Path is to the array. Item path is constructed like arrayPath.[index]
                    chapters.push(`arrItem:${path}.${index}|${itemText.replace(/\s+/g, '')}|${itemType}`);
                },
                onPrimitive: (path, name, valueText) => {
                    chapters.push(`primitive:${path || variableNameForRootInTest}|${name}|${valueText.replace(/\s+/g, '')}`);
                },
            }, 'C'); // <--- IMPORTANT: Provide 'C' as the initial path

            assert.deepStrictEqual(chapters, simplifiedExpectedChapters, "Traversal chapters did not match expected sequence.");
        });

        test('should handle an empty object', async () => {
            const builder = createCodeBuilder("const E = {};");
            const objBuilder = await getObjectBuilder(builder, 'E');
            assert.ok(objBuilder);
            const chapters: string[] = [];
            objBuilder!.traverseObjectTree({
                onObjectEnter: (path, name) => chapters.push(`objEnter:${path || 'E'}|${name || 'E'}`),
                onObjectLeave: (path, name) => chapters.push(`objLeave:${path || 'E'}|${name || 'E'}`),
                onProperty: () => chapters.push('prop'),
            });
            assert.deepStrictEqual(chapters, ["objEnter:E|E", "objLeave:E|E"]); // Corrected expected path
        });

        test('should correctly identify types for onProperty and onArrayItem', async () => {
            const code = `const M = { str: "s", num: 1, bool: true, obj: {}, arr: [] };`;
            const builder = createCodeBuilder(code);
            const objBuilder = await getObjectBuilder(builder, 'M');
            assert.ok(objBuilder);
            const propTypes: any = {};

            objBuilder!.traverseObjectTree({
                onProperty: (path, name, valueText, valueType) => {
                    propTypes[name] = valueType;
                }
            });

            assert.strictEqual(propTypes['str'], 'primitive');
            assert.strictEqual(propTypes['num'], 'primitive');
            assert.strictEqual(propTypes['bool'], 'primitive');
            assert.strictEqual(propTypes['obj'], 'object');
            assert.strictEqual(propTypes['arr'], 'array');
        });
    });
});