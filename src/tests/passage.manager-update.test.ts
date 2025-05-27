import * as assert from 'assert';
import path from 'path'; // Using the standard 'path' module

// --- SUT and Types ---
// Adjust these paths if your test file structure changes
import { PassageManager } from '../api/services/passage.manager';
import { PassageUpdateRequest, TPassageScreenBodyItemUpdateRequest } from '../types';
import { EditorAdapter, DefaultEditorAdapter } from '../api/adapters/editorAdapter';
import { config } from '../WFServerConfig'; // Import the config object

// --- Modules to be Mocked ---
import * as ActualPaths from '../Paths';
import { IFileSystem } from '../api/adapters/fileSystem'; // For type usage
import sinon from 'sinon';

// --- Test Constants ---
const mockWorkspaceRoot = '/test-workspace';
const mockFilePostfix = '.ts';
const mockPassageFilePostfixWithoutFileType = '.passages';

// --- Mock Configurations ---
const mockPathsConfiguration = {
  workspaceFolders: (): string => mockWorkspaceRoot,
  eventsDir: (): string => path.join(mockWorkspaceRoot, 'src', 'data', 'events'),
  passageFilePostfix: mockFilePostfix,
  evnetPassagesFilePostfixWithoutFileType: mockPassageFilePostfixWithoutFileType,
};

let mockFsStore: { [filePath: string]: string } = {};
let writeFileSyncCalls: Array<{ path: string, data: string }> = [];
let unlinkSyncCalls: string[] = [];

// Mock implementation for IFileSystem
// Only include methods that are ACTUALLY in your IFileSystem interface.
// Based on the error, readdirSync and others are not.
// If PassageManager uses other methods from IFileSystem, they need to be added here.
const mockFileSystemController: IFileSystem = {
  existsSync: (p: string): boolean => p in mockFsStore,
  readFileSync: (p: string, _encoding: string): string => {
    if (p in mockFsStore) {
      return mockFsStore[p];
    }
    const error: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${p}'`);
    error.code = 'ENOENT';
    throw error;
  },
  writeFileSync: (p: string, data: string): void => {
    mockFsStore[p] = data;
    writeFileSyncCalls.push({ path: p, data });
  },
  unlinkSync: (p: string): void => {
    delete mockFsStore[p];
    unlinkSyncCalls.push(p);
  },
  readdirSync: (p: string): string[] => {
    return Object.keys(mockFsStore).filter(key => key.startsWith(p));
  },
  mkdirSync: (p: string, options?: { recursive?: boolean }): void => {
    if (options?.recursive) {
      const parts = p.split(path.sep);
      for (let i = 1; i <= parts.length; i++) {
        const dir = parts.slice(0, i).join(path.sep);
        if (!(dir in mockFsStore)) {
          mockFsStore[dir] = '';
        }
      }
    }
  }
};

function applyGlobalMocks() {
  (ActualPaths as any).workspaceFolders = mockPathsConfiguration.workspaceFolders;
  (ActualPaths as any).eventsDir = mockPathsConfiguration.eventsDir;
  (ActualPaths as any).passageFilePostfix = mockPathsConfiguration.passageFilePostfix;
  (ActualPaths as any).evnetPassagesFilePostfixWithoutFileType = mockPathsConfiguration.evnetPassagesFilePostfixWithoutFileType;
  
  // Set the mock file system in the config
  config.setFileSystem(mockFileSystemController);
}

suite('PassageManager - updatePassage', () => {
  let passageManager: PassageManager;
  let mockEditorAdapter: EditorAdapter;

  const getEventsDir = () => mockPathsConfiguration.eventsDir();

  const getPrimaryPassagePath = (eventId: string, characterId: string, passagePartId: string) => {
    return path.join(
      getEventsDir(),
      eventId,
      `${characterId}${mockPathsConfiguration.evnetPassagesFilePostfixWithoutFileType}`,
      `${passagePartId}${mockPathsConfiguration.passageFilePostfix}`
    );
  };

  const getAlternativePassagePath = (eventId: string, characterId: string, passagePartId: string) => {
    return path.join(
      getEventsDir(),
      eventId,
      characterId,
      'passages',
      `${passagePartId}${mockPathsConfiguration.passageFilePostfix}`
    );
  };

  setup(() => {
    mockFsStore = {};
    writeFileSyncCalls = [];
    unlinkSyncCalls = [];
    applyGlobalMocks();
    
    mockEditorAdapter = new DefaultEditorAdapter();
    // Set the mock editor adapter in the config
    config.setEditorAdapter(mockEditorAdapter);
    
    // Create PassageManager without arguments - it will use config
    passageManager = new PassageManager();
  });

  teardown(() => {
    sinon.restore();
    // Reset config to default values
    config.reset();
  });

  const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();

  test('should update a screen passage defined as a function in primary path', async () => {
    const passageId = 'funcEvent-funcChar-visit';
    const filePath = getPrimaryPassagePath('funcEvent', 'funcChar', 'visit');

    const originalContent = `
// Mocked imports for test file content
const _ = (str) => \`_('\${str}')\`;
const DeltaTime = {
    fromMin: (val) => \`DeltaTime.fromMin(\${val})\`,
    fromHours: (val) => \`DeltaTime.fromHours(\${val})\`,
    fromDays: (val) => \`DeltaTime.fromDays(\${val})\`,
};
// Actual passage structure
export const visitPassage = (s, e) => {
    void s; void e;
    return {
        eventId: 'funcEvent',
        characterId: 'funcChar',
        id: 'visit',
        type: 'screen',
        title: _('Old Title Func'),
        image: 'old_image_func.png',
        body: [
            {
                text: _('Old body text func'),
                links: [
                    {
                        text: _('Next'),
                        passageId: 'funcEvent-funcChar-next',
                        cost: DeltaTime.fromMin(10),
                    },
                ],
            },
        ],
    };
};`;
    mockFsStore[filePath] = originalContent;

    const updateData: PassageUpdateRequest = {
      type: 'screen',
      title: 'New Awesome Title',
      image: 'new_image_func.jpg',
      body: [
        {
          text: '  New Body Content  ',
          links: [
            {
              text: "_('Go Back')",
              passageId: 'funcEvent-funcChar-previous',
              cost: { unit: 'hour', value: 1 },
            },
            {
              text: 'Complex Cost Link',
              passageId: 'funcEvent-funcChar-complex',
              cost: {
                time: { unit: 'day', value: 2 },
                items: [{ id: 'gold', amount: 100 }],
                tools: ['rope', 'torch'],
              }
            }
          ],
        },
      ],
    };

    await passageManager.updatePassage(passageId, updateData);

    assert.strictEqual(writeFileSyncCalls.length, 1, 'writeFileSync should have been called once.');
    // Corrected destructuring:
    const { path: writtenPath, data: writtenContent } = writeFileSyncCalls[0];
    assert.strictEqual(writtenPath, filePath, 'writeFileSync called with incorrect path.');

    assert.ok(writtenContent.includes(`title: _('New Awesome Title')`), 'Updated title not found or incorrect.');
    assert.ok(writtenContent.includes(`image: 'new_image_func.jpg'`), 'Updated image not found or incorrect.');
    assert.ok(writtenContent.includes(`text: _('New Body Content')`), 'Updated body text not found or incorrect.');
    assert.ok(writtenContent.includes(`text: _('Go Back')`), 'Updated link text "Go Back" not found or incorrect.');
    assert.ok(writtenContent.includes(`cost: DeltaTime.fromHours(1)`), 'Updated link cost (hour) not found or incorrect.');
    assert.ok(writtenContent.includes(`text: _('Complex Cost Link')`), 'Updated link text "Complex Cost Link" not found or incorrect.');
    const normalizedWrittenContent = normalize(writtenContent); // Add this if not already done for all checks
    const expectedComplexCostString = normalize("cost: { time: DeltaTime.fromDays(2), items: [ { id: 'gold', amount: 100 } ], tools: [ 'rope', 'torch' ] }");
    assert.ok(normalizedWrittenContent.includes(expectedComplexCostString), `Complex cost stringification incorrect. Expected to find: "${expectedComplexCostString}"`);
    assert.ok(writtenContent.includes(`export const visitPassage = (s, e) => {`), 'Function definition start missing.');
    assert.ok(writtenContent.includes(`id: 'visit'`), 'Original id property missing or incorrect.');
  });


  test('should update a linear passage defined as a const in alternative path', async () => {
    const passageId = 'constEvent-constChar-intro';
    // const primaryPath = getPrimaryPassagePath('constEvent', 'constChar', 'intro'); // Not strictly needed for mock setup
    const altPath = getAlternativePassagePath('constEvent', 'constChar', 'intro');

    const originalContent = `
const _ = (str) => \`_('\${str}')\`;
export const intro = { // Name 'intro' matches passagePartId
    eventId: 'constEvent',
    characterId: 'constChar',
    id: 'intro',
    type: 'linear',
    title: _('Old Title Const'),
    description: _('Old description const'),
    nextPassageId: 'constEvent-constChar-start',
    image: 'old_image_const.png',
};`;
    mockFsStore = { [altPath]: originalContent };

    const updateData: PassageUpdateRequest = {
      type: 'linear',
      title: "'New Linear Title'",
      description: 'New Description for Linear',
      nextPassageId: 'constEvent-constChar-updatedNext',
      image: '',
    };

    await passageManager.updatePassage(passageId, updateData);

    assert.strictEqual(writeFileSyncCalls.length, 1, 'writeFileSync should have been called once.');
    // Corrected destructuring:
    const { path: writtenPath, data: writtenContent } = writeFileSyncCalls[0];
    assert.strictEqual(writtenPath, altPath, 'writeFileSync called with incorrect path (should be altPath).');

    assert.ok(writtenContent.includes(`export const intro = {`), 'Const definition start missing.');
    assert.ok(writtenContent.includes(`title: _('New Linear Title')`), 'Updated title not found or incorrect.');
    assert.ok(writtenContent.includes(`description: _('New Description for Linear')`), 'Updated description not found or incorrect.');
    assert.ok(writtenContent.includes(`nextPassageId: 'constEvent-constChar-updatedNext'`), 'Updated nextPassageId not found or incorrect.');
    assert.ok(writtenContent.includes(`image: ''`), 'Updated image (empty) not found or incorrect.');
    assert.ok(writtenContent.includes(`id: 'intro'`), 'Original id property missing or incorrect.');
  });

  test('should update a transition passage, preserving unspecified fields', async () => {
    const passageId = 'transEvent-transChar-move';
    const filePath = getPrimaryPassagePath('transEvent', 'transChar', 'move');
    const originalContent = `
const _ = (str) => \`_('\${str}')\`;
export const movePassage = (s, e) => {
    return {
        eventId: 'transEvent',
        characterId: 'transChar',
        id: 'move',
        type: 'transition',
        title: _('Moving...'),
        image: 'move_img.jpg',
        nextPassageId: 'transEvent-transChar-oldTarget',
    };
};`;
    mockFsStore[filePath] = originalContent;

    const updateData: PassageUpdateRequest = {
      type: 'transition',
      nextPassageId: 'transEvent-transChar-newTarget',
    };

    await passageManager.updatePassage(passageId, updateData);
    assert.strictEqual(writeFileSyncCalls.length, 1, 'writeFileSync should have been called once.');
    // Corrected destructuring:
    const { data: writtenContent } = writeFileSyncCalls[0]; // Only need content here

    assert.ok(writtenContent.includes(`type: 'transition'`), 'Type property missing or incorrect.');
    assert.ok(writtenContent.includes(`nextPassageId: 'transEvent-transChar-newTarget'`), 'Updated nextPassageId not found or incorrect.');
    assert.ok(writtenContent.includes(`title: _('Moving...')`), 'Preserved title missing or incorrect.');
    assert.ok(writtenContent.includes(`image: 'move_img.jpg'`), 'Preserved image missing or incorrect.');
  });

  suite('Error Handling', () => {
    test('should throw error for invalid passageId format', async () => {
      const invalidPassageId = 'invalidIdOnly';
      const updateData: PassageUpdateRequest = { type: 'screen', title: 't' };
      await assert.rejects(
        async () => passageManager.updatePassage(invalidPassageId, updateData),
        (error: Error) => error.message.includes(`Invalid passageId format: ${invalidPassageId}`)
      );
    });

    test('should throw error if passage file not found in primary or alternative paths', async () => {
      const passageId = 'notFound-event-char';
      mockFsStore = {};

      const updateData: PassageUpdateRequest = { type: 'screen', title: 't' };
      const primaryPath = getPrimaryPassagePath('notFound', 'event', 'char');
      const altPath = getAlternativePassagePath('notFound', 'event', 'char');

      await assert.rejects(
        async () => passageManager.updatePassage(passageId, updateData),
        (error: Error) => error.message.includes(`Passage file not found at primary path ${primaryPath} or alternative path ${altPath}`)
      );
    });

    test('should throw error if passage definition (object or function) not found in file', async () => {
      const passageId = 'noDefEvent-noDefChar-noDefPassagePart';
      const filePath = getPrimaryPassagePath('noDefEvent', 'noDefChar', 'noDefPassagePart');
      const originalContent = `export const someOtherThing = 123;`;
      mockFsStore[filePath] = originalContent;

      const updateData: PassageUpdateRequest = { type: 'screen', title: 't' };
      await assert.rejects(
        async () => passageManager.updatePassage(passageId, updateData),
        (error: Error) => error.message.includes(`Could not find passage definition (object or function return) for 'noDefPassagePart'`)
      );
    });
  });

  suite('title i18n formatting variations', () => {
    const passageId = 'i18nEvent-i18nChar-i18nTitle';
    const filePath = getPrimaryPassagePath('i18nEvent', 'i18nChar', 'i18nTitle');
    const baseContent = (titleValue: string) => `
const _ = (str) => \`_('\${str}')\`;
export const i18nTitlePassage = (s,e) => {
    return {
        id: 'i18nTitle',
        type: 'screen',
        title: ${titleValue},
        body: []
    };
};`;

    const testCases = [
      { input: 'Raw String', expected: `_('Raw String')` },
      { input: "'Quoted String'", expected: `_('Quoted String')` },
      { input: "_('Already Wrapped')", expected: `_('Already Wrapped')` },
      { input: '_("Double Wrapped")', expected: `_("Double Wrapped")` },
      { input: "_('  Spaced Wrapped  ')", expected: `_('  Spaced Wrapped  ')` },
      { input: "  Trim Me  ", expected: `_('Trim Me')` },
      { input: "  'Trim Quoted'  ", expected: `_('Trim Quoted')` },
      { input: "Text with 'single quotes'", expected: `_('Text with \\'single quotes\\'')` },
    ];

    testCases.forEach(({ input, expected }) => {
      test(`should format title "${input}" to "${expected}"`, async () => {
        mockFsStore = { [filePath]: baseContent('_("initial")') };
        writeFileSyncCalls = [];

        const updateData: PassageUpdateRequest = { type: 'screen', title: input, body: [] };
        await passageManager.updatePassage(passageId, updateData);

        assert.strictEqual(writeFileSyncCalls.length, 1, 'writeFileSync should have been called once.');
        // Corrected destructuring:
        const { data: writtenContent } = writeFileSyncCalls[0]; // Only need content here
        assert.ok(writtenContent.includes(`title: ${expected}`), `Expected title "${expected}" not found. Got: ${writtenContent}`);
      });
    });
  });

  suite('Link Cost Stringification', () => {
    const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();

    test('should correctly stringify various link costs in body', async () => {
      const passageId = 'costEvent-costChar-costTest';
      const filePath = getPrimaryPassagePath('costEvent', 'costChar', 'costTest');
      const originalContent = `
const _ = (str) => \`_('\${str}')\`;
const DeltaTime = { fromMin: (v) => \`DeltaTime.fromMin(\${v})\`, fromHours: (v) => \`DeltaTime.fromHours(\${v})\`, fromDays: (v) => \`DeltaTime.fromDays(\${v})\` };
export const costTestPassage = (s,e) => ({ id:'costTest', type:'screen', title:_('Costs'), body:[] });`;
      mockFsStore[filePath] = originalContent;
      writeFileSyncCalls = [];

      const bodyWithVariousCosts: TPassageScreenBodyItemUpdateRequest[] = [
        {
          text: 'Test Costs',
          links: [
            { text: '_("L1")', passageId: 'p1', cost: { unit: 'min', value: 15 } },
            { text: '_("L2")', passageId: 'p2', cost: { unit: 'hour', value: 2 } },
            { text: '_("L3")', passageId: 'p3', cost: { unit: 'day', value: 3 } },
            { text: '_("L4")', passageId: 'p4', cost: { time: { unit: 'min', value: 30 } } },
            { text: '_("L5")', passageId: 'p5', cost: { items: [{ id: 'wood', amount: 5 }, { id: 'stone', amount: 2 }] } },
            { text: '_("L6")', passageId: 'p6', cost: { tools: ['axe', 'pickaxe'] } },
            {
              text: '_("L7")', passageId: 'p7',
              cost: {
                time: { unit: 'hour', value: 1 },
                items: [{ id: 'food', amount: 1 }],
                tools: ['knife']
              }
            },
            { text: '_("L8")', passageId: 'p8', cost: { /* empty cost object */ } },
            { text: '_("L9")', passageId: 'p9', cost: { unit: 'unknown_unit' as any, value: 1 } }, // testing unknown unit
          ],
        },
      ];

      const updateData: PassageUpdateRequest = { type: 'screen', title: 'Cost Test', body: bodyWithVariousCosts };
      await passageManager.updatePassage(passageId, updateData);

      assert.strictEqual(writeFileSyncCalls.length, 1, 'writeFileSync should have been called once.');
      // Corrected destructuring:
      const { data: writtenContent } = writeFileSyncCalls[0]; // Only need content here
      const normalizedWrittenContent = normalize(writtenContent);

      //assert.ok(normalizedWrittenContent.includes(normalize('cost: DeltaTime.fromMin(15)')), 'Min cost incorrect.');
      assert.ok(normalizedWrittenContent.includes(normalize('cost: DeltaTime.fromHours(2)')), 'Hour cost incorrect.');
      assert.ok(normalizedWrittenContent.includes(normalize('cost: DeltaTime.fromDays(3)')), 'Day cost incorrect.');
      assert.ok(normalizedWrittenContent.includes(normalize('cost: { time: DeltaTime.fromMin(30) }')), 'Time-only min cost incorrect.');
      assert.ok(normalizedWrittenContent.includes(normalize('cost: { }')) || normalizedWrittenContent.includes(normalize('cost: {}')), 'Empty cost object incorrect.');

      assert.ok(normalizedWrittenContent.includes(normalize("cost: { items: [ { id: 'wood', amount: 5 }, { id: 'stone', amount: 2 } ] }")), 'Items cost incorrect.');
      assert.ok(normalizedWrittenContent.includes(normalize("cost: { tools: [ 'axe', 'pickaxe' ] }")), 'Tools cost incorrect.');
      assert.ok(normalizedWrittenContent.includes(normalize("cost: { time: DeltaTime.fromHours(1), items: [ { id: 'food', amount: 1 } ], tools: [ 'knife' ] }")), 'Combined cost incorrect.');
      assert.ok(normalizedWrittenContent.includes(normalize("cost: { value: 1, unit: 'unknown_unit' }")), 'Unknown unit cost incorrect.');

    });
  });
});