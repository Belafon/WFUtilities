import path from 'path';
import { EventUpdateRequest, SetTimeRequest, TimeRange } from '../../types'; // Adjust path as necessary
import { eventsDir, eventFilePostfix, getEventFilePath } from '../../Paths'; // Adjust path as necessary
import { DefaultEditorAdapter, EditorAdapter } from '../adapters/editorAdapter'; // Adjust path as necessary
import { TypeScriptCodeBuilder, TypeScriptObjectBuilder } from '../../typescriptObjectParser/ObjectParser'; // Adjust path as necessary
import { CodeLiteral, ObjectToStringConverter } from '../../utils/objectToStringConverter'; // Adjust path as necessary
import { config } from '../../WFServerConfig';
import { logger } from '../../utils/logger';
import { templateManager } from '../../templates/TemplateManager';
import { createServer } from '../../index';
import { IEventParams as TEventParams } from '../../templates/TempalteGenerator';
import { registerFileManager } from '../../register/RegisterFileManager';

/**
 * Event Manager Service
 * Handles business logic for event operations
 */
export class EventManager {
  private objectConverter: ObjectToStringConverter;

  constructor() {
    this.objectConverter = new ObjectToStringConverter('  '); // Default indent unit: 2 spaces
  }

  /**
   * Updates an event with the provided data.
   * Assumes that if a field is present in eventData, it should be updated.
   * If a field is undefined in eventData, it's left unchanged in the file.
   * @param eventId The ID of the event to update (e.g., 'kingdom')
   * @param eventData The data to update the event with.
   */
  public async updateEvent(eventId: string, eventData: EventUpdateRequest): Promise<void> {

    const eventFilePath = getEventFilePath(eventId);

    let eventFileContent: string | null = null;
    if (!config.fileSystem.existsSync(eventFilePath)) {
      
      // create new event
      eventFileContent = await this.createNewEvent(eventId, eventFileContent, eventFilePath);
    }

    try {
      const originalContent = config.fileSystem.readFileSync(eventFilePath, 'utf-8');
      const codeBuilder = new TypeScriptCodeBuilder(originalContent);
      const eventObjectName = `${eventId}Event`;
      let eventObjectBuilder: TypeScriptObjectBuilder | null = null;

      codeBuilder.findObject(eventObjectName, {
        onFound: (objBuilder: TypeScriptObjectBuilder) => { eventObjectBuilder = objBuilder; },
        onNotFound: () => { }
      });

      if (!eventObjectBuilder) {
        const errorMessage = `Could not find event object definition for '${eventObjectName}' in ${eventFilePath}`;
        config.editorAdapter.showErrorNotification(errorMessage);
        throw new Error(errorMessage);
      }

      const builder = eventObjectBuilder as TypeScriptObjectBuilder;

      if (eventData.title !== undefined) {
        builder.setPropertyValue('title', this.formatStringForI18nCode(eventData.title));
      }
      if (eventData.description !== undefined) {
        builder.setPropertyValue('description', this.formatStringForI18nCode(eventData.description));
      }
      if (eventData.location !== undefined) {
        builder.setPropertyValue('location', `'${eventData.location}'`);
      }
      if (eventData.timeRange !== undefined) {
        const timeRangeObject = {
          start: new CodeLiteral(`Time.fromString('${eventData.timeRange.start}')`),
          end: new CodeLiteral(`Time.fromString('${eventData.timeRange.end}')`)
        };
        const timeRangeString = this.objectConverter.convert(timeRangeObject);
        builder.setPropertyValue('timeRange', timeRangeString);
      }

      const updatedContent = await codeBuilder.toString();
      config.fileSystem.writeFileSync(eventFilePath, updatedContent, 'utf-8');
      config.editorAdapter.showInformationNotification(`Event '${eventId}' updated successfully.`);
      console.log(`Event '${eventId}' updated successfully in ${eventFilePath}`);

    } catch (error) {
      const errorMessage = `Failed to update event '${eventId}': ${error instanceof Error ? error.message : String(error)}`;
      config.editorAdapter.showErrorNotification(errorMessage);
      console.error(errorMessage, error);
      throw error;
    }
  }

  private async createNewEvent(eventId: string, eventFileContent: string | null, eventFilePath: string) {
    try {

      // create event file from template
      const templateGenerationOutput = await templateManager.generateAndSaveEvent({
        eventId: eventId,
      });
      if (!templateGenerationOutput.success) {
        const errorMessage = `Failed to create new event file for '${eventId}': ${templateGenerationOutput.error}`;
        config.editorAdapter.showErrorNotification(errorMessage);
        throw new Error(errorMessage);
      }

      eventFileContent = templateGenerationOutput.content;

      // add eventPassages file from template
      const eventPassagesFileGenerationOutput = await templateManager.generateAndSaveEventPassages({
        eventId: eventId
      });
      if (!eventPassagesFileGenerationOutput.success) {
        const errorMessage = `Failed to create new event passages file for '${eventId}': ${eventPassagesFileGenerationOutput.error}`;
        config.editorAdapter.showErrorNotification(errorMessage);
        throw new Error(errorMessage);
      }

      // add event to register
      await registerFileManager.addEventToRegister(eventId, eventFilePath);
      return eventFileContent;
    } catch (error) {
      this.deleteEvent(eventId).catch((err) => {
        console.error(`Failed to rollback event deletion for '${eventId}':`, err);
      });
      throw error;
    }
  }

  private formatStringForI18nCode(value: string): string {
    const trimmedValue = value.trim();
    if (trimmedValue.startsWith("_(") && trimmedValue.endsWith(")")) {
      const inner = trimmedValue.substring(2, trimmedValue.length - 1).trim();
      if ((inner.startsWith("'") && inner.endsWith("'")) || (inner.startsWith('"') && inner.endsWith('"'))) {
        return trimmedValue;
      }
    }
    if ((trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) || (trimmedValue.startsWith('"') && trimmedValue.endsWith('"'))) {
      const bareString = trimmedValue.substring(1, trimmedValue.length - 1);
      return `_('${bareString.replace(/'/g, "\\'")}')`;
    }
    return `_('${trimmedValue.replace(/'/g, "\\'")}')`;
  }

  /**
   * Deletes an event file.
   * @param eventId The ID of the event to delete.
   */
  public async deleteEvent(eventId: string): Promise<void> {
    if (!eventId || eventId.trim() === '') {
      const errorMessage = 'Event ID cannot be empty for deletion.';
      config.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }

    const eventFilePath = getEventFilePath(eventId);

    if (!config.fileSystem.existsSync(eventFilePath)) {
      const errorMessage = `Event file to delete not found at ${eventFilePath}`;
      config.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      config.fileSystem.unlinkSync(eventFilePath);
      config.editorAdapter.showInformationNotification(`Event file ${eventFilePath} deleted successfully.`);
      console.log(`Event file ${eventFilePath} deleted successfully.`);
    } catch (error) {
      const errorMessageText = `Failed to delete event file ${eventFilePath}: ${error instanceof Error ? error.message : String(error)}`;
      config.editorAdapter.showErrorNotification(errorMessageText);
      console.error(`Error deleting event file ${eventFilePath}:`, error);
      throw error;
    }
  }

  /**
   * Opens an event file in the configured editor.
   * @param eventId The ID of the event to open.
   */
  public async openEvent(eventId: string): Promise<void> {
    logger.info(`Attempting to open event with ID: ${eventId}`);
    if (!eventId || eventId.trim() === '') {
      logger.error('Event ID cannot be empty for opening.');
      const errorMessage = 'Event ID cannot be empty for opening.';
      config.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }

    const eventFilePath = getEventFilePath(eventId);
    logger.info(`Event file path resolved to: ${eventFilePath}`);

    if (!config.fileSystem.existsSync(eventFilePath)) {
      const errorMessage = `Event file to open not found at ${eventFilePath}`;
      config.editorAdapter.showErrorNotification(errorMessage);
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      await config.editorAdapter.openFile(eventFilePath);
      logger.info(`Event file ${eventFilePath} opened successfully.`);
      console.log(`Attempted to open event file: ${eventFilePath}`);
    } catch (error) {
      logger.error(`Failed to open event file ${eventFilePath}:`, error);
      let detailMessage = '';
      if (error instanceof Error) {
        detailMessage = (error as Error).message || (error as any).name || String(error); // Prioritize message, then name, then full string
      } else {
        detailMessage = String(error);
      }

      const errorMessageText = `Failed to open event file ${eventFilePath}: ${detailMessage}`;

      config.editorAdapter.showErrorNotification(errorMessageText);
      console.error(`Error opening event file ${eventFilePath}:`, error);
      logger.error(`Error opening event file ${eventFilePath}:`, error);
      throw error;
    }
    logger.info(`Event file ${eventFilePath} opened successfully.`);
  }

  /**
   * Sets the time range for an event.
   * @param eventId The ID of the event
   * @param timeRange The time range to set
   */
  public async setEventTime(eventId: string, timeRange: SetTimeRequest['timeRange']): Promise<void> {
    if (!timeRange || timeRange.start === undefined || timeRange.end === undefined) {
      const errorMessage = 'Invalid timeRange provided for setEventTime. Both start and end are required.';
      config.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }
    const eventUpdateData = { timeRange } as EventUpdateRequest;
    await this.updateEvent(eventId, eventUpdateData);
    console.log(`Time range for event '${eventId}' set successfully via updateEvent.`);
  }
}

export const eventManager = new EventManager();