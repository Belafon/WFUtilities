import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import path from 'path';
import * as ActualPaths from '../Paths'; // Assuming Paths.ts is in src/
import { fileSystem } from '../api/adapters/fileSystem'; // Assuming fileSystem.ts is in src/api/adapters/
import { passageManager } from '../api/services/passage.manager'; // Assuming passage.manager.ts is in src/api/services/
import { EditorAdapter } from '../api/adapters/editorAdapter'; // Import EditorAdapter for stubbing

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
    unlinkSyncStub = sinon.stub(fileSystem, 'unlinkSync');
    existsSyncStub = sinon.stub(fileSystem, 'existsSync');
    eventsDirStub = sinon.stub(ActualPaths, 'eventsDir').returns('./test_events_root_dir');
    
    // Stub the editor adapter notification methods directly on the passageManager's editorAdapter instance
    showInfoNotificationStub = sinon.stub(passageManager['editorAdapter'], 'showInformationNotification');
    showErrorNotificationStub = sinon.stub(passageManager['editorAdapter'], 'showErrorNotification');
    
    sinon.stub(console, 'log');
    sinon.stub(console, 'error');
  }

  function teardownStubs() {
    sinon.restore();
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

  test('should show error notification if passageId is invalid', async function() {
    setupStubs();
    
    try {
      const invalidPassageId = 'invalid-id-format';

      await passageManager.deletePassage(invalidPassageId);

      console.log('Error notification called?', showErrorNotificationStub.called);
      console.log('Call count:', showErrorNotificationStub.callCount);
      console.log('Call args:', showErrorNotificationStub.args);
      console.log('First call arg:', showErrorNotificationStub.firstCall?.args[0]);
      console.log('Regex test:', /Invalid passageId format/.test(showErrorNotificationStub.firstCall?.args[0] || ''));
      console.log('Match test:', sinon.match(/Invalid passageId format/).test(showErrorNotificationStub.firstCall?.args[0] || ''));

      assert.ok(showErrorNotificationStub.calledOnce, 'Error notification should be shown once');
      assert.ok(
        showErrorNotificationStub.calledWith(sinon.match(/Invalid passageId format/)), 
        'Error notification should contain proper message'
      );
      assert.ok(
        showErrorNotificationStub.calledWith(sinon.match(invalidPassageId)), 
        'Error notification should include the invalid ID'
      );
      assert.ok(unlinkSyncStub.notCalled, 'unlinkSync should not be called for invalid ID');
    } finally {
      teardownStubs();
    }
  });

  test('should show error notification if passage file is not found at either path', async function() {
    setupStubs();
    
    try {
      const passageId = 'eventGone-charLost-passageMissing';
      const primaryPath = getPrimaryPassagePath('eventGone', 'charLost', 'passageMissing');
      const alternativePath = getAlternativePassagePath('eventGone', 'charLost', 'passageMissing');

      existsSyncStub.withArgs(primaryPath).returns(false);
      existsSyncStub.withArgs(alternativePath).returns(false);

      await passageManager.deletePassage(passageId);

      assert.ok(showErrorNotificationStub.calledOnce, 'Error notification should be shown once');
      assert.ok(
        showErrorNotificationStub.calledWith(sinon.match(/Passage file to delete not found at/)), 
        'Error notification should contain proper message'
      );
      assert.ok(
        showErrorNotificationStub.calledWith(sinon.match(primaryPath)), 
        'Error notification should contain primary path'
      );
      assert.ok(
        showErrorNotificationStub.calledWith(sinon.match(alternativePath)), 
        'Error notification should contain alternative path'
      );
      assert.ok(unlinkSyncStub.notCalled, 'unlinkSync should not be called if file not found');
    } finally {
      teardownStubs();
    }
  });

  test('should show error notification if fileSystem.unlinkSync fails', async function() {
    setupStubs();
    
    try {
      const passageId = 'eventFail-charError-passageBad';
      const primaryPath = getPrimaryPassagePath('eventFail', 'charError', 'passageBad');
      const deletionError = new Error('Permission denied');

      existsSyncStub.withArgs(primaryPath).returns(true);
      unlinkSyncStub.withArgs(primaryPath).throws(deletionError);

      await passageManager.deletePassage(passageId);

      assert.ok(unlinkSyncStub.calledOnceWith(primaryPath), 'unlinkSync should be called');
      assert.ok((console.error as sinon.SinonStub).calledWith(sinon.match(/Error deleting passage file/), deletionError), 'Error message should be logged');
      assert.ok(showErrorNotificationStub.calledOnce, 'Error notification should be shown');
      assert.ok(showErrorNotificationStub.calledWith(sinon.match(/Failed to delete passage file: Permission denied/)), 'Error notification should contain proper message');
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

      await passageManager.deletePassage(passageId);

      assert.ok(unlinkSyncStub.calledOnceWith(primaryPath), 'unlinkSync should be called');
      assert.ok((console.error as sinon.SinonStub).calledWith(sinon.match(/Error deleting passage file/)), 'Error message should be logged');
      assert.ok(showErrorNotificationStub.calledOnce, 'Error notification should be shown');
      assert.ok(showErrorNotificationStub.calledWith(sinon.match(/Failed to delete passage file:/)), 'Error notification should contain proper message');
    } finally {
      teardownStubs();
    }
  });
});