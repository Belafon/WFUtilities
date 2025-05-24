import * as assert from 'assert';
import path from 'path';
import sinon from 'sinon';

// --- SUT and Types ---
import { EventManager } from '../api/services/event.manager'; // Adjust path
import { EditorAdapter, DefaultEditorAdapter } from '../api/adapters/editorAdapter'; // Adjust path
import { config } from '../WFServerConfig'; // Import the config object

// --- Modules to be Mocked ---
import * as ActualPaths from '../Paths'; // Adjust path
import { IFileSystem } from '../api/adapters/fileSystem'; // Adjust path

// --- Test Constants ---
const mockWorkspaceRoot = '/test-workspace-delete'; // Use a distinct root for clarity if needed
const mockEventFilePostfix = '.event.ts';

// --- Mock Configurations ---
const mockPathsConfiguration = {
  workspaceFolders: (): string => mockWorkspaceRoot,
  eventsDir: (): string => path.join(mockWorkspaceRoot, 'src', 'data', 'events'),
  eventFilePostfix: mockEventFilePostfix,
};

let mockFsStore: { [filePath: string]: string } = {};
let unlinkSyncCalls: string[] = []; // Track unlinkSync calls

const mockFileSystemController: IFileSystem = {
  existsSync: (p: string): boolean => p in mockFsStore,
  readFileSync: (p: string, _encoding: string): string => { // Not used by deleteEvent directly but for completeness
    if (p in mockFsStore) return mockFsStore[p];
    const error: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${p}'`);
    error.code = 'ENOENT';
    throw error;
  },
  writeFileSync: (p: string, data: string): void => { // Not used by deleteEvent
    mockFsStore[p] = data;
  },
  unlinkSync: (p: string): void => {
    if (!(p in mockFsStore)) { // Simulate ENOENT if file doesn't exist in mock store before unlinking
      const error: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, unlink '${p}'`);
      error.code = 'ENOENT';
      throw error;
    }
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
  (ActualPaths as any).eventFilePostfix = mockPathsConfiguration.eventFilePostfix;
  
  // Set the mock file system in the config
  config.setFileSystem(mockFileSystemController);
}

suite('EventManager - deleteEvent', () => {
  let eventManager: EventManager;
  let mockEditorAdapter: EditorAdapter;
  let showErrorNotificationSpy: sinon.SinonSpy;
  let showInformationNotificationSpy: sinon.SinonSpy;
  let consoleErrorSpy: sinon.SinonSpy;
  let consoleLogSpy: sinon.SinonSpy;

  const getEventsDir = () => mockPathsConfiguration.eventsDir();
  const getEventFilePath = (eventId: string) => {
    return path.join(getEventsDir(), `${eventId}${mockPathsConfiguration.eventFilePostfix}`);
  };

  setup(() => {
    mockFsStore = {};
    unlinkSyncCalls = [];
    applyGlobalMocks();

    // Create the mock editor adapter
    mockEditorAdapter = new DefaultEditorAdapter();
    showErrorNotificationSpy = sinon.spy(mockEditorAdapter, 'showErrorNotification');
    showInformationNotificationSpy = sinon.spy(mockEditorAdapter, 'showInformationNotification');
    
    // Set the mock editor adapter in the config
    config.setEditorAdapter(mockEditorAdapter);

    consoleErrorSpy = sinon.spy(console, 'error');
    consoleLogSpy = sinon.spy(console, 'log');

    // Create an instance of EventManager - no arguments needed
    eventManager = new EventManager();
  });

  teardown(() => {
    sinon.restore();
    // Reset the config to default values
    config.reset();
  });

  const eventId = 'deleteTestEvent';
  const filePath = getEventFilePath(eventId);

  test('should successfully delete an event file', async () => {
    mockFsStore[filePath] = "event content"; // File needs to exist in mock store to be deleted

    await eventManager.deleteEvent(eventId);

    assert.strictEqual(unlinkSyncCalls.length, 1, 'unlinkSync should have been called once.');
    assert.strictEqual(unlinkSyncCalls[0], filePath, 'unlinkSync called with incorrect path.');
    assert.ok(!(filePath in mockFsStore), 'File should be removed from mockFsStore.');
    assert.ok(showInformationNotificationSpy.calledOnceWith(`Event file ${filePath} deleted successfully.`), 'Success notification not shown or incorrect.');
    assert.ok(consoleLogSpy.calledWith(`Event file ${filePath} deleted successfully.`), 'Success log not present or incorrect.');
    assert.ok(showErrorNotificationSpy.notCalled, 'Error notification should not have been shown.');
  });

  test('should throw error if eventId is empty', async () => {
    await assert.rejects(
      async () => eventManager.deleteEvent(''),
      new Error('Event ID cannot be empty for deletion.')
    );

    assert.strictEqual(unlinkSyncCalls.length, 0, 'unlinkSync should not have been called.');
  });

  test('should throw error if event file not found', async () => {
    // Ensure file does NOT exist in mockFsStore
    await assert.rejects(
      async () => eventManager.deleteEvent(eventId),
      new Error(`Event file to delete not found at ${filePath}`)
    );

    assert.strictEqual(unlinkSyncCalls.length, 0, 'unlinkSync should not have been called.');
  });

  test('should throw error if fileSystem.unlinkSync fails', async () => {
    mockFsStore[filePath] = "event content"; // File exists initially
    const unlinkError = new Error('Permission Denied');

    // Sabotage unlinkSync - now using config.fileSystem
    const originalUnlinkSync = config.fileSystem.unlinkSync;
    const unlinkSyncStub = sinon.stub(config.fileSystem, 'unlinkSync').throws(unlinkError);

    await assert.rejects(
      async () => eventManager.deleteEvent(eventId),
      unlinkError
    );

    assert.ok(unlinkSyncStub.calledOnceWith(filePath), 'Mocked unlinkSync should have been called.');
    assert.ok(consoleErrorSpy.calledWith(sinon.match(`Error deleting event file ${filePath}`), unlinkError), 'Error log for unlinkSync failure not present or incorrect.');

    // Restore the stub
    unlinkSyncStub.restore();
  });

  test('should handle non-Error objects thrown by unlinkSync', async () => {
    mockFsStore[filePath] = "event content";
    const unlinkErrorString = "Disk quota exceeded"; // The string we tell Sinon to "throw"

    // Stub unlinkSync to throw the string (Sinon will wrap it in an Error)
    const unlinkSyncStub = sinon.stub(config.fileSystem, 'unlinkSync').throws(unlinkErrorString);

    await assert.rejects(
      async () => eventManager.deleteEvent(eventId),
      (error: Error) => error.message.includes('Sinon-provided Disk quota exceeded')
    );

    // For console.error, test that it received both parts (first string argument and second error argument)
    assert.ok(
      consoleErrorSpy.calledWith(
        sinon.match(`Error deleting event file ${filePath}`), // Matches the first argument (string prefix)
        sinon.match.has("message", `Sinon-provided ${unlinkErrorString}`) // Check for the specific error message
      ),
      `Error log for non-Error unlinkSync failure not present or incorrect.
         Console error args: ${JSON.stringify(consoleErrorSpy.firstCall?.args)}`
    );

    unlinkSyncStub.restore();
  });
});