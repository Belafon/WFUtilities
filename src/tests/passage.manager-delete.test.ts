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

const getPrimaryPassagePath = (eventId: string, characterId: string, passagePartId: string) => {
  return path.join(
    ActualPaths.eventsDir(), // This will call the stubbed function during tests
    eventId,
    `${characterId}${ActualPaths.evnetPassagesFilePostfixWithoutFileType}`, // Uses actual constant from Paths
    `${passagePartId}${ActualPaths.passageFilePostfix}` // Uses actual constant from Paths
  );
};

const getAlternativePassagePath = (eventId: string, characterId: string, passagePartId: string) => {
  return path.join(
    ActualPaths.eventsDir(), // This will call the stubbed function during tests
    eventId,
    characterId,
    'passages',
    `${passagePartId}${ActualPaths.passageFilePostfix}` // Uses actual constant from Paths
  );
};

// Use suite for the outer grouping with TDD interface
suite('PassageManager - deletePassage', function() {
  // We need to set up stubs within each test since beforeEach/afterEach aren't working as expected
  function setupStubs() {
    // Stub methods directly on the fileSystem that passageManager is using
    unlinkSyncStub = sinon.stub(config.fileSystem, 'unlinkSync');
    existsSyncStub = sinon.stub(config.fileSystem, 'existsSync');
    eventsDirStub = sinon.stub(ActualPaths, 'eventsDir').returns('./test_events_root_dir');
    
    // Stub the editor adapter notification methods directly on passageManager's editorAdapter
    showInfoNotificationStub = sinon.stub(passageManager['editorAdapter'], 'showInformationNotification');
    showErrorNotificationStub = sinon.stub(passageManager['editorAdapter'], 'showErrorNotification');
    
    sinon.stub(console, 'log');
    sinon.stub(console, 'error');
  }

  function teardownStubs() {
    sinon.restore();
    // Reset config to default values
    config.reset();
  }

  test('should successfully delete a passage at the primary path', async function() {
    setupStubs();
    
    try {
      const passageId = 'eventA-charB-passageC';
      const expectedPrimaryPath = getPrimaryPassagePath('eventA', 'charB', 'passageC');
  
      existsSyncStub.withArgs(expectedPrimaryPath).returns(true);
      unlinkSyncStub.withArgs(expectedPrimaryPath).returns(undefined);
  
      await passageManager.deletePassage(passageId);
  
      assert.ok(existsSyncStub.calledWith(expectedPrimaryPath), 'existsSync should check primary path');
      assert.ok(unlinkSyncStub.calledOnceWith(expectedPrimaryPath), 'unlinkSync should be called once with primary path');
      assert.ok((console.log as sinon.SinonStub).calledWith(sinon.match(/deleted successfully/)), 'Success message should be logged');
      assert.ok(showInfoNotificationStub.calledWith(sinon.match(/deleted successfully/)), 'Information notification should be shown');
    } finally {
      teardownStubs();
    }
  });

  test('should successfully delete a passage at the alternative path if primary not found', async function() {
    setupStubs();
    
    try {
      const passageId = 'eventX-charY-passageZ';
      const primaryPath = getPrimaryPassagePath('eventX', 'charY', 'passageZ');
      const expectedAlternativePath = getAlternativePassagePath('eventX', 'charY', 'passageZ');
  
      existsSyncStub.withArgs(primaryPath).returns(false);
      existsSyncStub.withArgs(expectedAlternativePath).returns(true);
      unlinkSyncStub.withArgs(expectedAlternativePath).returns(undefined);
  
      await passageManager.deletePassage(passageId);
  
      assert.ok(existsSyncStub.calledWith(primaryPath), 'existsSync should check primary path first');
      assert.ok(existsSyncStub.calledWith(expectedAlternativePath), 'existsSync should check alternative path');
      assert.ok(unlinkSyncStub.calledOnceWith(expectedAlternativePath), 'unlinkSync should be called once with alternative path');
      assert.ok((console.log as sinon.SinonStub).calledWith(sinon.match(/deleted successfully/)), 'Success message should be logged');
      assert.ok(showInfoNotificationStub.calledWith(sinon.match(/deleted successfully/)), 'Information notification should be shown');
    } finally {
      teardownStubs();
    }
  });

  test('should throw error if passageId is invalid', async function() {
    setupStubs();
    
    try {
      const invalidPassageId = 'invalid-id-format';

      await assert.rejects(
        async () => passageManager.deletePassage(invalidPassageId),
        (error: Error) => {
          return error.message.includes('Invalid passageId format') && 
                 error.message.includes(invalidPassageId);
        }
      );

      assert.ok(unlinkSyncStub.notCalled, 'unlinkSync should not be called for invalid ID');
    } finally {
      teardownStubs();
    }
  });

  test('should throw error if passage file is not found at either path', async function() {
    setupStubs();
    
    try {
      const passageId = 'eventGone-charLost-passageMissing';
      const primaryPath = getPrimaryPassagePath('eventGone', 'charLost', 'passageMissing');
      const alternativePath = getAlternativePassagePath('eventGone', 'charLost', 'passageMissing');

      existsSyncStub.withArgs(primaryPath).returns(false);
      existsSyncStub.withArgs(alternativePath).returns(false);

      await assert.rejects(
        async () => passageManager.deletePassage(passageId),
        (error: Error) => {
          return error.message.includes('Passage file to delete not found at') &&
                 error.message.includes(primaryPath) &&
                 error.message.includes(alternativePath);
        }
      );

      assert.ok(unlinkSyncStub.notCalled, 'unlinkSync should not be called if file not found');
    } finally {
      teardownStubs();
    }
  });

  test('should throw error if fileSystem.unlinkSync fails', async function() {
    setupStubs();
    
    try {
      const passageId = 'eventFail-charError-passageBad';
      const primaryPath = getPrimaryPassagePath('eventFail', 'charError', 'passageBad');
      const deletionError = new Error('Permission denied');

      existsSyncStub.withArgs(primaryPath).returns(true);
      unlinkSyncStub.withArgs(primaryPath).throws(deletionError);

      await assert.rejects(
        async () => passageManager.deletePassage(passageId),
        deletionError
      );

      assert.ok(unlinkSyncStub.calledOnceWith(primaryPath), 'unlinkSync should be called');
      assert.ok((console.error as sinon.SinonStub).calledWith(sinon.match(/Error deleting passage file/), deletionError), 'Error message should be logged');
    } finally {
      teardownStubs();
    }
  });

  test('should handle non-Error objects thrown by unlinkSync', async function() {
    setupStubs();
    
    try {
      const passageId = 'eventWeird-charStrange-passageOdd';
      const primaryPath = getPrimaryPassagePath('eventWeird', 'charStrange', 'passageOdd');
      const deletionErrorString = "Unexpected unlink issue";

      existsSyncStub.withArgs(primaryPath).returns(true);
      unlinkSyncStub.withArgs(primaryPath).throws(deletionErrorString);

      await assert.rejects(
        async () => passageManager.deletePassage(passageId),
        (error: any) => {
          return error === deletionErrorString ||
                 (typeof error === 'object' && error.message && error.message.includes('Sinon-provided'));
        }
      );

      assert.ok(unlinkSyncStub.calledOnceWith(primaryPath), 'unlinkSync should be called');
      assert.ok((console.error as sinon.SinonStub).calledWith(sinon.match(/Error deleting passage file/)), 'Error message should be logged');
    } finally {
      teardownStubs();
    }
  });
});