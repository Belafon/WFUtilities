import * as assert from 'assert';
import path from 'path';
import sinon from 'sinon'; // Using sinon for spies and stubs

// --- SUT and Types ---
import { EventManager } from '../api/services/event.manager'; // Adjust path
import { EventUpdateRequest, TimeRange } from '../types'; // Adjust path
import { EditorAdapter, DefaultEditorAdapter } from '../api/adapters/editorAdapter'; // Adjust path
import { config } from '../WFServerConfig'; // Import the config object

// --- Modules to be Mocked ---
import * as ActualPaths from '../Paths'; // Adjust path
import { IFileSystem } from '../api/adapters/fileSystem'; // Adjust path

// --- Test Constants ---
const mockWorkspaceRoot = '/test-workspace';
const mockEventFilePostfix = '.event.ts'; // Matches what EventManager uses

// --- Mock Configurations ---
const mockPathsConfiguration = {
  workspaceFolders: (): string => mockWorkspaceRoot,
  eventsDir: (): string => path.join(mockWorkspaceRoot, 'src', 'data', 'events'),
  eventFilePostfix: mockEventFilePostfix,
  // Add other Paths properties if EventManager uses them, though it seems to only use eventsDir and eventFilePostfix
};

let mockFsStore: { [filePath: string]: string } = {};
let writeFileSyncCalls: Array<{ path: string, data: string }> = [];
// No unlinkSyncCalls needed for these methods

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
  unlinkSync: (p: string): void => { // Not used by updateEvent/setEventTime, but good for IFileSystem completeness
    delete mockFsStore[p];
  },
  // mkdirSync, statSync, isDirectory etc. would be here if IFileSystem defined them and EventManager used them
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
  (ActualPaths as any).eventFilePostfix = mockPathsConfiguration.eventFilePostfix;
  
  // Set the mock file system in the config
  config.setFileSystem(mockFileSystemController);
}

// Helper to normalize string content for easier comparison
const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();

suite('EventManager - updateEvent & setEventTime', () => {
  let eventManager: EventManager;
  let mockEditorAdapter: EditorAdapter;
  let showErrorNotificationSpy: sinon.SinonSpy;
  let showInformationNotificationSpy: sinon.SinonSpy;
  let showWarningNotificationSpy: sinon.SinonSpy;

  const getEventsDir = () => mockPathsConfiguration.eventsDir();
  const getEventFilePath = (eventId: string) => {
    return path.join(getEventsDir(), eventId, `${eventId}${mockPathsConfiguration.eventFilePostfix}`);
  };

  setup(() => {
    mockFsStore = {};
    writeFileSyncCalls = [];
    applyGlobalMocks();

    // Create a new mock editor adapter for each test to ensure spies are fresh
    mockEditorAdapter = new DefaultEditorAdapter(); // Or your custom mock implementation
    showErrorNotificationSpy = sinon.spy(mockEditorAdapter, 'showErrorNotification');
    showInformationNotificationSpy = sinon.spy(mockEditorAdapter, 'showInformationNotification');
    showWarningNotificationSpy = sinon.spy(mockEditorAdapter, 'showWarningNotification');
    
    // Set the mock editor adapter in the config
    config.setEditorAdapter(mockEditorAdapter);

    // Create EventManager without arguments - it will use config
    eventManager = new EventManager();
  });

  teardown(() => {
    sinon.restore(); // Restores all stubs and spies created by sinon
    // Reset config to default
    config.reset();
  });

  suite('updateEvent', () => {
    const eventId = 'testEvent';
    const filePath = getEventFilePath(eventId);

    const originalEventContent = (
        title = "_('Original Title')",
        description = "_('Original Description')",
        location = "'original_location'",
        timeRangeStart = "'1.1. 10:00'",
        timeRangeEnd = "'1.1. 12:00'"
    ) => `
// Mocked imports for test file content
const _ = (str) => \`_('\${str}')\`;
const Time = {
    fromString: (val) => \`Time.fromString(\${val})\`,
};

// Actual event structure
export const ${eventId}Event = {
    eventId: '${eventId}',
    title: ${title},
    description: ${description},
    location: ${location},
    timeRange: {
        start: Time.fromString(${timeRangeStart}),
        end: Time.fromString(${timeRangeEnd}),
    },
    children: [],
    triggers: [],
    init: {},
};`;

    test('should update all event properties successfully', async () => {
      mockFsStore[filePath] = originalEventContent();

      const updateData: EventUpdateRequest = {
        title: 'New Awesome Title',
        description: '  A brand new description for testing  ',
        location: 'new_event_location',
        timeRange: {
          start: '2.2. 14:00',
          end: '2.2. 18:00',
        },
      };

      await eventManager.updateEvent(eventId, updateData);

      assert.strictEqual(writeFileSyncCalls.length, 1, 'writeFileSync should have been called once.');
      const { path: writtenPath, data: writtenContent } = writeFileSyncCalls[0];
      assert.strictEqual(writtenPath, filePath, 'writeFileSync called with incorrect path.');

      const normContent = normalize(writtenContent);
      assert.ok(normContent.includes(normalize(`title: _('New Awesome Title')`)), 'Updated title not found or incorrect.');
      assert.ok(normContent.includes(normalize(`description: _('A brand new description for testing')`)), 'Updated description not found or incorrect.');
      assert.ok(normContent.includes(normalize(`location: 'new_event_location'`)), 'Updated location not found or incorrect.');
      assert.ok(normContent.includes(normalize(`start: Time.fromString('2.2. 14:00')`)), 'Updated timeRange.start not found or incorrect.');
      assert.ok(normContent.includes(normalize(`end: Time.fromString('2.2. 18:00')`)), 'Updated timeRange.end not found or incorrect.');
      assert.ok(normContent.includes(normalize(`export const ${eventId}Event = {`)), 'Event object definition missing.');
      assert.ok(showInformationNotificationSpy.calledOnceWith(sinon.match(/updated successfully/)), 'Success notification not shown.');
    });

    test('should update only title and preserve other fields', async () => {
      mockFsStore[filePath] = originalEventContent();
      const newTitle = 'Only Title Updated';
      const updateData: Partial<EventUpdateRequest> = { title: newTitle }; // Testing partial update

      await eventManager.updateEvent(eventId, updateData as EventUpdateRequest);

      assert.strictEqual(writeFileSyncCalls.length, 1);
      const { data: writtenContent } = writeFileSyncCalls[0];
      const normContent = normalize(writtenContent);

      assert.ok(normContent.includes(normalize(`title: _('${newTitle}')`)), 'Updated title incorrect.');
      // Check that original values are preserved
      assert.ok(normContent.includes(normalize(`description: _('Original Description')`)), 'Original description not preserved.');
      assert.ok(normContent.includes(normalize(`location: 'original_location'`)), 'Original location not preserved.');
      assert.ok(normContent.includes(normalize(`start: Time.fromString('1.1. 10:00')`)), 'Original timeRange.start not preserved.');
    });

    test('should correctly format title if already wrapped with _() but no inner quotes', async () => {
        mockFsStore[filePath] = originalEventContent();
        const newTitleInput = "_('Title with inner quotes')";
        const updateData: Partial<EventUpdateRequest> = { title: newTitleInput };

        await eventManager.updateEvent(eventId, updateData as EventUpdateRequest);
        const { data: writtenContent } = writeFileSyncCalls[0];
        assert.ok(writtenContent.includes(`title: _('Title with inner quotes')`), "Title with existing _() and inner quotes not handled correctly.");
    });

    test('should correctly format title with single quotes inside', async () => {
      mockFsStore[filePath] = originalEventContent();
      const newTitle = "Title with 'single' quotes";
      const updateData: Partial<EventUpdateRequest> = { title: newTitle };

      await eventManager.updateEvent(eventId, updateData as EventUpdateRequest);
      const { data: writtenContent } = writeFileSyncCalls[0];
      assert.ok(writtenContent.includes(`title: _('Title with \\'single\\' quotes')`), "Title with single quotes not escaped correctly.");
    });

    test('should throw error if eventId is empty', async () => {
      const updateData: EventUpdateRequest = { title: 'T', description: 'D', location: 'L', timeRange: {start:'s', end:'e'} };
      await assert.rejects(
        async () => eventManager.updateEvent('', updateData),
        new Error('Event ID cannot be empty.')
      );
      assert.strictEqual(writeFileSyncCalls.length, 0);
    });

    test('should throw error if event file not found', async () => {
      const nonExistentEventId = 'nonExistentEvent';
      const updateData: EventUpdateRequest = { title: 'T', description: 'D', location: 'L', timeRange: {start:'s', end:'e'} };
      const expectedPath = getEventFilePath(nonExistentEventId);

      await assert.rejects(
        async () => eventManager.updateEvent(nonExistentEventId, updateData),
        (error: Error) => error.message.includes(`no such file or directory`)
      );
      assert.strictEqual(writeFileSyncCalls.length, 0);
    });

    test('should throw error if event object (e.g., testEventEvent) not found in file', async () => {
      const fileContentWithoutEventObject = `export const someOtherObject = {};`;
      mockFsStore[filePath] = fileContentWithoutEventObject;
      const updateData: EventUpdateRequest = { title: 'T', description: 'D', location: 'L', timeRange: {start:'s', end:'e'} };
      const expectedObjectName = `${eventId}Event`; // eventId is 'testEvent'

      // This part correctly checks that the expected error is ultimately thrown and rejected.
      await assert.rejects(
        async () => eventManager.updateEvent(eventId, updateData),
        new Error(`Could not find event object definition for '${expectedObjectName}' in ${filePath}`)
      );

      // Ensure writeFileSync was not called
      assert.strictEqual(writeFileSyncCalls.length, 0);
    });    test('should propagate error if writeFileSync fails', async () => {
        mockFsStore[filePath] = originalEventContent();
        const updateData: EventUpdateRequest = { title: 'New Title', description: 'D', location: 'L', timeRange: {start:'s', end:'e'} };
        const writeError = new Error('Disk full');

        // Sabotage writeFileSync for this test
        const writeFileSyncStub = sinon.stub(config.fileSystem, 'writeFileSync').throws(writeError);

        await assert.rejects(
            async () => eventManager.updateEvent(eventId, updateData),
            writeError // Expect the original error to be re-thrown
        );

        // Restore original writeFileSync
        writeFileSyncStub.restore();
    });
  });

  suite('setEventTime', () => {
    const eventId = 'timeSetEvent';
    const filePath = getEventFilePath(eventId);

    const originalEventContentForTimeSet = `
const _ = (str) => \`_('\${str}')\`;
const Time = { fromString: (val) => \`Time.fromString(\${val})\` };
export const ${eventId}Event = {
    eventId: '${eventId}',
    title: _('Original Title'),
    description: _('Original Description'),
    location: 'original_location',
    timeRange: {
        start: Time.fromString('1.1. 00:00'),
        end: Time.fromString('1.1. 01:00'),
    },
};`;

    test('should call updateEvent with correct parameters and update timeRange', async () => {
      mockFsStore[filePath] = originalEventContentForTimeSet;
      const newTimeRange: TimeRange = {
        start: '3.3. 08:00',
        end: '3.3. 12:30',
      };

      // Spy on the updateEvent method of the specific eventManager instance
      const updateEventSpy = sinon.spy(eventManager, 'updateEvent');

      await eventManager.setEventTime(eventId, newTimeRange);

      assert.ok(updateEventSpy.calledOnce, 'updateEvent was not called by setEventTime.');
      assert.deepStrictEqual(updateEventSpy.firstCall.args[0], eventId, 'updateEvent called with wrong eventId.');
      // Check that updateEvent was called with an object that *only* contains timeRange
      const expectedUpdateData = { timeRange: newTimeRange } as EventUpdateRequest;
      assert.deepStrictEqual(updateEventSpy.firstCall.args[1], expectedUpdateData, 'updateEvent called with wrong data.');

      // Verify the file was actually written with the new time (by the spied updateEvent)
      assert.strictEqual(writeFileSyncCalls.length, 1, 'writeFileSync should have been called once via updateEvent.');
      const { data: writtenContent } = writeFileSyncCalls[0];
      const normContent = normalize(writtenContent);

      assert.ok(normContent.includes(normalize(`start: Time.fromString('${newTimeRange.start}')`)), 'Updated timeRange.start not found.');
      assert.ok(normContent.includes(normalize(`end: Time.fromString('${newTimeRange.end}')`)), 'Updated timeRange.end not found.');
      assert.ok(normContent.includes(normalize(`title: _('Original Title')`)), 'Original title not preserved.'); // Check other fields preserved
      assert.ok(showInformationNotificationSpy.calledOnceWith(sinon.match(/updated successfully/)), 'Success notification from underlying updateEvent not shown.');
    });

    test('should throw error and show notification if timeRange is invalid (e.g., missing start)', async () => {
      const invalidTimeRange = { end: '1.1. 10:00' } as any as TimeRange; // Cast to bypass TS for test

      await assert.rejects(
        async () => eventManager.setEventTime(eventId, invalidTimeRange),
        new Error('Invalid timeRange provided for setEventTime. Both start and end are required.')
      );
      assert.ok(showErrorNotificationSpy.calledOnceWith('Invalid timeRange provided for setEventTime. Both start and end are required.'), 'Error notification for invalid timeRange not shown.');
      assert.strictEqual(writeFileSyncCalls.length, 0);
    });

    test('should propagate errors from updateEvent (e.g., file not found)', async () => {
        const nonExistentEventId = 'noFileForTimeSet';
        const timeRange: TimeRange = { start: '1.1. 10:00', end: '1.1. 11:00' };
        const expectedPath = getEventFilePath(nonExistentEventId);

        // updateEvent will be called by setEventTime and should throw
        await assert.rejects(
            async () => eventManager.setEventTime(nonExistentEventId, timeRange),
            (error: Error) => error.message.includes('no such file or directory')
        );
    });
  });
});