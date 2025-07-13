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
            import { weddingEvent } from './events/wedding/wedding.event';
            import { villageEvent } from './events/village/village.event';

            export const register = {
                events: {
                    village: villageEvent,
                    wedding: weddingEvent,
                },
                passages: {
                    village: () => import('./events/village/village.passages'),
                },
            } as const;
        `;
        mockCodeBuilder = new TypeScriptCodeBuilder(initialContent);
    });

    test('Should add a new event to the register object with correct formatting', async () => {
        // Arrange
        const sectionName = RegisterSection.Events;
        const itemId = 'newEventName';
        const variableName = 'newEventNameEvent';

        const expectedBlockContent = `
            village: villageEvent,
            wedding: weddingEvent,
            newEventName: newEventNameEvent,
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
        const eventsRegex = /events:\s*{([\s\S]*?)\s*},/;
        const match = finalCode.match(eventsRegex);
        assert.ok(match && match[1], 'The "events" block could not be found or was malformed.');

        const actualBlockContent = match[1];
        assert.strictEqual(
            normalizeWhitespace(actualBlockContent),
            normalizeWhitespace(expectedBlockContent),
            'The content of the events block is incorrect.'
        );
    });

    test('Should generate a relative import path', () => {
        // This test doesn't modify code, it just tests the path logic
        // which should be added to RegisterFileManager.

        // Arrange: We manually create an instance to test the helper method.
        const fileManager = new RegisterFileManager();

        const registerFileAbsPath = '/home/belafon/story/src/data/register.ts';
        const eventFileAbsPath = '/home/belafon/story/src/data/events/newEventName/newEventName.event.ts';
        const expectedRelativePath = './events/newEventName/newEventName.event';

        // Mock the manager's internal path for the duration of the test
        (fileManager as any).registerPath = registerFileAbsPath;

        // Act: Call the helper method (assuming it's added from WorldStateFileManager)
        const actualRelativePath = (fileManager as any).getRelativeImportPath(eventFileAbsPath);

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
                events: {
                    village: villageEvent,
                    wedding: weddingEvent
                }
            } as const;
        `;

            // The expected output MUST have a comma after `weddingEvent`.
            const expectedEventsBlock = `
            events: {
                village: villageEvent,
                wedding: weddingEvent,
                newEvent: newEventEvent,
            }
        `;

            const codeBuilder = new TypeScriptCodeBuilder(initialContent);

            // Act
            await new Promise<void>((resolve) => {
                codeBuilder.findObject('register', {
                    onFound: (regBuilder) => {
                        regBuilder.findObject('events', {
                            onFound: (secBuilder) => {
                                secBuilder.setPropertyValue('newEvent', 'newEventEvent');
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
                'The builder failed to add a comma to the previous last item.'
            );
        });

        test('Should generate a correct relative import path', () => {
            // This test is now fixed to correctly access the private method.
            const fileManager = new RegisterFileManager();

            const registerFileAbsPath = '/home/belafon/story/src/data/register.ts';
            const eventFileAbsPath = '/home/belafon/story/src/data/events/newEventName/newEventName.event.ts';
            const expectedRelativePath = './events/newEventName/newEventName.event';

            // To test a private method, we can use this TypeScript trick
            // to bypass the access check during testing.
            (fileManager as any).registerPath = registerFileAbsPath;
            const actualRelativePath = (fileManager as any).getRelativeImportPath(eventFileAbsPath);

            assert.strictEqual(actualRelativePath, expectedRelativePath, "The generated import path was not correctly relativized.");
        });
    });


    suite('RegisterFileManager - Full Lifecycle Simulation Test', () => {

        test('Should correctly add an import and an object property in sequence', async () => {
            // Arrange: A realistic starting state for the register file,
            // specifically with NO trailing comma on the last property.
            const initialContent = `
import { weddingEvent } from './events/wedding/wedding.event';

export const register = {
    events: {
    	wedding: weddingEvent
    }
} as const;
`;
            const codeBuilder = new TypeScriptCodeBuilder(initialContent);

            // --- ACT: Simulate the EXACT sequence of operations from your file manager ---

            // 1. Simulate adding the import using the same method as your code.
            const importPath = './events/newEvent/newEvent.event'; // Assume path is already relative
            codeBuilder.insertCodeAtIndex(0, `import { newEventEvent } from '${importPath}';\n`);

            // 2. Simulate adding the property to the register object.
            await new Promise<void>((resolve, reject) => {
                codeBuilder.findObject('register', {
                    onFound: (regBuilder) => {
                        regBuilder.findObject('events', {
                            onFound: (secBuilder) => {
                                // This call must be smart enough to add a comma to the 'wedding' line
                                // AND handle the offset from the import insertion.
                                secBuilder.setPropertyValue('newEvent', 'newEventEvent');
                                resolve();
                            },
                            onNotFound: () => reject(new Error("Nested 'events' object not found"))
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
                finalCode.includes("import { newEventEvent } from './events/newEvent/newEvent.event';"),
                'The new import statement is missing or incorrect.'
            );

            // Assert 2: The structure of the 'events' object is correct.
            const eventsBlockRegex = /events:\s*{([\s\S]*?)}/s;
            const match = finalCode.match(eventsBlockRegex);
            assert.ok(match, "The 'events' object is syntactically broken.");

            const eventsBlockContent = match[1];

            // Assert 3: The PREVIOUS line now has a comma. This is the most common bug.
            assert.ok(
                eventsBlockContent.includes('wedding: weddingEvent,'),
                'A comma was not added to the preceding property.'
            );

            // Assert 4: The NEW line was added correctly.
            assert.ok(
                eventsBlockContent.includes('newEvent: newEventEvent'),
                'The new property was not added correctly.'
            );
        });
    });

    suite('RegisterFileManager - Definitive Failing Test', () => {

        test('Should add a new property with a trailing comma for consistency', async () => {
            // Arrange: The EXACT initial content from your logs.
            const initialContent = `
import { kingdomLocation } from './locations/kingdom.location';
import { weddingEvent } from './events/wedding/wedding.event';
import { Annie } from './characters/annie';
import { Thomas } from './characters/thomas';
import { kingdomEvent } from './events/kingdom/kingdom.event';
import { villageEvent } from './events/village/village.event';
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
    events: {
        village: villageEvent,
        kingdom: kingdomEvent,
        wedding: weddingEvent,
    },
    locations: {
        village: villageLocation,
        kingdom: kingdomLocation,
    },
    passages: {
        village: () => import('./events/village/village.passages'),
        kingdom: () => import('./events/kingdom/kingdom.passages'),
        wedding: () => import('./events/wedding/wedding.passages'),
    },
    happenings: {
        village_under_attack: village_under_attackHappening,
    }
} as const;

export type TRegisterPassageId = keyof typeof register.passages;
`;
            const codeBuilder = new TypeScriptCodeBuilder(initialContent);

            // Act
            codeBuilder.getImportManager().addNamedImport('newEventNameEvent', './events/newEventName/newEventName.event');

            await new Promise<void>((resolve) => {
                codeBuilder.findObject('register', {
                    onFound: (regBuilder) => {
                        regBuilder.findObject('events', {
                            onFound: (secBuilder) => {
                                secBuilder.setPropertyValue('newEventName', 'newEventNameEvent');
                                resolve();
                            }
                        });
                    }
                });
            });

            const finalCode = await codeBuilder.toString();
            const eventsBlockRegex = /events:\s*{([\s\S]*?)}/s;
            const match = finalCode.match(eventsBlockRegex);

            assert.ok(match, "The 'events' object block could not be found.");
            const eventsContent = match[1];

            // Assert: Ensure the new property has a trailing comma.
            // This test will FAIL if the bug exists.
            assert.ok(
                eventsContent.trim().endsWith(','),
                "Test Failed: The newly added property should have a trailing comma for consistent formatting."
            );
        });
    });
});