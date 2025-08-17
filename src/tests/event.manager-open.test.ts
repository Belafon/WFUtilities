
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
const mockWorkspaceRoot = '/test-workspace-open';
const mockChapterFilePostfix = '.chapter.ts';

// --- Mock Configurations ---
const mockPathsConfiguration = {
  workspaceFolders: (): string => mockWorkspaceRoot,
  chaptersDir: (): string => path.join(mockWorkspaceRoot, 'src', 'data', 'chapters'),
  chapterFilePostfix: mockChapterFilePostfix,
};

let mockFsStore: { [filePath: string]: string } = {};

const mockFileSystemController: IFileSystem = {
  existsSync: (p: string): boolean => p in mockFsStore,
  readFileSync: (p: string, _encoding: string): string => {
    if (p in mockFsStore) return mockFsStore[p];
    const error: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${p}'`);
    error.code = 'ENOENT';
    throw error;
  },
  writeFileSync: (p: string, data: string): void => {
    mockFsStore[p] = data;
  },
  unlinkSync: (p: string): void => {
    delete mockFsStore[p];
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

suite('ChapterManager - openChapter', () => {
  let chapterManager: ChapterManager;
  let mockEditorAdapter: EditorAdapter;
  let showErrorNotificationSpy: sinon.SinonSpy;
  let showInformationNotificationSpy: sinon.SinonSpy;
  // CHANGE: Use SinonStub for openFile to control its behavior
  let openFileStub: sinon.SinonStub<[string], Promise<void>>;
  let consoleErrorSpy: sinon.SinonSpy;
  let consoleLogSpy: sinon.SinonSpy;

  const getChaptersDir = () => mockPathsConfiguration.chaptersDir();
  const getChapterFilePath = (chapterId: string) => {
    return path.join(getChaptersDir(), chapterId, `${chapterId}${mockPathsConfiguration.chapterFilePostfix}`);
  };

  setup(() => {
    mockFsStore = {};
    applyGlobalMocks();

    mockEditorAdapter = new DefaultEditorAdapter();
    showErrorNotificationSpy = sinon.spy(mockEditorAdapter, 'showErrorNotification');
    showInformationNotificationSpy = sinon.spy(mockEditorAdapter, 'showInformationNotification');

    // CHANGE: Use sinon.stub to replace the method and control its return value
    openFileStub = sinon.stub(mockEditorAdapter, 'openFile');
    
    // Set the mock editor adapter in the config
    config.setEditorAdapter(mockEditorAdapter);

    consoleErrorSpy = sinon.spy(console, 'error');
    consoleLogSpy = sinon.spy(console, 'log');

    // Create ChapterManager without arguments - it will use config
    chapterManager = new ChapterManager();
  });

  teardown(() => {
    sinon.restore(); // This will restore stubs as well
    // Reset config to default
    config.reset();
  });

  const chapterId = 'openTestChapter';
  const filePath = getChapterFilePath(chapterId);

  test('should successfully attempt to open an chapter file', async () => {
    mockFsStore[filePath] = "chapter content";
    // For a successful call, make the stub return a resolved Promise
    openFileStub.resolves(); // .resolves() is a shorthand for .returns(Promise.resolve())

    await chapterManager.openChapter(chapterId);

    assert.ok(openFileStub.calledOnceWith(filePath), 'editorAdapter.openFile not called or called with wrong path.');
    assert.ok(consoleLogSpy.calledWith(`Attempted to open chapter file: ${filePath}`), 'Log for open attempt not present or incorrect.');
    assert.ok(showErrorNotificationSpy.notCalled, 'Error notification should not have been shown for successful open.');
    assert.ok(showInformationNotificationSpy.notCalled, 'Information notification should not be shown for open.');
  });

  test('should throw error if chapterId is empty', async () => {
    let thrownError: Error | null = null;
    try {
      await chapterManager.openChapter('');
    } catch (error) {
      thrownError = error as Error;
    }

    assert.ok(thrownError, 'Expected an error to be thrown for empty chapterId.');
    assert.strictEqual(thrownError?.message, 'Chapter ID cannot be empty for opening.', 'Thrown error message incorrect.');
    assert.ok(openFileStub.notCalled, 'editorAdapter.openFile should not have been called.');
  });

  test('should throw error if chapter file not found', async () => {
    let thrownError: Error | null = null;
    try {
      await chapterManager.openChapter(chapterId);
    } catch (error) {
      thrownError = error as Error;
    }

    assert.ok(thrownError, 'Expected an error to be thrown for file not found.');
    assert.strictEqual(thrownError?.message, `Chapter file to open not found at ${filePath}`, 'Thrown error message incorrect.');
    assert.ok(openFileStub.notCalled, 'editorAdapter.openFile should not have been called.');
    assert.ok(consoleErrorSpy.notCalled, 'console.error should not be called for file not found case.');
  });

  test('should throw error if editorAdapter.openFile fails', async () => {
    mockFsStore[filePath] = "chapter content";
    const openError = new Error('Editor crashed');
    // Make the stub return a Promise that rejects with the error
    openFileStub.rejects(openError); // .rejects() is a shorthand for .returns(Promise.reject(...))

    let thrownError: Error | null = null;
    try {
      await chapterManager.openChapter(chapterId);
    } catch (error) {
      thrownError = error as Error;
    }

    assert.ok(thrownError, 'Expected an error to be thrown when openFile fails.');
    assert.strictEqual(thrownError, openError, 'Thrown error should be the same as the original error.');
    assert.ok(openFileStub.calledOnceWith(filePath), 'editorAdapter.openFile should have been called.');
    assert.ok(consoleErrorSpy.calledWith(sinon.match(`Error opening chapter file ${filePath}`), openError), 'Error log for openFile failure not present or incorrect.');
  });

  test('should handle non-Error objects thrown by editorAdapter.openFile', async () => {
    mockFsStore[filePath] = "chapter content";
    const openErrorString = "Unexpected editor problem"; // This is what Sinon puts in error.name

    openFileStub.rejects(openErrorString); // Sinon creates an Error obj: {name: "...", message: ""}

    let thrownError: Error | null = null;
    try {
      await chapterManager.openChapter(chapterId);
    } catch (error) {
      thrownError = error as Error;
    }

    assert.ok(thrownError, 'Expected an error to be thrown when openFile fails with non-Error object.');
    
    // ChapterManager will now use error.name, so this should match
    const expectedErrorMessage = `Failed to open chapter file ${filePath}: ${openErrorString}`;

    assert.ok(openFileStub.calledOnceWith(filePath), 'editorAdapter.openFile should have been called.');

    // console.error in ChapterManager logs the actual error object/string rejected by the promise
    // In this case, Sinon rejects with an Error object whose 'name' is our string.
    assert.ok(
      consoleErrorSpy.calledOnceWith(
        `Error opening chapter file ${filePath}:`,
        sinon.match.instanceOf(Error).and(sinon.match.has("name", openErrorString))
      ),
      `console.error call mismatch or not called as expected.
         Expected prefix: "Error opening chapter file ${filePath}:"
         Expected error value to be an Error with name: "${openErrorString}"
         Actual console.error args: ${consoleErrorSpy.firstCall?.args.map(a => JSON.stringify(a)).join(', ')}`
    );
  });
});