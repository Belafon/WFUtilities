import path from 'path';

// --- Set up mocks before imports ---
jest.mock('../../Paths');
jest.mock('../adapters/fileSystem');

// Import the mocked modules
import { PassageManager } from './passage.manager';
import { PassageUpdateRequest, TPassageScreenBodyItemUpdateRequest } from '../../types';
import { IFileSystem, fileSystem } from '../adapters/fileSystem';
import { EditorAdapter, DefaultEditorAdapter } from '../adapters/editorAdapter';
import * as Paths from '../../Paths';

// Set up constants needed for tests
const mockWorkspaceRoot = '/test-workspace';
const mockEventsDir = `${mockWorkspaceRoot}/src/data/events`;
const mockFilePostfix = '.ts';
const mockPassageFilePostfixWithoutFileType = '.passages';

// Configure the mocks
(Paths.workspaceFolders as jest.Mock).mockReturnValue(mockWorkspaceRoot);
(Paths.eventsDir as jest.Mock).mockReturnValue(mockEventsDir);
(Paths.passageFilePostfix as unknown) = mockFilePostfix;
(Paths.evnetPassagesFilePostfixWithoutFileType as unknown) = mockPassageFilePostfixWithoutFileType;

// Set up file system mock storage
let mockFsStore: { [path: string]: string } = {};


// --- Test Suite ---
describe('PassageManager - updatePassage', () => {
  let passageManager: PassageManager;
  let mockEditorAdapter: EditorAdapter;

  // Helper to construct paths based on the mocked eventsDir and actual constants
  const getEventsDir = () => path.join(mockWorkspaceRoot, 'src', 'data', 'events');

  const getPrimaryPassagePath = (eventId: string, characterId: string, passagePartId: string) => {
    return path.join(
      getEventsDir(),
      eventId,
      `${characterId}${mockPassageFilePostfixWithoutFileType}`,
      `${passagePartId}${mockFilePostfix}`
    );
  };

  const getAlternativePassagePath = (eventId: string, characterId: string, passagePartId: string) => {
    return path.join(
      getEventsDir(),
      eventId,
      characterId,
      'passages',
      `${passagePartId}${mockFilePostfix}`
    );
  };

  beforeEach(() => {
    mockFsStore = {}; // Reset in-memory store
    jest.clearAllMocks();
    
    // Configure file system mocks
    (fileSystem.existsSync as jest.Mock).mockImplementation((p: string) => p in mockFsStore);
    (fileSystem.readFileSync as jest.Mock).mockImplementation((p: string, encoding: string) => {
      if (p in mockFsStore) {
        return mockFsStore[p];
      }
      const error: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${p}'`);
      error.code = 'ENOENT';
      throw error;
    });
    (fileSystem.writeFileSync as jest.Mock).mockImplementation((p: string, data: string) => {
      mockFsStore[p] = data;
    });
    (fileSystem.unlinkSync as jest.Mock).mockImplementation((p: string) => {
      delete mockFsStore[p];
    });

    mockEditorAdapter = new DefaultEditorAdapter(); // Or a more specific mock if needed
    passageManager = new PassageManager(mockEditorAdapter);
  });

  // --- Test Cases ---

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

    expect(fileSystem.writeFileSync).toHaveBeenCalledTimes(1);
    const [writtenPath, writtenContent] = (fileSystem.writeFileSync as jest.Mock).mock.calls[0];
    expect(writtenPath).toBe(filePath);

    expect(writtenContent).toContain(`title: _('New Awesome Title')`);
    expect(writtenContent).toContain(`image: 'new_image_func.jpg'`);
    expect(writtenContent).toContain(`text: _('New Body Content')`);
    expect(writtenContent).toContain(`text: _('Go Back')`);
    expect(writtenContent).toContain(`cost: DeltaTime.fromHours(1)`);
    expect(writtenContent).toContain(`text: _('Complex Cost Link')`);
    expect(writtenContent).toContain(`cost: { time: DeltaTime.fromDays(2), items: [{ id: 'gold', amount: 100 }], tools: ['rope', 'torch'] }`);
    expect(writtenContent).toContain(`export const visitPassage = (s, e) => {`);
    expect(writtenContent).toContain(`id: 'visit'`);
  });


  test('should update a linear passage defined as a const in alternative path', async () => {
    const passageId = 'constEvent-constChar-intro';
    const primaryPath = getPrimaryPassagePath('constEvent', 'constChar', 'intro');
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
    mockFsStore[altPath] = originalContent;
    (fileSystem.existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p === primaryPath) return false; // Primary does not exist
      if (p === altPath) return true;    // Alternative exists
      return p in mockFsStore;
    });

    const updateData: PassageUpdateRequest = {
      type: 'linear',
      title: "'New Linear Title'",
      description: 'New Description for Linear',
      nextPassageId: 'constEvent-constChar-updatedNext',
      image: '', // Test setting image to empty
    };

    await passageManager.updatePassage(passageId, updateData);

    expect(fileSystem.writeFileSync).toHaveBeenCalledTimes(1);
    const [writtenPath, writtenContent] = (fileSystem.writeFileSync as jest.Mock).mock.calls[0];
    expect(writtenPath).toBe(altPath);

    expect(writtenContent).toContain(`export const intro = {`);
    expect(writtenContent).toContain(`title: _('New Linear Title')`);
    expect(writtenContent).toContain(`description: _('New Description for Linear')`);
    expect(writtenContent).toContain(`nextPassageId: 'constEvent-constChar-updatedNext'`);
    expect(writtenContent).toContain(`image: ''`);
    expect(writtenContent).toContain(`id: 'intro'`);
  });

  test('should update a transition passage, preserving unspecified fields', async () => {
    const passageId = 'transEvent-transChar-move';
    const filePath = getPrimaryPassagePath('transEvent', 'transChar', 'move');
    const originalContent = `
const _ = (str) => \`_('\${str}')\`;
export const movePassage = (s, e) => { // Name 'movePassage' matches funcNamePattern
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
      // Title and image are not provided in update, should be preserved
    };

    await passageManager.updatePassage(passageId, updateData);
    const [, writtenContent] = (fileSystem.writeFileSync as jest.Mock).mock.calls[0];

    expect(writtenContent).toContain(`type: 'transition'`);
    expect(writtenContent).toContain(`nextPassageId: 'transEvent-transChar-newTarget'`);
    expect(writtenContent).toContain(`title: _('Moving...')`); // Preserved
    expect(writtenContent).toContain(`image: 'move_img.jpg'`); // Preserved
  });

  describe('Error Handling', () => {
    test('should throw error for invalid passageId format', async () => {
      const invalidPassageId = 'invalidIdOnly';
      const updateData: PassageUpdateRequest = { type: 'screen', title: 't' };
      await expect(passageManager.updatePassage(invalidPassageId, updateData))
        .rejects
        .toThrow(`Invalid passageId format: ${invalidPassageId}`);
    });

    test('should throw error if passage file not found in primary or alternative paths', async () => {
      const passageId = 'notFound-event-char';
      (fileSystem.existsSync as jest.Mock).mockReturnValue(false); // No files exist

      const updateData: PassageUpdateRequest = { type: 'screen', title: 't' };
      const primaryPath = getPrimaryPassagePath('notFound', 'event', 'char');
      const altPath = getAlternativePassagePath('notFound', 'event', 'char');

      await expect(passageManager.updatePassage(passageId, updateData))
        .rejects
        .toThrow(`Passage file not found at primary path ${primaryPath} or alternative path ${altPath}`);
    });

    test('should throw error if passage definition (object or function) not found in file', async () => {
      const passageId = 'noDefEvent-noDefChar-noDefPassagePart';
      const filePath = getPrimaryPassagePath('noDefEvent', 'noDefChar', 'noDefPassagePart');
      const originalContent = `export const someOtherThing = 123; // No 'noDefPassagePartPassage' or 'noDefPassagePart'`;
      mockFsStore[filePath] = originalContent;
      (fileSystem.existsSync as jest.Mock).mockImplementation((p: string) => p === filePath);


      const updateData: PassageUpdateRequest = { type: 'screen', title: 't' };
      await expect(passageManager.updatePassage(passageId, updateData))
        .rejects
        .toThrow(`Could not find passage definition (object or function return) for 'noDefPassagePart' (tried patterns: noDefPassagePartPassage, noDefPassagePart) in ${filePath}`);
    });
  });

  describe('title i18n formatting variations', () => {
    const passageId = 'i18nEvent-i18nChar-i18nTitle';
    const filePath = getPrimaryPassagePath('i18nEvent', 'i18nChar', 'i18nTitle');
    const baseContent = (titleValue: string) => `
const _ = (str) => \`_('\${str}')\`; // For file content
export const i18nTitlePassage = (s,e) => {
    return {
        id: 'i18nTitle',
        type: 'screen',
        title: ${titleValue},
    };
};`;

    // Test cases for formatStringForI18nCode via updatePassage
    const testCases = [
      { input: 'Raw String', expected: `_('Raw String')` },
      { input: "'Quoted String'", expected: `_('Quoted String')` },
      { input: "_('Already Wrapped')", expected: `_('Already Wrapped')` },
      { input: '_("Double Wrapped")', expected: `_("Double Wrapped")` },
      { input: "_('  Spaced Wrapped  ')", expected: `_('  Spaced Wrapped  ')` }, // Stays as is because inner quotes match
      { input: "  Trim Me  ", expected: `_('Trim Me')` },
      { input: "  'Trim Quoted'  ", expected: `_('Trim Quoted')` },
      { input: "Text with 'single quotes'", expected: `_('Text with \\'single quotes\\'')` },
    ];

    testCases.forEach(({ input, expected }) => {
      test(`should format title "${input}" to "${expected}"`, async () => {
        mockFsStore = { [filePath]: baseContent('_("initial")') }; // Reset for each case
        (fileSystem.writeFileSync as jest.Mock).mockClear();


        const updateData: PassageUpdateRequest = { type: 'screen', title: input };
        await passageManager.updatePassage(passageId, updateData);

        expect(fileSystem.writeFileSync).toHaveBeenCalledTimes(1);
        const [, writtenContent] = (fileSystem.writeFileSync as jest.Mock).mock.calls[0];
        expect(writtenContent).toContain(`title: ${expected}`);
      });
    });
  });

  describe('Link Cost Stringification', () => {
    test('should correctly stringify various link costs in body', async () => {
      const passageId = 'costEvent-costChar-costTest';
      const filePath = getPrimaryPassagePath('costEvent', 'costChar', 'costTest');
      const originalContent = `
const _ = (str) => \`_('\${str}')\`;
const DeltaTime = { fromMin: (v) => \`DeltaTime.fromMin(\${v})\`, fromHours: (v) => \`DeltaTime.fromHours(\${v})\`, fromDays: (v) => \`DeltaTime.fromDays(\${v})\` };
export const costTestPassage = (s,e) => ({ id:'costTest', type:'screen', title:_('Costs'), body:[] });`;
      mockFsStore[filePath] = originalContent;


      const bodyWithVariousCosts: TPassageScreenBodyItemUpdateRequest[] = [
        {
          text: 'Test Costs',
          links: [
            { text: 'L1', passageId: 'p1', cost: { unit: 'min', value: 15 } },
            { text: 'L2', passageId: 'p2', cost: { unit: 'hour', value: 2 } },
            { text: 'L3', passageId: 'p3', cost: { unit: 'day', value: 3 } },
            { text: 'L4', passageId: 'p4', cost: { time: { unit: 'min', value: 30 } } },
            { text: 'L5', passageId: 'p5', cost: { items: [{id: 'wood', amount: 5}, {id: 'stone', amount: 2}] } },
            { text: 'L6', passageId: 'p6', cost: { tools: ['axe', 'pickaxe'] } },
            {
              text: 'L7', passageId: 'p7',
              cost: {
                time: { unit: 'hour', value: 1 },
                items: [{id: 'food', amount: 1}],
                tools: ['knife']
              }
            },
            { text: 'L8', passageId: 'p8', cost: { /* empty cost object */ } },
            { text: 'L9', passageId: 'p9', cost: { unit: 'min' as any, value: 1 } }, // testing unknown unit handling
          ],
        },
      ];

      const updateData: PassageUpdateRequest = { type: 'screen', body: bodyWithVariousCosts };
      await passageManager.updatePassage(passageId, updateData);

      const [, writtenContent] = (fileSystem.writeFileSync as jest.Mock).mock.calls[0];

      // Normalize whitespace for easier comparison of complex structures
      const normalize = (str: string) => str.replace(/\s+/g, ' ');

      expect(normalize(writtenContent)).toContain('cost: DeltaTime.fromMin(15)');
      expect(normalize(writtenContent)).toContain('cost: DeltaTime.fromHours(2)');
      expect(normalize(writtenContent)).toContain('cost: DeltaTime.fromDays(3)');
      expect(normalize(writtenContent)).toContain('cost: { time: DeltaTime.fromMin(30) }');
      expect(normalize(writtenContent)).toContain("cost: { items: [{ id: 'wood', amount: 5 }, { id: 'stone', amount: 2 }] }");
      expect(normalize(writtenContent)).toContain("cost: { tools: ['axe', 'pickaxe'] }");
      expect(normalize(writtenContent)).toContain("cost: { time: DeltaTime.fromHours(1), items: [{ id: 'food', amount: 1 }], tools: ['knife'] }");
      expect(normalize(writtenContent)).toContain('cost: { }'); // Empty cost object
      expect(normalize(writtenContent)).toContain('cost: {}'); // Unknown unit also results in {}
    });
  });
});
