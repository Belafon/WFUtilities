import * as assert from 'assert';
import { TypeScriptCodeBuilder } from '../typescriptObjectParser/ObjectParser';
import { WorldStateSection } from '../register/WorldStateFileManager';

// Helper to normalize whitespace for consistent comparisons
function normalizeWhitespace(str: string): string {
    return str.replace(/\s+/g, ' ').trim();
}

suite('WorldStateFileManager Correctness Tests', () => {

    let mockCodeBuilder: TypeScriptCodeBuilder;
    let initialContent: string;

    // Setup a clean state before each test
    setup(() => {
        initialContent = `
            import { TKingdomLocationData } from './locations/kingdom.location';
            import { TWeddingChapterData } from './chapters/wedding/wedding.chapter';
            // ... other imports

            type TWorldState = {
                time: Time;
                // ... other properties
                chapters: {
                    village: { ref: TChapter<'village'> } & TVillageChapterData;
                    wedding: { ref: TChapter <'wedding'> } & TWeddingChapterData;
                };
                locations: {
                    village: { ref: TLocation<'village'> } & TVillageLocationData;
                };
            };
        `;
        mockCodeBuilder = new TypeScriptCodeBuilder(initialContent);
    });

    test('Should add a new chapter property to TWorldState without breaking syntax', async () => {
        // Arrange
        const sectionName = WorldStateSection.Chapters;
        const itemId = 'newChapterName';
        const typeDefinition = `${itemId}: { ref: TChapter<'${itemId}'> } & TNewChapterNameChapterData;`;

        const expectedBlockContent = `
            village: { ref: TChapter<'village'> } & TVillageChapterData;
            wedding: { ref: TChapter <'wedding'> } & TWeddingChapterData;
            newChapterName: { ref: TChapter<'newChapterName'> } & TNewChapterNameChapterData;
        `;

        // Act: We simulate the core logic of the file manager by calling the builder directly
        await new Promise<void>((resolve, reject) => {
            mockCodeBuilder.findTypeDeclaration('TWorldState', {
                onFound: (typeBuilder: { findNestedTypeObject: (arg0: WorldStateSection[], arg1: { onFound: (sectionBuilder: any) => void; onNotFound: () => void; }) => void; }) => {
                    typeBuilder.findNestedTypeObject([sectionName], {
                        onFound: (sectionBuilder) => {
                            sectionBuilder.addProperty(itemId, `{ ref: TChapter<'${itemId}'> } & TNewChapterNameChapterData`);
                            resolve();
                        },
                        onNotFound: () => reject(new Error(`Section '${sectionName}' not found`))
                    });
                },
                onNotFound: () => reject(new Error('TWorldState not found'))
            });
        });

        const finalCode = await mockCodeBuilder.toString();

        // Assert
        // Find the 'chapters' block in the final output
        const chaptersRegex = /chapters:\s*{([\s\S]*?)\s*};/;
        const match = finalCode.match(chaptersRegex);

        assert.ok(match && match[1], 'The "chapters" block could not be found or was malformed.');

        const actualBlockContent = match[1];

        // Compare the content of the block, ignoring whitespace differences
        assert.strictEqual(
            normalizeWhitespace(actualBlockContent),
            normalizeWhitespace(expectedBlockContent),
            'The content of the chapters block is incorrect.'
        );
    });

    suite('WorldStateFileManager - Advanced Correctness Tests', () => {

        function normalizeBlockContent(str: string): string {
            // Removes excess whitespace, newlines, and trailing separators (;, or ,) for consistent comparison
            return str.replace(/[\s;]/g, '').trim();
        }

        test('Should add a new chapter property to the END of the list correctly', async () => {
            // This test replicates the exact problem: adding an item to the end of a list in a type alias.
            // The key is ensuring the new property is inserted *before* the closing brace.
            const initialContent = `
            type TWorldState = {
                chapters: {
                    village: { ref: TChapter<'village'> } & TVillageChapterData;
                    wedding: { ref: TChapter <'wedding'> } & TWeddingChapterData;
                };
            };
        `;

            const expectedChaptersBlock = `
            chapters: {
                village: { ref: TChapter<'village'> } & TVillageChapterData;
                wedding: { ref: TChapter <'wedding'> } & TWeddingChapterData;
                newChapter: { ref: TChapter<'newChapter'> } & TNewChapterChapterData;
            };
        `;

            const codeBuilder = new TypeScriptCodeBuilder(initialContent);

            // Act
            await new Promise<void>((resolve) => {
                codeBuilder.findTypeDeclaration('TWorldState', {
                    onFound: (typeBuilder: { findNestedTypeObject: (arg0: string[], arg1: { onFound: (sectionBuilder: any) => void; }) => void; }) => {
                        typeBuilder.findNestedTypeObject(['chapters'], {
                            onFound: (sectionBuilder) => {
                                sectionBuilder.addProperty('newChapter', `{ ref: TChapter<'newChapter'> } & TNewChapterChapterData`);
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
                'The content of the chapters block was not correctly modified.'
            );
        });
    });


    suite('WorldStateFileManager - Full Lifecycle Simulation Test', () => {

        test('Should correctly add an import and a type property in sequence', async () => {
            // Arrange: A realistic starting state for the world state file.
            const initialContent = `
import { TWeddingChapterData } from './chapters/wedding/wedding.chapter';
import { TChapter } from 'types/TChapter';

type TWorldState = {
    chapters: {
        wedding: { ref: TChapter <'wedding'> } & TWeddingChapterData;
    };
};
`;
            const codeBuilder = new TypeScriptCodeBuilder(initialContent);

            // --- ACT: Simulate the EXACT sequence of operations from your file manager ---

            // 1. Simulate adding the import statement.
            // We use the import manager as your `WorldStateFileManager` does.
            const importManager = codeBuilder.getImportManager();
            importManager.addNamedImport('TNewChapterChapterData', './chapters/newChapter/newChapter.chapter');

            // 2. Simulate adding the property to the type definition.
            await new Promise<void>((resolve, reject) => {
                codeBuilder.findTypeDeclaration('TWorldState', {
                    onFound: (typeBuilder) => {
                        typeBuilder.findNestedTypeObject(['chapters'], {
                            onFound: (sectionBuilder) => {
                                // This is the call that likely fails due to incorrect offset calculation
                                sectionBuilder.addProperty('newChapter', `{ ref: TChapter<'newChapter'> } & TNewChapterChapterData`);
                                resolve();
                            },
                            onNotFound: () => reject(new Error("Nested 'chapters' section not found"))
                        });
                    },
                    onNotFound: () => reject(new Error("TWorldState declaration not found"))
                });
            });

            // 3. Generate the final output string
            const finalCode = await codeBuilder.toString();

            // --- ASSERT: Perform precise checks on the final output ---

            // Assert 1: The new import was added correctly.
            assert.ok(
                finalCode.includes("import { TNewChapterChapterData } from './chapters/newChapter/newChapter.chapter';"),
                'The new import statement is missing or incorrect.'
            );

            // Assert 2: The structure of the 'chapters' type block is correct.
            // This regex is the key: it checks that the new property was inserted *before* the closing brace.
            // If it fails, it means the insertion point was wrong.
            const chaptersBlockRegex = /chapters:\s*{([\s\S]*?)};/s;
            const match = finalCode.match(chaptersBlockRegex);

            assert.ok(match, "The 'chapters' type block is syntactically broken.");

            // Assert 3: The content within the block is exactly as expected.
            const chaptersBlockContent = match[1];
            const expectedBlockContent = `
        wedding: { ref: TChapter <'wedding'> } & TWeddingChapterData;
        newChapter: { ref: TChapter<'newChapter'> } & TNewChapterChapterData;
        `;

            // We compare without whitespace to avoid formatting noise, but we've already confirmed
            // the structural integrity with the regex.
            assert.strictEqual(
                chaptersBlockContent.replace(/\s/g, ''),
                expectedBlockContent.replace(/\s/g, ''),
                'The content inside the chapters block is not correct.'
            );
        });
    });
});


suite('WorldStateFileManager - Definitive Failing Test', () => {

    test('Should not insert an extra closing brace when adding a property after an import', async () => {
        // Arrange: The EXACT initial content from your logs.
        const initialContent = `
import { TKingdomLocationData } from './locations/kingdom.location';
import { TWeddingChapterData } from './chapters/wedding/wedding.chapter';
import { TVillageChapterData } from './chapters/village/village.chapter';
import { TCharacter, TCharacterData, TSideCharacter, TSideCharacterData } from '../types/TCharacter';
import { TThomasCharacterData } from './characters/thomas';
import { TFrantaSideCharacterData } from './sideCharacters/Franta';
import { TVillageLocationData } from './locations/village.location';
import { TChapter } from 'types/TChapter';
import { TLocation } from 'types/TLocation';
import { TNobleManSideCharacterData } from './sideCharacters/NobleMan';
import { TAnnieCharacterData } from './characters/annie';
import { TKingdomChapterData } from './chapters/kingdom/kingdom.chapter';
import { TCharacterId } from 'types/TIds';
import { THistoryItem } from 'code/Engine/ts/History';
import { THappening } from 'types/THappening';


type TWorldState = {
    time: Time;
    mainCharacterId: TCharacterId;
    currentHistory: Partial<Record<TCharacterId, THistoryItem>>;

    characters: {
        thomas: { ref: TCharacter<'thomas'> } & TCharacterData & Partial<TThomasCharacterData>;
        annie: { ref: TCharacter<'annie'> } & TCharacterData & Partial<TAnnieCharacterData>;
    };
    sideCharacters: {
        franta: { ref: TSideCharacter<'franta'> } & TSideCharacterData & Partial<TFrantaSideCharacterData>;
        nobleMan: { ref: TSideCharacter<'nobleMan'> } & TSideCharacterData & Partial<TNobleManSideCharacterData>;
    };

    chapters: {
        village: { ref: TChapter<'village'> } & TVillageChapterData;
        kingdom: { ref: TChapter<'kingdom'> } & TKingdomChapterData;
        wedding: { ref: TChapter <'wedding'> } & TWeddingChapterData;
    };
    locations: {
        village: { ref: TLocation<'village'> } & TVillageLocationData;
        kingdom: { ref: TLocation<'kingdom'> } & Partial<TKingdomLocationData>;
    };
    happenings: {
        village_under_attack: { ref: THappening<'village_under_attack'> };
    };
};
`;
        const codeBuilder = new TypeScriptCodeBuilder(initialContent);

        // Act: Perform the EXACT sequence of edits from your file manager.
        // 1. Add the import.
        codeBuilder.getImportManager().addNamedImport('TNewChapterNameChapterData', './chapters/newChapterName/newChapterName.chapter');

        // 2. Add the property to the nested type.
        await new Promise<void>((resolve) => {
            codeBuilder.findTypeDeclaration('TWorldState', {
                onFound: (typeBuilder) => {
                    typeBuilder.findNestedTypeObject(['chapters'], {
                        onFound: (sectionBuilder) => {
                            sectionBuilder.addProperty('newChapterName', `{ ref: TChapter<'newChapterName'> } & TNewChapterNameChapterData`);
                            resolve();
                        }
                    });
                }
            });
        });

        const finalCode = await codeBuilder.toString();
        
        // Assert: Check for the specific malformation.
        // This test will FAIL if the bug exists.
        assert.ok(
            !finalCode.includes('TNewChapterNameChapterData; };'),
            "Test Failed: An extra closing brace '}' was inserted before the semicolon, breaking the syntax."
        );
    });
});