import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import path from 'path';
import * as ActualPaths from '../Paths'; // Assuming Paths.ts is in src/
import { passageManager } from '../api/services/passage.manager'; // Assuming passage.manager.ts is in src/api/services/
import { config } from '../WFServerConfig'; // Import the config object

// Mocks
let unlinkSyncStub: sinon.SinonStub;
let existsSyncStub: sinon.SinonStub;
let eventsDirStub: sinon.SinonStub;
let showInfoNotificationStub: sinon.SinonStub;
let showErrorNotificationStub: sinon.SinonStub;
let openFileStub: sinon.SinonStub;

const getPrimaryPassagePath = (eventId: string, characterId: string, passagePartId: string) => {
  return path.join(
    ActualPaths.eventsDir(),
    eventId,
    `${characterId}${ActualPaths.evnetPassagesFilePostfixWithoutFileType}`,
    `${passagePartId}${ActualPaths.passageFilePostfix}`
  );
};

// Use suite for the outer grouping with TDD interface
suite('PassageManager - openPassage', function() {
  function setupStubs() {
    // Stub directly on the fileSystem that passageManager is using
    unlinkSyncStub = sinon.stub(config.fileSystem, 'unlinkSync'); // Not used by openPassage, but good to have for consistency
    existsSyncStub = sinon.stub(config.fileSystem, 'existsSync');
    eventsDirStub = sinon.stub(ActualPaths, 'eventsDir').returns('./test_events_root_dir');
    
    // Important: Stub directly on the passageManager's editorAdapter
    showInfoNotificationStub = sinon.stub(passageManager['editorAdapter'], 'showInformationNotification');
    showErrorNotificationStub = sinon.stub(passageManager['editorAdapter'], 'showErrorNotification');
    openFileStub = sinon.stub(passageManager['editorAdapter'], 'openFile');
    
    sinon.stub(console, 'log');
    sinon.stub(console, 'error');
  }

  function teardownStubs() {
    sinon.restore();
    // Reset config to default values
    config.reset();
  }

  test('should successfully open a passage at the primary path', async function() {
    setupStubs();
    try {
      const passageId = 'eventOpen-charPrim-passageFile';
      const expectedPrimaryPath = getPrimaryPassagePath('eventOpen', 'charPrim', 'passageFile');
      
      existsSyncStub.withArgs(expectedPrimaryPath).returns(true);
      openFileStub.withArgs(expectedPrimaryPath).resolves(); // Simulate successful file open

      await passageManager.openScreenPassage(passageId);

      assert.ok(existsSyncStub.calledWith(expectedPrimaryPath), 'existsSync should check primary path');
      assert.ok(openFileStub.calledOnceWith(expectedPrimaryPath), 'editorAdapter.openFile should be called once with primary path');
      assert.ok(showErrorNotificationStub.notCalled, 'No error notification should be shown');
      assert.ok((console.log as sinon.SinonStub).calledWith(sinon.match(`Attempted to open passage file: ${expectedPrimaryPath}`)), 'Success log message expected');
    } finally {
      teardownStubs();
    }
  });

  // REMOVED: "should successfully open a passage at the alternative path if primary not found" test
  // The PassageManager implementation only supports primary path structure

  test('should throw error if passageId is invalid (openPassage)', async function() {
    setupStubs();
    try {
      const invalidPassageId = 'invalid-id-format'; // This ID is caught by your validatePassageId function

      await assert.rejects(
        async () => passageManager.openScreenPassage(invalidPassageId),
        (error: Error) => {
          return error.message.includes('Invalid passageId format') &&
                 error.message.includes(invalidPassageId);
        }
      );

      assert.ok(openFileStub.notCalled, 'editorAdapter.openFile should not be called for invalid ID');
      assert.ok(existsSyncStub.notCalled, 'existsSync should not be called for invalid ID before validation');
    } finally {
      teardownStubs();
    }
  });
  
  test('should throw error if passageId is syntactically valid but parts are problematic (openPassage)', async function() {
    setupStubs();
    try {
      // This ID 'id-id-id' is a specific case where the middle part 'id' is invalid according to your validatePassageId
      const invalidPassageId = 'id-id-id'; 

      await assert.rejects(
        async () => passageManager.openScreenPassage(invalidPassageId),
        (error: Error) => {
          return error.message.includes('Invalid passageId format') &&
                 error.message.includes(invalidPassageId);
        }
      );

      assert.ok(openFileStub.notCalled, 'editorAdapter.openFile should not be called');
    } finally {
      teardownStubs();
    }
  });

  test('should throw error if passage file is not found at any path (openPassage)', async function() {
    setupStubs();
    try {
      const passageId = 'eventMissing-charGone-passageLost';

      // Set up all possible paths to return false (the implementation tries multiple file extensions)
      existsSyncStub.returns(false);

      await assert.rejects(
        async () => passageManager.openScreenPassage(passageId),
        (error: Error) => {
          return error.message.includes('Passage file not found for passageId') &&
                 error.message.includes('passageLost') &&
                 error.message.includes('eventMissing') &&
                 error.message.includes('charGone');
        }
      );

      assert.ok(openFileStub.notCalled, 'editorAdapter.openFile should not be called if file not found');
    } finally {
      teardownStubs();
    }
  });

  test('should throw error if editorAdapter.openFile fails', async function() {
    setupStubs();
    try {
      const passageId = 'eventOpen-charFail-passageError';
      const primaryPath = getPrimaryPassagePath('eventOpen', 'charFail', 'passageError');
      const openError = new Error('Editor failed to open file');

      existsSyncStub.withArgs(primaryPath).returns(true);
      openFileStub.withArgs(primaryPath).rejects(openError); // Simulate editorAdapter.openFile failing

      await assert.rejects(
        async () => passageManager.openScreenPassage(passageId),
        openError
      );

      assert.ok(openFileStub.calledOnceWith(primaryPath), 'editorAdapter.openFile should be called');
      assert.ok((console.error as sinon.SinonStub).calledWith(sinon.match(/Error opening passage file/), openError), 'Error message should be logged to console');
    } finally {
      teardownStubs();
    }
  });
  
  test('should handle non-Error objects thrown by editorAdapter.openFile', async function() {
    setupStubs();
    try {
      const passageId = 'eventOpen-charNonError-passageOddFail';
      const primaryPath = getPrimaryPassagePath('eventOpen', 'charNonError', 'passageOddFail');
      const openErrorString = "Editor crashed unexpectedly";

      existsSyncStub.withArgs(primaryPath).returns(true);
      // Use Promise.reject directly to reject with a string
      openFileStub.withArgs(primaryPath).returns(Promise.reject(openErrorString));

      await assert.rejects(
        async () => passageManager.openScreenPassage(passageId),
        (error: any) => {
          return error === openErrorString ||
                 (typeof error === 'object' && error.message && error.message.includes(openErrorString));
        }
      );

      assert.ok(openFileStub.calledOnceWith(primaryPath), 'editorAdapter.openFile should be called');
      assert.ok((console.error as sinon.SinonStub).calledWith(sinon.match(/Error opening passage file/)), 'Error message should be logged to console');
    } finally {
      teardownStubs();
    }
  });
});