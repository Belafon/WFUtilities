import * as assert from 'assert';
import { TypeScriptCodeBuilder } from '../typescriptObjectParser/ObjectParser';

/**
 * Tests for import statement handling in TypeScriptCodeBuilder
 */
suite('Import Statement Tests', () => {

    suite('Import Declaration Parsing', () => {

        test('Should parse simple import statements', () => {
            const code = `import { test } from './test';
const variable = 42;`;
            
            const builder = new TypeScriptCodeBuilder(code);
            
            // @ts-expect-error Accessing private member for test verification
            const rootGroup = builder.rootGroup;
            assert.ok(rootGroup, 'Root group should exist');
            assert.strictEqual(rootGroup.children.length, 2, 'Should find 2 top-level elements: import and variable');
            
            const importDecl = rootGroup.children[0];
            const variableDecl = rootGroup.children[1];
            
            assert.strictEqual(importDecl.type, 'ImportDeclaration', 'First element should be import declaration');
            assert.strictEqual(variableDecl.type, 'VariableDeclaration', 'Second element should be variable declaration');
        });

        test('Should parse multiple import statements', () => {
            const code = `import { first } from './first';
import { second } from './second';
import { third } from './third';
const variable = 42;`;
            
            const builder = new TypeScriptCodeBuilder(code);
            
            // @ts-expect-error Accessing private member for test verification
            const rootGroup = builder.rootGroup;
            assert.ok(rootGroup, 'Root group should exist');
            assert.strictEqual(rootGroup.children.length, 4, 'Should find 4 top-level elements: 3 imports and 1 variable');
            
            assert.strictEqual(rootGroup.children[0].type, 'ImportDeclaration', '1st element should be import');
            assert.strictEqual(rootGroup.children[1].type, 'ImportDeclaration', '2nd element should be import');
            assert.strictEqual(rootGroup.children[2].type, 'ImportDeclaration', '3rd element should be import');
            assert.strictEqual(rootGroup.children[3].type, 'VariableDeclaration', '4th element should be variable');
        });

        test('Should extract import path and specifiers', () => {
            const code = `import { functionName, ClassName } from './module';`;
            
            const builder = new TypeScriptCodeBuilder(code);
            
            // @ts-expect-error Accessing private member for test verification
            const rootGroup = builder.rootGroup;
            assert.ok(rootGroup, 'Root group should exist');
            const importDecl = rootGroup.children[0];
            
            assert.strictEqual(importDecl.type, 'ImportDeclaration', 'Should be import declaration');
            assert.ok(importDecl.metadata?.importPath, 'Should have import path');
            assert.strictEqual(importDecl.metadata.importPath, './module', 'Should extract correct path');
            assert.ok(importDecl.metadata?.importSpecifiers, 'Should have import specifiers');
            assert.ok(importDecl.metadata.importSpecifiers.includes('functionName'), 'Should include functionName');
            assert.ok(importDecl.metadata.importSpecifiers.includes('ClassName'), 'Should include ClassName');
        });

        test('Should handle default imports', () => {
            const code = `import defaultExport from './module';`;
            
            const builder = new TypeScriptCodeBuilder(code);
            
            // @ts-expect-error Accessing private member for test verification
            const rootGroup = builder.rootGroup;
            assert.ok(rootGroup, 'Root group should exist');
            const importDecl = rootGroup.children[0];
            
            assert.strictEqual(importDecl.type, 'ImportDeclaration', 'Should be import declaration');
            assert.strictEqual(importDecl.metadata?.importPath, './module', 'Should extract correct path');
            assert.ok(importDecl.metadata?.importSpecifiers?.includes('defaultExport'), 'Should include default export name');
        });

        test('Should handle namespace imports', () => {
            const code = `import * as namespace from './module';`;
            
            const builder = new TypeScriptCodeBuilder(code);
            
            // @ts-expect-error Accessing private member for test verification
            const rootGroup = builder.rootGroup;
            assert.ok(rootGroup, 'Root group should exist');
            const importDecl = rootGroup.children[0];
            
            assert.strictEqual(importDecl.type, 'ImportDeclaration', 'Should be import declaration');
            assert.strictEqual(importDecl.metadata?.importPath, './module', 'Should extract correct path');
        });
    });

    suite('insertCodeAtIndex with imports', () => {

        test('Should insert new import at index 0 (beginning of file)', async () => {
            const initialCode = `import { existing } from './existing';
const variable = 42;`;
            
            const newImport = `import { newFunction } from './new';`;
            
            const builder = new TypeScriptCodeBuilder(initialCode);
            builder.insertCodeAtIndex(0, newImport);
            
            const result = await builder.toString();
            
            // The new import should be inserted at the very beginning
            assert.ok(result.startsWith(newImport), 'New import should be at the beginning');
            assert.ok(result.includes('existing'), 'Original import should still be present');
            assert.ok(result.includes('const variable'), 'Variable should still be present');
            
            // Check ordering: new import should come before existing import
            const newImportPos = result.indexOf('newFunction');
            const existingImportPos = result.indexOf('existing');
            assert.ok(newImportPos < existingImportPos, 'New import should come before existing import');
        });

        test('Should insert import between existing imports', async () => {
            const initialCode = `import { first } from './first';
import { third } from './third';
const variable = 42;`;
            
            const newImport = `import { second } from './second';`;
            
            const builder = new TypeScriptCodeBuilder(initialCode);
            builder.insertCodeAtIndex(1, newImport); // Insert after first import
            
            const result = await builder.toString();
            
            // Check all imports are present
            assert.ok(result.includes('first'), 'First import should be present');
            assert.ok(result.includes('second'), 'Second import should be present');
            assert.ok(result.includes('third'), 'Third import should be present');
            
            // Check ordering
            const firstPos = result.indexOf('first');
            const secondPos = result.indexOf('second');
            const thirdPos = result.indexOf('third');
            
            assert.ok(firstPos < secondPos, 'First should come before second');
            assert.ok(secondPos < thirdPos, 'Second should come before third');
        });

        test('Should insert import after all existing imports', async () => {
            const initialCode = `import { first } from './first';
import { second } from './second';
const variable = 42;`;
            
            const newImport = `import { third } from './third';`;
            
            const builder = new TypeScriptCodeBuilder(initialCode);
            builder.insertCodeAtIndex(2, newImport); // Insert after second import, before variable
            
            const result = await builder.toString();
            
            // Check all imports are present
            assert.ok(result.includes('first'), 'First import should be present');
            assert.ok(result.includes('second'), 'Second import should be present');
            assert.ok(result.includes('third'), 'Third import should be present');
            
            // Check that variable comes after all imports
            const thirdPos = result.indexOf('third');
            const variablePos = result.indexOf('const variable');
            
            assert.ok(thirdPos < variablePos, 'Third import should come before variable');
        });

        test('Should handle file with no existing imports', async () => {
            const initialCode = `const variable = 42;
class MyClass {}`;
            
            const newImport = `import { test } from './test';`;
            
            const builder = new TypeScriptCodeBuilder(initialCode);
            builder.insertCodeAtIndex(0, newImport); // Insert at beginning
            
            const result = await builder.toString();
            
            // New import should be at the beginning
            assert.ok(result.startsWith(newImport), 'New import should be at the beginning');
            assert.ok(result.includes('const variable'), 'Variable should still be present');
            assert.ok(result.includes('class MyClass'), 'Class should still be present');
        });

        test('Should maintain proper formatting when inserting imports', async () => {
            const initialCode = `import { existing } from './existing';

const variable = 42;`;
            
            const newImport = `import { newFunction } from './new';`;
            
            const builder = new TypeScriptCodeBuilder(initialCode);
            builder.insertCodeAtIndex(0, newImport);
            
            const result = await builder.toString();
            
            // Check that there are proper newlines
            const lines = result.split('\n');
            assert.ok(lines.length >= 4, 'Should have at least 4 lines');
            
            // First line should be new import
            assert.ok(lines[0].includes('newFunction'), 'First line should be new import');
            
            // Should have proper spacing
            assert.ok(result.includes('\n\n'), 'Should maintain spacing between sections');
        });
    });

    suite('Real-world scenario: RegisterFileManager use case', () => {

        test('Should correctly handle the register.ts file structure', async () => {
            // This mimics the actual register.ts file structure
            const registerCode = `import { kingdomLocation } from './locations/kingdom.location';
import { weddingChapter } from './chapters/wedding/wedding.chapter';
import { Annie } from './characters/annie';

export const register = {
    characters: {
        annie: Annie,
    },
    chapters: {
        wedding: weddingChapter,
    },
    locations: {
        kingdom: kingdomLocation,
    },
} as const;`;

            const newImport = `import { asdfChapter } from '/home/belafon/Downloads/story/src/data/chapters/asdf/asdf.chapter.ts';`;
            
            const builder = new TypeScriptCodeBuilder(registerCode);
            
            // Test that we can parse the structure correctly
            // @ts-expect-error Accessing private member for test verification
            const rootGroup = builder.rootGroup;
            assert.ok(rootGroup, 'Root group should exist');
            
            // Should find 3 imports + 1 export
            assert.strictEqual(rootGroup.children.length, 4, 'Should find 4 top-level elements');
            
            // First three should be imports
            assert.strictEqual(rootGroup.children[0].type, 'ImportDeclaration', '1st should be import');
            assert.strictEqual(rootGroup.children[1].type, 'ImportDeclaration', '2nd should be import');
            assert.strictEqual(rootGroup.children[2].type, 'ImportDeclaration', '3rd should be import');
            assert.strictEqual(rootGroup.children[3].type, 'VariableDeclaration', '4th should be export const');
            
            // Insert new import at the beginning
            builder.insertCodeAtIndex(0, newImport);
            
            const result = await builder.toString();
            
            // Should start with the new import
            assert.ok(result.startsWith('import { asdfChapter }'), 'Should start with new import');
            
            // Should maintain all existing imports
            assert.ok(result.includes('kingdomLocation'), 'Should keep kingdomLocation import');
            assert.ok(result.includes('weddingChapter'), 'Should keep weddingChapter import');
            assert.ok(result.includes('Annie'), 'Should keep Annie import');
            
            // Should maintain the export structure
            assert.ok(result.includes('export const register'), 'Should keep register export');
            
            // The new import should come before existing imports
            const newImportPos = result.indexOf('asdfChapter');
            const firstExistingPos = result.indexOf('kingdomLocation');
            assert.ok(newImportPos < firstExistingPos, 'New import should come before existing imports');
        });

        test('Should add import and object property correctly', async () => {
            const registerCode = `import { weddingChapter } from './chapters/wedding/wedding.chapter';

export const register = {
    chapters: {
        wedding: weddingChapter,
    },
} as const;`;

            const newImport = `import { asdfChapter } from './chapters/asdf/asdf.chapter';`;
            
            const builder = new TypeScriptCodeBuilder(registerCode);
            
            // Add the import
            builder.insertCodeAtIndex(0, newImport);
            
            // Add the property to the chapters object
            builder.findObject('register', {
                onFound: (registerBuilder) => {
                    registerBuilder.findObject('chapters', {
                        onFound: (chaptersBuilder) => {
                            chaptersBuilder.setPropertyValue('asdf', 'asdfChapter');
                        },
                        onNotFound: () => assert.fail('Chapters object not found')
                    });
                },
                onNotFound: () => assert.fail('Register object not found')
            });
            
            const result = await builder.toString();
            
            // Should have both imports
            assert.ok(result.includes('asdfChapter'), 'Should include new import');
            assert.ok(result.includes('weddingChapter'), 'Should include existing import');
            
            // Should have both chapters in the register
            assert.ok(result.includes('wedding: weddingChapter'), 'Should have wedding chapter');
            assert.ok(result.includes('asdf: asdfChapter'), 'Should have asdf chapter');
            
            // Import should come before the export
            const importPos = result.indexOf('import { asdfChapter }');
            const exportPos = result.indexOf('export const register');
            assert.ok(importPos < exportPos, 'Import should come before export');
        });
    });
});