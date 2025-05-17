import * as assert from 'assert';
import path from 'path';
import sinon from 'sinon';

// --- SUT and Types ---
import { EventManager } from '../api/services/event.manager'; // Adjust path
import { EditorAdapter, DefaultEditorAdapter } from '../api/adapters/editorAdapter'; // Adjust path

// --- Modules to be Mocked ---
import * as ActualPaths from '../Paths'; // Adjust path
import * as ActualFileSystemModule from '../api/adapters/fileSystem'; // Adjust path
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
};

function applyGlobalMocks() {
  (ActualPaths as any).workspaceFolders = mockPathsConfiguration.workspaceFolders;
  (ActualPaths as any).eventsDir = mockPathsConfiguration.eventsDir;
  (ActualPaths as any).eventFilePostfix = mockPathsConfiguration.eventFilePostfix;
  (ActualFileSystemModule as any).fileSystem = mockFileSystemController;
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

    mockEditorAdapter = new DefaultEditorAdapter();
    showErrorNotificationSpy = sinon.spy(mockEditorAdapter, 'showErrorNotification');
    showInformationNotificationSpy = sinon.spy(mockEditorAdapter, 'showInformationNotification');
    // No showWarningNotificationSpy needed for deleteEvent/openEvent specific tests unless you add warnings there.

    consoleErrorSpy = sinon.spy(console, 'error');
    consoleLogSpy = sinon.spy(console, 'log');


    eventManager = new EventManager(mockEditorAdapter);
  });

  teardown(() => {
    sinon.restore();
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

  test('should show error notification if eventId is empty', async () => {
    await eventManager.deleteEvent('');

    assert.strictEqual(unlinkSyncCalls.length, 0, 'unlinkSync should not have been called.');
    assert.ok(showErrorNotificationSpy.calledOnceWith('Event ID cannot be empty for deletion.'), 'Error notification for empty eventId not shown or incorrect.');
    assert.ok(consoleErrorSpy.calledWith('Event ID cannot be empty for deletion.'), 'Error log for empty eventId not present.');
  });

  test('should show error notification if event file not found', async () => {
    // Ensure file does NOT exist in mockFsStore
    await eventManager.deleteEvent(eventId);

    assert.strictEqual(unlinkSyncCalls.length, 0, 'unlinkSync should not have been called.');
    assert.ok(showErrorNotificationSpy.calledOnceWith(`Event file to delete not found at ${filePath}`), 'Error notification for file not found not shown or incorrect.');
    assert.ok(consoleErrorSpy.calledWith(`Event file to delete not found at ${filePath}`), 'Error log for file not found not present.');
  });

  test('should show error notification if fileSystem.unlinkSync fails', async () => {
    mockFsStore[filePath] = "event content"; // File exists initially
    const unlinkError = new Error('Permission Denied');

    // Sabotage unlinkSync
    const originalUnlinkSync = mockFileSystemController.unlinkSync;
    mockFileSystemController.unlinkSync = sinon.stub().throws(unlinkError);

    await eventManager.deleteEvent(eventId);

    assert.ok((mockFileSystemController.unlinkSync as sinon.SinonStub).calledOnceWith(filePath), 'Mocked unlinkSync should have been called.');
    const expectedErrorMessage = `Failed to delete event file ${filePath}: ${unlinkError.message}`;
    assert.ok(showErrorNotificationSpy.calledOnceWith(expectedErrorMessage), 'Error notification for unlinkSync failure not shown or incorrect.');
    assert.ok(consoleErrorSpy.calledWith(sinon.match(`Error deleting event file ${filePath}`), unlinkError), 'Error log for unlinkSync failure not present or incorrect.');

    // Restore
    mockFileSystemController.unlinkSync = originalUnlinkSync;
  });

  test('should handle non-Error objects thrown by unlinkSync', async () => {
    mockFsStore[filePath] = "event content";
    const unlinkErrorString = "Disk quota exceeded"; // The string we tell Sinon to "throw"

    const originalUnlinkSync = mockFileSystemController.unlinkSync;
    // Stub unlinkSync to throw the string (Sinon will wrap it in an Error)
    const unlinkSyncStub = sinon.stub(mockFileSystemController, 'unlinkSync').throws(unlinkErrorString);

    await eventManager.deleteEvent(eventId);

    // The message in the Error object thrown by Sinon will be prefixed
    const sinonGeneratedErrorMessage = `Sinon-provided ${unlinkErrorString}`;
    const expectedNotificationMessage = `Failed to delete event file ${filePath}: ${sinonGeneratedErrorMessage}`;

    assert.ok(
      showErrorNotificationSpy.calledOnceWith(expectedNotificationMessage),
      `Error notification for non-Error unlinkSync failure not shown or incorrect.
         Expected: "${expectedNotificationMessage}"
         Got: "${showErrorNotificationSpy.firstCall?.args[0]}"`
    );

    // For console.error, your EventManager logs the caught error object itself.
    // We need to check that the error object passed to console.error has the Sinon-generated message.
    assert.ok(
      consoleErrorSpy.calledWith(
        sinon.match(`Error deleting event file ${filePath}`), // Matches the first argument (string prefix)
        sinon.match.has("message", sinonGeneratedErrorMessage) // Matches the second argument (the error object)
        // by checking its 'message' property.
      ),
      `Error log for non-Error unlinkSync failure not present or incorrect.
         Console error args: ${JSON.stringify(consoleErrorSpy.firstCall?.args)}`
    );

    unlinkSyncStub.restore();
  });
});