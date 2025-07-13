import * as assert from 'assert';
import { TypeScriptCodeBuilder } from '../typescriptObjectParser/ObjectParser';
import { TypeScriptObjectBuilder } from "../typescriptObjectParser/TypeScriptObjectBuilder";

suite('TypeScriptObjectBuilder.setPropertyValue - Indentation Tests', () => {

    // Helper function to create an object builder for testing
    function createObjectBuilderForProperty(codeBuilder: TypeScriptCodeBuilder, variableName: string = 'obj'): Promise<TypeScriptObjectBuilder> {
        return new Promise<TypeScriptObjectBuilder>((resolve, reject) => {
            codeBuilder.findObject(variableName, {
                onFound: (builder) => resolve(builder),
                onNotFound: () => reject(new Error(`Object '${variableName}' not found`))
            });
        });
    }

    // Fixed helper function to get the final result after property modification
    async function testPropertyModification(
        originalCode: string,
        variableName: string,
        propertyName: string,
        newValue: string
    ): Promise<string> {
        const codeBuilder = new TypeScriptCodeBuilder(originalCode);
        const objectBuilder = await createObjectBuilderForProperty(codeBuilder, variableName); // Use same instance
        objectBuilder.setPropertyValue(propertyName, newValue);
        return await codeBuilder.toString(); // Call toString on the same instance
    }

    // Example of how the test should work now:
    suite('TypeScriptObjectBuilder.setPropertyValue - Fixed Tests', () => {
        test('should add first property to completely empty object', async () => {
            const originalCode = `const obj = {};`;
            const result = await testPropertyModification(originalCode, 'obj', 'first', 'value');

            assert.strictEqual(result, `const obj = {first: value};`, 'Should add property without extra spaces in empty object');
        });

        test('should add property to single-line object with existing property', async () => {
            const originalCode = `const obj = { existing: 'value' };`;
            const result = await testPropertyModification(originalCode, 'obj', 'newProp', 'newValue');

            assert.strictEqual(result, `const obj = { existing: 'value', newProp: newValue };`, 'Should add property with proper comma spacing in single-line object');
        });
    });
    suite('Empty Object Handling', () => {
        test('should add first property to completely empty object', async () => {
            const originalCode = `const obj = {};`;
            const result = await testPropertyModification(originalCode, 'obj', 'first', 'value');

            assert.strictEqual(result, `const obj = {first: value};`, 'Should add property without extra spaces in empty object');
        });

        test('should add first property to object with spaces', async () => {
            const originalCode = `const obj = { };`;
            const result = await testPropertyModification(originalCode, 'obj', 'first', 'value');

            assert.strictEqual(result, `const obj = { first: value };`, 'Should preserve space padding when adding to spaced empty object');
        });

        test('should add first property to object with newlines (formatted empty object)', async () => {
            const originalCode = `const obj = {
};`;
            const result = await testPropertyModification(originalCode, 'obj', 'first', 'value');

            const expected = `const obj = {
    first: value
};`;
            assert.strictEqual(result, expected, 'Should add property with proper indentation to formatted empty object');
        });

        test('should add first property to object with custom indentation', async () => {
            const originalCode = `const obj = {
  };`; // 2-space indentation
            const result = await testPropertyModification(originalCode, 'obj', 'first', 'value');

            const expected = `const obj = {
  first: value
};`;
            assert.strictEqual(result, expected, 'Should detect and use existing 2-space indentation');
        });
    });

    suite('Single-line Object Handling', () => {
        test('should add property to single-line object with existing property', async () => {
            const originalCode = `const obj = { existing: 'value' };`;
            const result = await testPropertyModification(originalCode, 'obj', 'newProp', 'newValue');

            assert.strictEqual(result, `const obj = { existing: 'value', newProp: newValue };`, 'Should add property with proper comma spacing in single-line object');
        });

        test('should add property to single-line object with trailing comma', async () => {
            const originalCode = `const obj = { existing: 'value', };`;
            const result = await testPropertyModification(originalCode, 'obj', 'newProp', 'newValue');

            assert.strictEqual(result, `const obj = { existing: 'value', newProp: newValue };`, 'Should handle existing trailing comma correctly');
        });

        test('should replace existing property in single-line object', async () => {
            const originalCode = `const obj = { existing: 'oldValue', other: 'value' };`;
            const result = await testPropertyModification(originalCode, 'obj', 'existing', 'newValue');

            assert.strictEqual(result, `const obj = { existing: newValue, other: 'value' };`, 'Should replace property value without affecting formatting');
        });
    });

    suite('Multi-line Object with 4-space Indentation', () => {
        test('should add property to multi-line object with consistent 4-space indentation', async () => {
            const originalCode = `const obj = {
    prop1: 'value1',
    prop2: 'value2'
};`;
            const result = await testPropertyModification(originalCode, 'obj', 'prop3', 'value3');

            const expected = `const obj = {
    prop1: 'value1',
    prop2: 'value2',
    prop3: value3
};`;
            assert.strictEqual(result, expected, 'Should add property with consistent 4-space indentation');
        });

        test('should add property to multi-line object with trailing comma', async () => {
            const originalCode = `const obj = {
    prop1: 'value1',
    prop2: 'value2',
};`;
            const result = await testPropertyModification(originalCode, 'obj', 'prop3', 'value3');

            const expected = `const obj = {
    prop1: 'value1',
    prop2: 'value2',
    prop3: value3
};`;
            assert.strictEqual(result, expected, 'Should handle trailing comma and add with proper indentation');
        });

        test('should replace property in multi-line object maintaining indentation', async () => {
            const originalCode = `const obj = {
    prop1: 'value1',
    prop2: 'oldValue',
    prop3: 'value3'
};`;
            const result = await testPropertyModification(originalCode, 'obj', 'prop2', 'newValue');

            const expected = `const obj = {
    prop1: 'value1',
    prop2: newValue,
    prop3: 'value3'
};`;
            assert.strictEqual(result, expected, 'Should replace property without affecting indentation');
        });
    });

    suite('Multi-line Object with 2-space Indentation', () => {
        test('should add property to multi-line object with 2-space indentation', async () => {
            const originalCode = `const obj = {
  prop1: 'value1',
  prop2: 'value2'
};`;
            const result = await testPropertyModification(originalCode, 'obj', 'prop3', 'value3');

            const expected = `const obj = {
  prop1: 'value1',
  prop2: 'value2',
  prop3: value3
};`;
            assert.strictEqual(result, expected, 'Should detect and use 2-space indentation');
        });
    });

    suite('Multi-line Object with Tab Indentation', () => {
        test('should add property to multi-line object with tab indentation', async () => {
            const originalCode = `const obj = {
\tprop1: 'value1',
\tprop2: 'value2'
};`;
            const result = await testPropertyModification(originalCode, 'obj', 'prop3', 'value3');

            const expected = `const obj = {
\tprop1: 'value1',
\tprop2: 'value2',
\tprop3: value3
};`;
            assert.strictEqual(result, expected, 'Should detect and use tab indentation');
        });
    });

    suite('Complex Real-world Example', () => {
        test('should handle the register object example correctly', async () => {
            const originalCode = `export const register = {
    characters: {
        thomas: Thomas,
        annie: Annie,
    },
    sideCharacters: {
        franta: Franta,
        nobleMan: NobleMan,
    },
    events: {
    	village: villageEvent,
        kingdom: kingdomEvent,
    	wedding: weddingEvent,
    },
    locations: {
    	village: villageLocation,
    	kingdom: kingdomLocation,
    },
} as const;`;

            const codeBuilder = new TypeScriptCodeBuilder(originalCode);

            // Find the events object within the register
            let eventsBuilder: TypeScriptObjectBuilder | null = null;
            codeBuilder.findObject('register', {
                onFound: (registerBuilder) => {
                    registerBuilder.findObject('events', {
                        onFound: (builder) => { eventsBuilder = builder; },
                        onNotFound: () => { /* ignore */ }
                    });
                },
                onNotFound: () => { /* ignore */ }
            });

            assert.ok(eventsBuilder, 'Should find events object');

            if (eventsBuilder) {
                (eventsBuilder as TypeScriptObjectBuilder).setPropertyValue('gegas', 'gegasEvent');

                const result = await codeBuilder.toString();

                // The new property should be indented consistently with existing properties
                // Looking at the existing events object, it uses mixed indentation
                // The method should detect the predominant pattern
                assert.ok(result.includes('gegas: gegasEvent'), 'Should add the gegas property');

                // Check that the indentation is consistent
                const lines = result.split('\n');
                const eventsLine = lines.findIndex(line => line.includes('events: {'));
                const gegasLine = lines.findIndex(line => line.includes('gegas: gegasEvent'));

                assert.ok(eventsLine !== -1, 'Should find events line');
                assert.ok(gegasLine !== -1, 'Should find gegas line');
                assert.ok(gegasLine > eventsLine, 'gegas should be after events line');

                // Check that gegas line has reasonable indentation (not excessive)
                const gegasIndentation = lines[gegasLine].match(/^(\s*)/)?.[1] || '';
                assert.ok(gegasIndentation.length <= 12, 'Indentation should not be excessive (max 12 chars for nested object)');
                assert.ok(gegasIndentation.length >= 4, 'Should have some indentation for nested property');
            }
        });
    });

    suite('Nested Object Indentation', () => {
        test('should handle deeply nested objects correctly', async () => {
            const originalCode = `const config = {
    database: {
        host: 'localhost',
        port: 5432
    },
    cache: {
        redis: {
            host: 'localhost',
            port: 6379
        }
    }
};`;

            const codeBuilder = new TypeScriptCodeBuilder(originalCode);

            // Find the redis object
            let redisBuilder: TypeScriptObjectBuilder | null = null;
            codeBuilder.findObject('config', {
                onFound: (configBuilder) => {
                    configBuilder.findObject('cache', {
                        onFound: (cacheBuilder) => {
                            cacheBuilder.findObject('redis', {
                                onFound: (builder) => { redisBuilder = builder; },
                                onNotFound: () => { /* ignore */ }
                            });
                        },
                        onNotFound: () => { /* ignore */ }
                    });
                },
                onNotFound: () => { /* ignore */ }
            });

            assert.ok(redisBuilder, 'Should find redis object');

            if (redisBuilder) {
                (redisBuilder as TypeScriptObjectBuilder).setPropertyValue('password', "'secret'");

                const result = await codeBuilder.toString();

                const expected = `const config = {
    database: {
        host: 'localhost',
        port: 5432
    },
    cache: {
        redis: {
            host: 'localhost',
            port: 6379,
            password: 'secret'
        }
    }
};`;

                assert.strictEqual(result, expected, 'Should maintain proper nested indentation');
            }
        });
    });

    suite('Object with No Closing Newline', () => {
        test('should handle objects without newline before closing brace', async () => {
            const originalCode = `const obj = {
    prop1: 'value1',
    prop2: 'value2'};`;

            const result = await testPropertyModification(originalCode, 'obj', 'prop3', 'value3');

            const expected = `const obj = {
    prop1: 'value1',
    prop2: 'value2',
    prop3: value3
};`;

            assert.strictEqual(result, expected, 'Should handle objects without newline before closing brace');
        });
    });

    suite('Edge Cases', () => {
        test('should handle object with only whitespace between braces', async () => {
            const originalCode = `const obj = {   
  
};`;
            const result = await testPropertyModification(originalCode, 'obj', 'first', 'value');

            // Should treat this as a formatted empty object and add proper indentation
            const expected = `const obj = {
  first: value
};`;
            assert.strictEqual(result, expected, 'Should handle whitespace-only content properly');
        });

        test('should handle property with complex value', async () => {
            const originalCode = `const obj = {
    simple: 'value'
};`;
            const result = await testPropertyModification(originalCode, 'obj', 'complex', '{ nested: { deep: "value" } }');

            const expected = `const obj = {
    simple: 'value',
    complex: { nested: { deep: "value" } }
};`;
            assert.strictEqual(result, expected, 'Should handle complex property values with proper indentation');
        });

        test('should preserve existing property order when replacing', async () => {
            const originalCode = `const obj = {
    first: 'value1',
    middle: 'oldValue',
    last: 'value3'
};`;
            const result = await testPropertyModification(originalCode, 'obj', 'middle', 'newValue');

            const expected = `const obj = {
    first: 'value1',
    middle: newValue,
    last: 'value3'
};`;
            assert.strictEqual(result, expected, 'Should replace property without changing order or indentation');
        });
    });

    suite('Indentation Detection Edge Cases', () => {
        test('should fallback to 4-space indentation when detection fails', async () => {
            // Create an object where indentation detection might be ambiguous
            const originalCode = `const obj = {
prop1: 'value1'
};`; // No indentation on the property line

            const result = await testPropertyModification(originalCode, 'obj', 'prop2', 'value2');

            // Should fallback to a reasonable default (4 spaces)
            const expected = `const obj = {
prop1: 'value1',
    prop2: value2
};`;
            assert.strictEqual(result, expected, 'Should use default indentation when detection fails');
        });
    });
});