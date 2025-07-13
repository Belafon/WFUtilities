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
            import { TWeddingEventData } from './events/wedding/wedding.event';
            // ... other imports

            type TWorldState = {
                time: Time;
                // ... other properties
                events: {
                    village: { ref: TEvent<'village'> } & TVillageEventData;
                    wedding: { ref: TEvent <'wedding'> } & TWeddingEventData;
                };
                locations: {
                    village: { ref: TLocation<'village'> } & TVillageLocationData;
                };
            };
        `;
        mockCodeBuilder = new TypeScriptCodeBuilder(initialContent);
    });

    test('Should add a new event property to TWorldState without breaking syntax', async () => {
        // Arrange
        const sectionName = WorldStateSection.Events;
        const itemId = 'newEventName';
        const typeDefinition = `${itemId}: { ref: TEvent<'${itemId}'> } & TNewEventNameEventData;`;

        const expectedBlockContent = `
            village: { ref: TEvent<'village'> } & TVillageEventData;
            wedding: { ref: TEvent <'wedding'> } & TWeddingEventData;
            newEventName: { ref: TEvent<'newEventName'> } & TNewEventNameEventData;
        `;

        // Act: We simulate the core logic of the file manager by calling the builder directly
        await new Promise<void>((resolve, reject) => {
            mockCodeBuilder.findTypeDeclaration('TWorldState', {
                onFound: (typeBuilder: { findNestedTypeObject: (arg0: WorldStateSection[], arg1: { onFound: (sectionBuilder: any) => void; onNotFound: () => void; }) => void; }) => {
                    typeBuilder.findNestedTypeObject([sectionName], {
                        onFound: (sectionBuilder) => {
                            sectionBuilder.addProperty(itemId, `{ ref: TEvent<'${itemId}'> } & TNewEventNameEventData`);
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
        // Find the 'events' block in the final output
        const eventsRegex = /events:\s*{([\s\S]*?)\s*};/;
        const match = finalCode.match(eventsRegex);

        assert.ok(match && match[1], 'The "events" block could not be found or was malformed.');

        const actualBlockContent = match[1];

        // Compare the content of the block, ignoring whitespace differences
        assert.strictEqual(
            normalizeWhitespace(actualBlockContent),
            normalizeWhitespace(expectedBlockContent),
            'The content of the events block is incorrect.'
        );
    });

    suite('WorldStateFileManager - Advanced Correctness Tests', () => {

        function normalizeBlockContent(str: string): string {
            // Removes excess whitespace, newlines, and trailing separators (;, or ,) for consistent comparison
            return str.replace(/[\s;]/g, '').trim();
        }

        test('Should add a new event property to the END of the list correctly', async () => {
            // This test replicates the exact problem: adding an item to the end of a list in a type alias.
            // The key is ensuring the new property is inserted *before* the closing brace.
            const initialContent = `
            type TWorldState = {
                events: {
                    village: { ref: TEvent<'village'> } & TVillageEventData;
                    wedding: { ref: TEvent <'wedding'> } & TWeddingEventData;
                };
            };
        `;

            const expectedEventsBlock = `
            events: {
                village: { ref: TEvent<'village'> } & TVillageEventData;
                wedding: { ref: TEvent <'wedding'> } & TWeddingEventData;
                newEvent: { ref: TEvent<'newEvent'> } & TNewEventEventData;
            };
        `;

            const codeBuilder = new TypeScriptCodeBuilder(initialContent);

            // Act
            await new Promise<void>((resolve) => {
                codeBuilder.findTypeDeclaration('TWorldState', {
                    onFound: (typeBuilder: { findNestedTypeObject: (arg0: string[], arg1: { onFound: (sectionBuilder: any) => void; }) => void; }) => {
                        typeBuilder.findNestedTypeObject(['events'], {
                            onFound: (sectionBuilder) => {
                                sectionBuilder.addProperty('newEvent', `{ ref: TEvent<'newEvent'> } & TNewEventEventData`);
                                resolve();
                            }
                        });
                    }
                });
            });

            const finalCode = await codeBuilder.toString();

            // Assert
            const finalMatch = finalCode.match(/events:\s*{([\s\S]*?)}/);
            const expectedMatch = expectedEventsBlock.match(/events:\s*{([\s\S]*?)}/);

            assert.ok(finalMatch, 'Final code did not contain a valid events block');
            assert.ok(expectedMatch, 'Expected code did not contain a valid events block');

            assert.strictEqual(
                normalizeBlockContent(finalMatch[1]),
                normalizeBlockContent(expectedMatch[1]),
                'The content of the events block was not correctly modified.'
            );
        });
    });


    suite('WorldStateFileManager - Full Lifecycle Simulation Test', () => {

        test('Should correctly add an import and a type property in sequence', async () => {
            // Arrange: A realistic starting state for the world state file.
            const initialContent = `
import { TWeddingEventData } from './events/wedding/wedding.event';
import { TEvent } from 'types/TEvent';

type TWorldState = {
    events: {
        wedding: { ref: TEvent <'wedding'> } & TWeddingEventData;
    };
};
`;
            const codeBuilder = new TypeScriptCodeBuilder(initialContent);

            // --- ACT: Simulate the EXACT sequence of operations from your file manager ---

            // 1. Simulate adding the import statement.
            // We use the import manager as your `WorldStateFileManager` does.
            const importManager = codeBuilder.getImportManager();
            importManager.addNamedImport('TNewEventEventData', './events/newEvent/newEvent.event');

            // 2. Simulate adding the property to the type definition.
            await new Promise<void>((resolve, reject) => {
                codeBuilder.findTypeDeclaration('TWorldState', {
                    onFound: (typeBuilder) => {
                        typeBuilder.findNestedTypeObject(['events'], {
                            onFound: (sectionBuilder) => {
                                // This is the call that likely fails due to incorrect offset calculation
                                sectionBuilder.addProperty('newEvent', `{ ref: TEvent<'newEvent'> } & TNewEventEventData`);
                                resolve();
                            },
                            onNotFound: () => reject(new Error("Nested 'events' section not found"))
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
                finalCode.includes("import { TNewEventEventData } from './events/newEvent/newEvent.event';"),
                'The new import statement is missing or incorrect.'
            );

            // Assert 2: The structure of the 'events' type block is correct.
            // This regex is the key: it checks that the new property was inserted *before* the closing brace.
            // If it fails, it means the insertion point was wrong.
            const eventsBlockRegex = /events:\s*{([\s\S]*?)};/s;
            const match = finalCode.match(eventsBlockRegex);

            assert.ok(match, "The 'events' type block is syntactically broken.");

            // Assert 3: The content within the block is exactly as expected.
            const eventsBlockContent = match[1];
            const expectedBlockContent = `
        wedding: { ref: TEvent <'wedding'> } & TWeddingEventData;
        newEvent: { ref: TEvent<'newEvent'> } & TNewEventEventData;
        `;

            // We compare without whitespace to avoid formatting noise, but we've already confirmed
            // the structural integrity with the regex.
            assert.strictEqual(
                eventsBlockContent.replace(/\s/g, ''),
                expectedBlockContent.replace(/\s/g, ''),
                'The content inside the events block is not correct.'
            );
        });
    });
});


suite('WorldStateFileManager - Definitive Failing Test', () => {

    test('Should not insert an extra closing brace when adding a property after an import', async () => {
        // Arrange: The EXACT initial content from your logs.
        const initialContent = `
import { TKingdomLocationData } from './locations/kingdom.location';
import { TWeddingEventData } from './events/wedding/wedding.event';
import { TVillageEventData } from './events/village/village.event';
import { TCharacter, TCharacterData, TSideCharacter, TSideCharacterData } from '../types/TCharacter';
import { TThomasCharacterData } from './characters/thomas';
import { TFrantaSideCharacterData } from './sideCharacters/Franta';
import { TVillageLocationData } from './locations/village.location';
import { TEvent } from 'types/TEvent';
import { TLocation } from 'types/TLocation';
import { TNobleManSideCharacterData } from './sideCharacters/NobleMan';
import { TAnnieCharacterData } from './characters/annie';
import { TKingdomEventData } from './events/kingdom/kingdom.event';
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

    events: {
        village: { ref: TEvent<'village'> } & TVillageEventData;
        kingdom: { ref: TEvent<'kingdom'> } & TKingdomEventData;
        wedding: { ref: TEvent <'wedding'> } & TWeddingEventData;
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
        codeBuilder.getImportManager().addNamedImport('TNewEventNameEventData', './events/newEventName/newEventName.event');

        // 2. Add the property to the nested type.
        await new Promise<void>((resolve) => {
            codeBuilder.findTypeDeclaration('TWorldState', {
                onFound: (typeBuilder) => {
                    typeBuilder.findNestedTypeObject(['events'], {
                        onFound: (sectionBuilder) => {
                            sectionBuilder.addProperty('newEventName', `{ ref: TEvent<'newEventName'> } & TNewEventNameEventData`);
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
            !finalCode.includes('TNewEventNameEventData; };'),
            "Test Failed: An extra closing brace '}' was inserted before the semicolon, breaking the syntax."
        );
    });
});