import * as assert from 'assert';
import { TypeScriptCodeBuilder, TypeScriptTypeObjectBuilder } from '../typescriptObjectParser/ObjectParser';
import { TypeScriptTypeDeclarationBuilder } from '../typescriptObjectParser/TypeScriptTypeDeclarationBuilder';

suite('TypeScriptTypeDeclarationBuilder', () => {

    // Corrected helper function: Accepts a codeBuilder instance instead of creating one.
    // This ensures that edits are applied to the correct builder instance within each test.
    async function createTypeDeclarationBuilder(
        codeBuilder: TypeScriptCodeBuilder,
        typeName: string
    ): Promise<TypeScriptTypeDeclarationBuilder | null> {
        return new Promise((resolve) => {
            // Assumes a method like findTypeDeclaration exists on the builder
            codeBuilder.findTypeDeclaration(typeName, {
                onFound: (typeBuilder) => resolve(typeBuilder),
                onNotFound: () => resolve(null)
            });
        });
    }

    suite('getName', () => {
        test('should return the correct type name', async () => {
            const typeDeclaration = 'type MyType = string;';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'MyType');

            assert.ok(builder, 'Builder should be created');
            assert.strictEqual(builder!.getName(), 'MyType', 'Should return correct type name');
        });

        test('should return name for complex type', async () => {
            const typeDeclaration = 'type ComplexType<T> = { prop: T };';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'ComplexType');

            assert.ok(builder, 'Builder should be created');
            assert.strictEqual(builder!.getName(), 'ComplexType', 'Should return correct type name');
        });
    });

    suite('getTypeDefinition', () => {
        test('should return simple type definition', async () => {
            const typeDeclaration = 'type SimpleType = string;';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'SimpleType');

            assert.ok(builder, 'Builder should be created');
            const definition = builder!.getTypeDefinition();
            assert.ok(definition.includes('string'), 'Should include string type');
        });

        test('should return complex object type definition', async () => {
            const typeDeclaration = 'type ObjectType = { prop1: string; prop2: number; };';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'ObjectType');

            assert.ok(builder, 'Builder should be created');
            const definition = builder!.getTypeDefinition();
            assert.ok(definition.includes('prop1'), 'Should include prop1');
            assert.ok(definition.includes('prop2'), 'Should include prop2');
        });
    });

    suite('isObjectType', () => {
        test('should return true for object type', async () => {
            const typeDeclaration = 'type ObjectType = { prop: string; };';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'ObjectType');

            assert.ok(builder, 'Builder should be created');
            assert.strictEqual(builder!.isObjectType(), true, 'Should be identified as object type');
        });

        test('should return false for simple type', async () => {
            const typeDeclaration = 'type SimpleType = string;';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'SimpleType');

            assert.ok(builder, 'Builder should be created');
            assert.strictEqual(builder!.isObjectType(), false, 'Should not be identified as object type');
        });
    });

    suite('isUnionType', () => {
        test('should return true for union type', async () => {
            const typeDeclaration = 'type UnionType = string | number;';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'UnionType');

            assert.ok(builder, 'Builder should be created');
            assert.strictEqual(builder!.isUnionType(), true, 'Should be identified as union type');
        });

        test('should return false for object type', async () => {
            const typeDeclaration = 'type ObjectType = { prop: string; };';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'ObjectType');

            assert.ok(builder, 'Builder should be created');
            assert.strictEqual(builder!.isUnionType(), false, 'Should not be identified as union type');
        });
    });

    suite('getUnionTypes', () => {
        test('should return array of union type members', async () => {
            const typeDeclaration = 'type Status = "active" | "inactive" | "pending";';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'Status');

            assert.ok(builder, 'Builder should be created');
            const unionTypes = builder!.getUnionTypes();
            assert.deepStrictEqual(unionTypes, ['"active"', '"inactive"', '"pending"'], 'Should return correct union members');
        });

        test('should return single element array for non-union type', async () => {
            const typeDeclaration = 'type SimpleType = string;';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'SimpleType');

            assert.ok(builder, 'Builder should be created');
            const unionTypes = builder!.getUnionTypes();
            assert.deepStrictEqual(unionTypes, ['string'], 'Should return an array with the single type');
        });
    });

    suite('addUnionType', () => {
        test('should add type to existing union', async () => {
            const typeDeclaration = 'type Status = "active" | "inactive";';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'Status');

            assert.ok(builder, 'Builder should be created');
            builder!.addUnionType('"pending"');

            const result = await codeBuilder.toString();
            assert.strictEqual(result.trim(), 'type Status = "active" | "inactive" | "pending";', 'Should add new type to union');
        });

        test('should convert simple type to union', async () => {
            const typeDeclaration = 'type SimpleType = string;';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'SimpleType');

            assert.ok(builder, 'Builder should be created');
            builder!.addUnionType('number');

            const result = await codeBuilder.toString();
            assert.strictEqual(result.trim(), 'type SimpleType = string | number;', 'Should create a new union type');
        });

        test('should not add duplicate type to union', async () => {
            const typeDeclaration = 'type Status = "active" | "inactive";';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'Status');

            assert.ok(builder, 'Builder should be created');
            builder!.addUnionType('"active"'); // Adding existing type

            const result = await codeBuilder.toString();
            assert.strictEqual(result.trim(), 'type Status = "active" | "inactive";', 'Should not duplicate existing type');
        });
    });

    suite('removeUnionType', () => {
        test('should remove type from union', async () => {
            const typeDeclaration = 'type Status = "active" | "inactive" | "pending";';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'Status');

            assert.ok(builder, 'Builder should be created');
            const success = builder!.removeUnionType('"inactive"');
            assert.strictEqual(success, true, 'Should return true for successful removal');

            const result = await codeBuilder.toString();
            assert.strictEqual(result.trim(), 'type Status = "active" | "pending";', 'Should remove the specified type');
        });

        test('should return false for non-existent type', async () => {
            const typeDeclaration = 'type Status = "active" | "inactive";';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'Status');

            assert.ok(builder, 'Builder should be created');
            const success = builder!.removeUnionType('"nonexistent"');
            assert.strictEqual(success, false, 'Should return false for non-existent type');
        });

        test('should convert to single type when only one remains', async () => {
            const typeDeclaration = 'type Status = "active" | "inactive";';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'Status');

            assert.ok(builder, 'Builder should be created');
            builder!.removeUnionType('"inactive"');

            const result = await codeBuilder.toString();
            assert.strictEqual(result.trim(), 'type Status = "active";', 'Should contain only the remaining type without a union operator');
        });
    });

    suite('setTypeDefinition', () => {
        // NOTE: The incorrect, local version of the helper was removed from this suite.

        test('should replace simple type definition', async () => {
            const typeDeclaration = 'type MyType = string;';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'MyType');

            assert.ok(builder, 'Builder should be created');
            builder!.setTypeDefinition('number');

            const result = await codeBuilder.toString();
            assert.strictEqual(result.trim(), 'type MyType = number;', 'The entire type definition should be replaced.');
        });

        test('should replace complex type definition', async () => {
            const typeDeclaration = 'type MyType = { old: string; };';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'MyType');

            assert.ok(builder, 'Builder should be created');
            builder!.setTypeDefinition('{ new: number; updated: boolean; }');

            const result = await codeBuilder.toString();
            assert.strictEqual(result.trim(), 'type MyType = { new: number; updated: boolean; };', 'Should replace the object definition');
        });
    });

    suite('addProperty', () => {
        test('should add property to object type', async () => {
            const typeDeclaration = 'type MyType = { existing: string; };';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'MyType');

            assert.ok(builder, 'Builder should be created');
            builder!.addProperty('newProp', 'number');

            const result = await codeBuilder.toString();
            assert.ok(result.includes('newProp: number;'), 'Should contain new property');
            assert.ok(result.includes('existing: string;'), 'Should retain existing property');
        });

        test('should add optional property', async () => {
            const typeDeclaration = 'type MyType = {};';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'MyType');

            assert.ok(builder, 'Builder should be created');
            builder!.addProperty('optionalProp', 'string', { optional: true });

            const result = await codeBuilder.toString();
            assert.ok(result.includes('optionalProp?: string;'), 'Should contain optional property marker');
        });
        
        test('should add property with complex options', async () => {
            const typeDeclaration = 'type MyType = {};';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'MyType');

            assert.ok(builder, 'Builder should be created');
            builder!.addProperty('complexProp', 'Base', { 
                optional: true, 
                partial: true, 
                intersection: ['MixinA'], 
                union: ['MixinB'] 
            });

            const result = await codeBuilder.toString();
            const expected = 'complexProp?: Partial<Base & MixinA | MixinB>;';
            assert.ok(result.includes(expected), `Should contain complex property. Got: ${result}`);
        });

        test('should not throw when adding property to non-object type', async () => {
            const typeDeclaration = 'type SimpleType = string;';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'SimpleType');
            
            assert.ok(builder, 'Builder should be created');

            assert.doesNotThrow(() => {
                builder!.addProperty('newProp', 'number');
            }, 'Should not throw');

            const result = await codeBuilder.toString();
            assert.strictEqual(result.trim(), typeDeclaration, "Non-object type should remain unchanged");
        });
    });

    suite('findNestedTypeObject', () => {
        test('should find root level object and allow edits', async () => {
            const typeDeclaration = 'type MyType = { prop: string; };';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'MyType');

            assert.ok(builder, 'Builder should be created');

            let wasFoundAndEdited = false;
            await new Promise<void>((resolve) => {
                builder!.findNestedTypeObject([], {
                    onFound: (objectBuilder) => {
                        objectBuilder.addProperty('newProp', 'number');
                        wasFoundAndEdited = true;
                        resolve();
                    },
                    onNotFound: resolve
                });
            });

            assert.strictEqual(wasFoundAndEdited, true, 'Should find root object and execute callback');
            const result = await codeBuilder.toString();
            assert.ok(result.includes('newProp: number;'), 'Modification should be applied');
        });

        test('should find deeply nested object and allow edits', async () => {
            const typeDeclaration = 'type MyType = { l1: { l2: { prop: string; }; }; };';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'MyType');

            assert.ok(builder, 'Builder should be created');

            let wasFoundAndEdited = false;
            await new Promise<void>((resolve) => {
                builder!.findNestedTypeObject(['l1', 'l2'], {
                    onFound: (objectBuilder) => {
                        objectBuilder.addProperty('newProp', 'number');
                        wasFoundAndEdited = true;
                        resolve();
                    },
                    onNotFound: resolve
                });
            });

            assert.strictEqual(wasFoundAndEdited, true, 'Should find nested object');
            const result = await codeBuilder.toString();
            assert.ok(result.includes('newProp: number;'), 'Modification should be applied to nested object');
        });

        test('should call onNotFound for non-existent path', async () => {
            const typeDeclaration = 'type MyType = { section: { nested: string; }; };';
            const codeBuilder = new TypeScriptCodeBuilder(typeDeclaration);
            const builder = await createTypeDeclarationBuilder(codeBuilder, 'MyType');

            assert.ok(builder, 'Builder should be created');
            let wasNotFound = false;

            await new Promise<void>((resolve) => {
                builder!.findNestedTypeObject(['nonexistent'], {
                    onFound: () => resolve(),
                    onNotFound: () => {
                        wasNotFound = true;
                        resolve();
                    }
                });
            });

            assert.strictEqual(wasNotFound, true, 'Should call onNotFound for a non-existent path');
        });
    });

    suite('Integration with TypeScriptCodeBuilder.findTypeDeclaration', () => {
        test('should integrate for real-world usage', async () => {
            const code = `
                type TWorldState = {
                    characters: {
                        thomas: { ref: TCharacter<'thomas'> } & TCharacterData;
                    };
                };
            `;
            const codeBuilder = new TypeScriptCodeBuilder(code);

            await new Promise<void>((resolve) => {
                codeBuilder.findTypeDeclaration('TWorldState', {
                    onFound: (typeBuilder) => {
                        typeBuilder.findNestedTypeObject(['characters'], {
                            onFound: (charactersBuilder) => {
                                charactersBuilder.addProperty('newCharacter', '{ ref: TCharacter<"newCharacter"> } & TCharacterData');
                                resolve();
                            },
                            onNotFound: resolve
                        });
                    },
                    onNotFound: resolve
                });
            });

            const result = await codeBuilder.toString();
            assert.ok(result.includes('newCharacter'), 'Should contain the newly added character');
            assert.ok(result.includes('thomas'), 'Should retain the original character');
        });
    });
});
