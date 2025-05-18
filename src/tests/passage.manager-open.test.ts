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
let openFileStub: sinon.SinonStub; // Added for openPassage

const getPrimaryPassagePath = (eventId: string, characterId: string, passagePartId: string) => {
  return path.join(
    ActualPaths.eventsDir(),
    eventId,
    `${characterId}${ActualPaths.evnetPassagesFilePostfixWithoutFileType}`,
    `${passagePartId}${ActualPaths.passageFilePostfix}`
  );
};

const getAlternativePassagePath = (eventId: string, characterId: string, passagePartId: string) => {
  return path.join(
    ActualPaths.eventsDir(),
    eventId,
    characterId,
    'passages',
    `${passagePartId}${ActualPaths.passageFilePostfix}`
  );
};

// Use suite for the outer grouping with TDD interface
suite('PassageManager - openPassage', function() {
  // Re-use setupStubs and teardownStubs from deletePassage tests or define them locally if preferred
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

      await passageManager.openPassage(passageId);

      assert.ok(existsSyncStub.calledWith(expectedPrimaryPath), 'existsSync should check primary path');
      assert.ok(openFileStub.calledOnceWith(expectedPrimaryPath), 'editorAdapter.openFile should be called once with primary path');
      assert.ok(showErrorNotificationStub.notCalled, 'No error notification should be shown');
      assert.ok((console.log as sinon.SinonStub).calledWith(sinon.match(`Attempted to open passage file: ${expectedPrimaryPath}`)), 'Success log message expected');
    } finally {
      teardownStubs();
    }
  });

  test('should successfully open a passage at the alternative path if primary not found', async function() {
    setupStubs();
    try {
      const passageId = 'eventOpen-charAlt-passageFile';
      const primaryPath = getPrimaryPassagePath('eventOpen', 'charAlt', 'passageFile');
      const expectedAlternativePath = getAlternativePassagePath('eventOpen', 'charAlt', 'passageFile');

      existsSyncStub.withArgs(primaryPath).returns(false);
      existsSyncStub.withArgs(expectedAlternativePath).returns(true);
      openFileStub.withArgs(expectedAlternativePath).resolves(); // Simulate successful file open

      await passageManager.openPassage(passageId);

      assert.ok(existsSyncStub.calledWith(primaryPath), 'existsSync should check primary path first');
      assert.ok(existsSyncStub.calledWith(expectedAlternativePath), 'existsSync should check alternative path');
      assert.ok(openFileStub.calledOnceWith(expectedAlternativePath), 'editorAdapter.openFile should be called once with alternative path');
      assert.ok(showErrorNotificationStub.notCalled, 'No error notification should be shown');
      assert.ok((console.log as sinon.SinonStub).calledWith(sinon.match(`Attempted to open passage file: ${expectedAlternativePath}`)), 'Success log message expected');
    } finally {
      teardownStubs();
    }
  });

  test('should show error notification if passageId is invalid (openPassage)', async function() {
    setupStubs();
    try {
      const invalidPassageId = 'invalid-id-format'; // This ID is caught by your validatePassageId function

      await passageManager.openPassage(invalidPassageId);

      const expectedMessage = `Invalid passageId format: ${invalidPassageId}. Expected format: eventId-characterId-passagePartId`;
      assert.ok(showErrorNotificationStub.calledOnceWith(expectedMessage), 
        `Error notification should be shown with message: "${expectedMessage}". Got: ${showErrorNotificationStub.firstCall?.args[0]}`
      );
      assert.ok(openFileStub.notCalled, 'editorAdapter.openFile should not be called for invalid ID');
      assert.ok(existsSyncStub.notCalled, 'existsSync should not be called for invalid ID before validation');
    } finally {
      teardownStubs();
    }
  });
  
  test('should show error notification if passageId is syntactically valid but parts are problematic (openPassage)', async function() {
    setupStubs();
    try {
      // This ID 'id-id-id' is a specific case where the middle part 'id' is invalid according to your validatePassageId
      const invalidPassageId = 'id-id-id'; 

      await passageManager.openPassage(invalidPassageId);

      const expectedMessage = `Invalid passageId format: ${invalidPassageId}. Expected format: eventId-characterId-passagePartId`;
      assert.ok(showErrorNotificationStub.calledOnceWith(expectedMessage), 
        `Error notification should be shown with message: "${expectedMessage}". Got: ${showErrorNotificationStub.firstCall?.args[0]}`
      );
      assert.ok(openFileStub.notCalled, 'editorAdapter.openFile should not be called');
    } finally {
      teardownStubs();
    }
  });


  test('should show error notification if passage file is not found at either path (openPassage)', async function() {
    setupStubs();
    try {
      const passageId = 'eventMissing-charGone-passageLost';
      const primaryPath = getPrimaryPassagePath('eventMissing', 'charGone', 'passageLost');
      const alternativePath = getAlternativePassagePath('eventMissing', 'charGone', 'passageLost');

      existsSyncStub.withArgs(primaryPath).returns(false);
      existsSyncStub.withArgs(alternativePath).returns(false);

      await passageManager.openPassage(passageId);

      const expectedMessage = `Passage file to open not found at primary path ${primaryPath} or alternative path ${alternativePath}`;
      assert.ok(showErrorNotificationStub.calledOnceWith(expectedMessage), 
        `Error notification should be shown with message: "${expectedMessage}". Got: ${showErrorNotificationStub.firstCall?.args[0]}`
      );
      assert.ok(openFileStub.notCalled, 'editorAdapter.openFile should not be called if file not found');
    } finally {
      teardownStubs();
    }
  });

  test('should show error notification if editorAdapter.openFile fails', async function() {
    setupStubs();
    try {
      const passageId = 'eventOpen-charFail-passageError';
      const primaryPath = getPrimaryPassagePath('eventOpen', 'charFail', 'passageError');
      const openError = new Error('Editor failed to open file');

      existsSyncStub.withArgs(primaryPath).returns(true);
      openFileStub.withArgs(primaryPath).rejects(openError); // Simulate editorAdapter.openFile failing

      await passageManager.openPassage(passageId);

      assert.ok(openFileStub.calledOnceWith(primaryPath), 'editorAdapter.openFile should be called');
      assert.ok((console.error as sinon.SinonStub).calledWith(sinon.match(/Error opening passage file/), openError), 'Error message should be logged to console');
      assert.ok(showErrorNotificationStub.calledOnce, 'Error notification should be shown');
      const expectedMessage = `Failed to open passage file ${primaryPath}: ${openError.message}`;
      assert.ok(showErrorNotificationStub.calledWith(expectedMessage), 
        `Error notification should contain proper message. Expected: "${expectedMessage}". Got: ${showErrorNotificationStub.firstCall?.args[0]}`
      );
    } finally {
      teardownStubs();
    }
  });
  
  test('should show error notification if editorAdapter.openFile fails with non-Error object', async function() {
    setupStubs();
    try {
      const passageId = 'eventOpen-charNonError-passageOddFail';
      const primaryPath = getPrimaryPassagePath('eventOpen', 'charNonError', 'passageOddFail');
      const openErrorString = "Editor crashed unexpectedly";

      existsSyncStub.withArgs(primaryPath).returns(true);
      // Use Promise.reject directly to reject with a string
      openFileStub.withArgs(primaryPath).returns(Promise.reject(openErrorString));

      await passageManager.openPassage(passageId);

      assert.ok(openFileStub.calledOnceWith(primaryPath), 'editorAdapter.openFile should be called');
      assert.ok((console.error as sinon.SinonStub).calledWith(sinon.match(/Error opening passage file/)), 'Error message should be logged to console');
      assert.ok(showErrorNotificationStub.calledOnce, 'Error notification should be shown');
      
      const expectedMessage = `Failed to open passage file ${primaryPath}: ${openErrorString}`;
      assert.ok(showErrorNotificationStub.calledWith(sinon.match(expectedMessage)), 
        `Error notification should contain proper message. Expected to match: "${expectedMessage}". Got: ${showErrorNotificationStub.firstCall?.args[0]}`
      );
    } finally {
      teardownStubs();
    }
  });
});