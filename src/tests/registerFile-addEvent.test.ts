import * as assert from 'assert';
import * as path from 'path';
import { TypeScriptCodeBuilder } from '../typescriptObjectParser/ObjectParser';
import { RegisterFileManager, RegisterSection } from '../register/RegisterFileManager';

// Helper to normalize whitespace for consistent comparisons
function normalizeWhitespace(str: string): string {
    return str.replace(/\s+/g, ' ').trim();
}

suite('RegisterFileManager Correctness Tests', () => {

    let mockCodeBuilder: TypeScriptCodeBuilder;
    let initialContent: string;

    setup(() => {
        initialContent = `
            import { weddingChapter } from './chapters/wedding/wedding.chapter';
            import { villageChapter } from './chapters/village/village.chapter';

            export const register = {
                chapters: {
                    village: villageChapter,
                    wedding: weddingChapter,
                },
                passages: {
                    village: () => import('./chapters/village/village.passages'),
                },
            } as const;
        `;
        mockCodeBuilder = new TypeScriptCodeBuilder(initialContent);
    });

    test('Should add a new chapter to the register object with correct formatting', async () => {
        // Arrange
        const sectionName = RegisterSection.Chapters;
        const itemId = 'newChapterName';
        const variableName = 'newChapterNameChapter';

        const expectedBlockContent = `
            village: villageChapter,
            wedding: weddingChapter,
            newChapterName: newChapterNameChapter,
        `;

        // Act
        await new Promise<void>((resolve, reject) => {
            mockCodeBuilder.findObject('register', {
                onFound: (regBuilder) => {
                    regBuilder.findObject(sectionName, {
                        onFound: (secBuilder) => {
                            secBuilder.setPropertyValue(itemId, variableName);
                            resolve();
                        },
                        onNotFound: () => reject(new Error(`Section '${sectionName}' not found`))
                    });
                },
                onNotFound: () => reject(new Error('Register object not found'))
            });
        });

        const finalCode = await mockCodeBuilder.toString();

        // Assert
        const chaptersRegex = /chapters:\s*{([\s\S]*?)\s*},/;
        const match = finalCode.match(chaptersRegex);
        assert.ok(match && match[1], 'The "chapters" block could not be found or was malformed.');

        const actualBlockContent = match[1];
        assert.strictEqual(
            normalizeWhitespace(actualBlockContent),
            normalizeWhitespace(expectedBlockContent),
            'The content of the chapters block is incorrect.'
        );
    });

    test('Should generate a relative import path', () => {
        // This test doesn't modify code, it just tests the path logic
        // which should be added to RegisterFileManager.

        // Arrange: We manually create an instance to test the helper method.
        const fileManager = new RegisterFileManager();

        const registerFileAbsPath = '/home/belafon/story/src/data/register.ts';
        const chapterFileAbsPath = '/home/belafon/story/src/data/chapters/newChapterName/newChapterName.chapter.ts';
        const expectedRelativePath = './chapters/newChapterName/newChapterName.chapter';

        // Mock the manager's internal path for the duration of the test
        (fileManager as any).registerPath = registerFileAbsPath;

        // Act: Call the helper method (assuming it's added from WorldStateFileManager)
        const actualRelativePath = (fileManager as any).getRelativeImportPath(chapterFileAbsPath);

        // Assert
        assert.strictEqual(actualRelativePath, expectedRelativePath, "The generated import path was not correctly relativized.");
    });



    suite('RegisterFileManager - Advanced Correctness Tests', () => {

        function normalizeBlockContent(str: string): string {
            // Removes excess whitespace, newlines, and trailing commas for consistent comparison
            return str.replace(/[\s,]/g, '').trim();
        }

        test('Should add property to an object where the last item LACKS a trailing comma', async () => {
            // This is a CRITICAL test. Many simple parsers fail here.
            // The builder must be smart enough to add a comma to the PREVIOUS item.
            const initialContent = `
            export const register = {
                chapters: {
                    village: villageChapter,
                    wedding: weddingChapter
                }
            } as const;
        `;

            // The expected output MUST have a comma after `weddingChapter`.
            const expectedChaptersBlock = `
            chapters: {
                village: villageChapter,
                wedding: weddingChapter,
                newChapter: newChapterChapter,
            }
        `;

            const codeBuilder = new TypeScriptCodeBuilder(initialContent);

            // Act
            await new Promise<void>((resolve) => {
                codeBuilder.findObject('register', {
                    onFound: (regBuilder) => {
                        regBuilder.findObject('chapters', {
                            onFound: (secBuilder) => {
                                secBuilder.setPropertyValue('newChapter', 'newChapterChapter');
                                resolve();
                            }
                        });
                    }
                });
            });

            const finalCode = await codeBuilder.toString();

            // Assert
            const finalMatch = finalCode.match(/chapters:\s*{([\s\S]*?)}/);
            const expectedMatch = expectedChaptersBlock.match(/chapters:\s*{([\s\S]*?)}/);

            assert.ok(finalMatch, 'Final code did not contain a valid chapters block');
            assert.ok(expectedMatch, 'Expected code did not contain a valid chapters block');

            assert.strictEqual(
                normalizeBlockContent(finalMatch[1]),
                normalizeBlockContent(expectedMatch[1]),
                'The builder failed to add a comma to the previous last item.'
            );
        });

        test('Should generate a correct relative import path', () => {
            // This test is now fixed to correctly access the private method.
            const fileManager = new RegisterFileManager();

            const registerFileAbsPath = '/home/belafon/story/src/data/register.ts';
            const chapterFileAbsPath = '/home/belafon/story/src/data/chapters/newChapterName/newChapterName.chapter.ts';
            const expectedRelativePath = './chapters/newChapterName/newChapterName.chapter';

            // To test a private method, we can use this TypeScript trick
            // to bypass the access check during testing.
            (fileManager as any).registerPath = registerFileAbsPath;
            const actualRelativePath = (fileManager as any).getRelativeImportPath(chapterFileAbsPath);

            assert.strictEqual(actualRelativePath, expectedRelativePath, "The generated import path was not correctly relativized.");
        });
    });


    suite('RegisterFileManager - Full Lifecycle Simulation Test', () => {

        test('Should correctly add an import and an object property in sequence', async () => {
            // Arrange: A realistic starting state for the register file,
            // specifically with NO trailing comma on the last property.
            const initialContent = `
import { weddingChapter } from './chapters/wedding/wedding.chapter';

export const register = {
    chapters: {
    	wedding: weddingChapter
    }
} as const;
`;
            const codeBuilder = new TypeScriptCodeBuilder(initialContent);

            // --- ACT: Simulate the EXACT sequence of operations from your file manager ---

            // 1. Simulate adding the import using the same method as your code.
            const importPath = './chapters/newChapter/newChapter.chapter'; // Assume path is already relative
            codeBuilder.insertCodeAtIndex(0, `import { newChapterChapter } from '${importPath}';\n`);

            // 2. Simulate adding the property to the register object.
            await new Promise<void>((resolve, reject) => {
                codeBuilder.findObject('register', {
                    onFound: (regBuilder) => {
                        regBuilder.findObject('chapters', {
                            onFound: (secBuilder) => {
                                // This call must be smart enough to add a comma to the 'wedding' line
                                // AND handle the offset from the import insertion.
                                secBuilder.setPropertyValue('newChapter', 'newChapterChapter');
                                resolve();
                            },
                            onNotFound: () => reject(new Error("Nested 'chapters' object not found"))
                        });
                    },
                    onNotFound: () => reject(new Error("Register object not found"))
                });
            });

            // 3. Generate the final output.
            const finalCode = await codeBuilder.toString();
            console.log("FINAL GENERATED CODE:\n", finalCode); // Log for debugging

            // --- ASSERT: Perform precise checks ---

            // Assert 1: The new import exists.
            assert.ok(
                finalCode.includes("import { newChapterChapter } from './chapters/newChapter/newChapter.chapter';"),
                'The new import statement is missing or incorrect.'
            );

            // Assert 2: The structure of the 'chapters' object is correct.
            const chaptersBlockRegex = /chapters:\s*{([\s\S]*?)}/s;
            const match = finalCode.match(chaptersBlockRegex);
            assert.ok(match, "The 'chapters' object is syntactically broken.");

            const chaptersBlockContent = match[1];

            // Assert 3: The PREVIOUS line now has a comma. This is the most common bug.
            assert.ok(
                chaptersBlockContent.includes('wedding: weddingChapter,'),
                'A comma was not added to the preceding property.'
            );

            // Assert 4: The NEW line was added correctly.
            assert.ok(
                chaptersBlockContent.includes('newChapter: newChapterChapter'),
                'The new property was not added correctly.'
            );
        });
    });

    suite('RegisterFileManager - Definitive Failing Test', () => {

        test('Should add a new property with a trailing comma for consistency', async () => {
            // Arrange: The EXACT initial content from your logs.
            const initialContent = `
import { kingdomLocation } from './locations/kingdom.location';
import { weddingChapter } from './chapters/wedding/wedding.chapter';
import { Annie } from './characters/annie';
import { Thomas } from './characters/thomas';
import { kingdomChapter } from './chapters/kingdom/kingdom.chapter';
import { villageChapter } from './chapters/village/village.chapter';
import { village_under_attackHappening } from './happenings/village_under_attack';
import { villageLocation } from './locations/village.location';
import { Franta } from './sideCharacters/Franta';
import { NobleMan } from './sideCharacters/NobleMan';

export const register = {
    characters: {
        thomas: Thomas,
        annie: Annie,
    },
    sideCharacters: {
        franta: Franta,
        nobleMan: NobleMan,
    },
    chapters: {
        village: villageChapter,
        kingdom: kingdomChapter,
        wedding: weddingChapter,
    },
    locations: {
        village: villageLocation,
        kingdom: kingdomLocation,
    },
    passages: {
        village: () => import('./chapters/village/village.passages'),
        kingdom: () => import('./chapters/kingdom/kingdom.passages'),
        wedding: () => import('./chapters/wedding/wedding.passages'),
    },
    happenings: {
        village_under_attack: village_under_attackHappening,
    }
} as const;

export type TRegisterPassageId = keyof typeof register.passages;
`;
            const codeBuilder = new TypeScriptCodeBuilder(initialContent);

            // Act
            codeBuilder.getImportManager().addNamedImport('newChapterNameChapter', './chapters/newChapterName/newChapterName.chapter');

            await new Promise<void>((resolve) => {
                codeBuilder.findObject('register', {
                    onFound: (regBuilder) => {
                        regBuilder.findObject('chapters', {
                            onFound: (secBuilder) => {
                                secBuilder.setPropertyValue('newChapterName', 'newChapterNameChapter');
                                resolve();
                            }
                        });
                    }
                });
            });

            const finalCode = await codeBuilder.toString();
            const chaptersBlockRegex = /chapters:\s*{([\s\S]*?)}/s;
            const match = finalCode.match(chaptersBlockRegex);

            assert.ok(match, "The 'chapters' object block could not be found.");
            const chaptersContent = match[1];

            // Assert: Ensure the new property has a trailing comma.
            // This test will FAIL if the bug exists.
            assert.ok(
                chaptersContent.trim().endsWith(','),
                "Test Failed: The newly added property should have a trailing comma for consistent formatting."
            );
        });
    });
});