import * as assert from 'assert';
import path from 'path';
import sinon from 'sinon';

// --- SUT and Types ---
import { ChapterManager } from '../api/services/chapter.manager'; // Adjust path
import { EditorAdapter, DefaultEditorAdapter } from '../api/adapters/editorAdapter'; // Adjust path
import { config } from '../WFServerConfig'; // Import the config object

// --- Modules to be Mocked ---
import * as ActualPaths from '../Paths'; // Adjust path
import { IFileSystem } from '../api/adapters/fileSystem'; // Adjust path

// --- Test Constants ---
const mockWorkspaceRoot = '/test-workspace-delete'; // Use a distinct root for clarity if needed
const mockChapterFilePostfix = '.chapter.ts';

// --- Mock Configurations ---
const mockPathsConfiguration = {
  workspaceFolders: (): string => mockWorkspaceRoot,
  chaptersDir: (): string => path.join(mockWorkspaceRoot, 'src', 'data', 'chapters'),
  chapterFilePostfix: mockChapterFilePostfix,
};

let mockFsStore: { [filePath: string]: string } = {};
let unlinkSyncCalls: string[] = []; // Track unlinkSync calls

const mockFileSystemController: IFileSystem = {
  existsSync: (p: string): boolean => p in mockFsStore,
  readFileSync: (p: string, _encoding: string): string => { // Not used by deleteChapter directly but for completeness
    if (p in mockFsStore) return mockFsStore[p];
    const error: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${p}'`);
    error.code = 'ENOENT';
    throw error;
  },
  writeFileSync: (p: string, data: string): void => { // Not used by deleteChapter
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
  (ActualPaths as any).chaptersDir = mockPathsConfiguration.chaptersDir;
  (ActualPaths as any).chapterFilePostfix = mockPathsConfiguration.chapterFilePostfix;
  
  // Set the mock file system in the config
  config.setFileSystem(mockFileSystemController);
}

suite('ChapterManager - deleteChapter', () => {
  let chapterManager: ChapterManager;
  let mockEditorAdapter: EditorAdapter;
  let showErrorNotificationSpy: sinon.SinonSpy;
  let showInformationNotificationSpy: sinon.SinonSpy;
  let consoleErrorSpy: sinon.SinonSpy;
  let consoleLogSpy: sinon.SinonSpy;

  const getChaptersDir = () => mockPathsConfiguration.chaptersDir();
  const getChapterFilePath = (chapterId: string) => {
    return path.join(getChaptersDir(), chapterId, `${chapterId}${mockPathsConfiguration.chapterFilePostfix}`);
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

    // Create an instance of ChapterManager - no arguments needed
    chapterManager = new ChapterManager();
  });

  teardown(() => {
    sinon.restore();
    // Reset the config to default values
    config.reset();
  });

  const chapterId = 'deleteTestChapter';
  const filePath = getChapterFilePath(chapterId);

  test('should successfully delete an chapter file', async () => {
    mockFsStore[filePath] = "chapter content"; // File needs to exist in mock store to be deleted

    await chapterManager.deleteChapter(chapterId);

    assert.strictEqual(unlinkSyncCalls.length, 1, 'unlinkSync should have been called once.');
    assert.strictEqual(unlinkSyncCalls[0], filePath, 'unlinkSync called with incorrect path.');
    assert.ok(!(filePath in mockFsStore), 'File should be removed from mockFsStore.');
    assert.ok(showInformationNotificationSpy.calledOnceWith(`Chapter file ${filePath} deleted successfully.`), 'Success notification not shown or incorrect.');
    assert.ok(consoleLogSpy.calledWith(`Chapter file ${filePath} deleted successfully.`), 'Success log not present or incorrect.');
    assert.ok(showErrorNotificationSpy.notCalled, 'Error notification should not have been shown.');
  });

  test('should throw error if chapterId is empty', async () => {
    await assert.rejects(
      async () => chapterManager.deleteChapter(''),
      new Error('Chapter ID cannot be empty for deletion.')
    );

    assert.strictEqual(unlinkSyncCalls.length, 0, 'unlinkSync should not have been called.');
  });

  test('should throw error if chapter file not found', async () => {
    // Ensure file does NOT exist in mockFsStore
    await assert.rejects(
      async () => chapterManager.deleteChapter(chapterId),
      new Error(`Chapter file to delete not found at ${filePath}`)
    );

    assert.strictEqual(unlinkSyncCalls.length, 0, 'unlinkSync should not have been called.');
  });

  test('should throw error if fileSystem.unlinkSync fails', async () => {
    mockFsStore[filePath] = "chapter content"; // File exists initially
    const unlinkError = new Error('Permission Denied');

    // Sabotage unlinkSync - now using config.fileSystem
    const originalUnlinkSync = config.fileSystem.unlinkSync;
    const unlinkSyncStub = sinon.stub(config.fileSystem, 'unlinkSync').throws(unlinkError);

    await assert.rejects(
      async () => chapterManager.deleteChapter(chapterId),
      unlinkError
    );

    assert.ok(unlinkSyncStub.calledOnceWith(filePath), 'Mocked unlinkSync should have been called.');
    assert.ok(consoleErrorSpy.calledWith(sinon.match(`Error deleting chapter file ${filePath}`), unlinkError), 'Error log for unlinkSync failure not present or incorrect.');

    // Restore the stub
    unlinkSyncStub.restore();
  });

  test('should handle non-Error objects thrown by unlinkSync', async () => {
    mockFsStore[filePath] = "chapter content";
    const unlinkErrorString = "Disk quota exceeded"; // The string we tell Sinon to "throw"

    // Stub unlinkSync to throw the string (Sinon will wrap it in an Error)
    const unlinkSyncStub = sinon.stub(config.fileSystem, 'unlinkSync').throws(unlinkErrorString);

    await assert.rejects(
      async () => chapterManager.deleteChapter(chapterId),
      (error: Error) => error.message.includes('Sinon-provided Disk quota exceeded')
    );

    // For console.error, test that it received both parts (first string argument and second error argument)
    assert.ok(
      consoleErrorSpy.calledWith(
        sinon.match(`Error deleting chapter file ${filePath}`), // Matches the first argument (string prefix)
        sinon.match.has("message", `Sinon-provided ${unlinkErrorString}`) // Check for the specific error message
      ),
      `Error log for non-Error unlinkSync failure not present or incorrect.
         Console error args: ${JSON.stringify(consoleErrorSpy.firstCall?.args)}`
    );

    unlinkSyncStub.restore();
  });
});