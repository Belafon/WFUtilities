import path from 'path';
import { EventUpdateRequest, SetTimeRequest, TimeRange, TChildEvent } from '../../types';
import { eventsDir, eventFilePostfix, getEventFilePath } from '../../Paths';
import { TypeScriptCodeBuilder } from '../../typescriptObjectParser/ObjectParser';
import { TypeScriptObjectBuilder } from "../../typescriptObjectParser/TypeScriptObjectBuilder";
import { CodeLiteral, ObjectToStringConverter } from '../../utils/objectToStringConverter';
import { config } from '../../WFServerConfig';
import { logger } from '../../utils/logger';
import { templateManager } from '../../templates/TemplateManager';
import { registerFileManager } from '../../register/RegisterFileManager';
import { EventTemplateVariables } from '../../templates/event.template';
import { worldStateFileManager } from '../../register/WorldStateFileManager';
import { isoTimeConverter as IsoTimeConverter } from '../../utils/IsoTimeConverter';

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
    if (!eventId || eventId.trim() === '') {
      logger.error('Event ID cannot be empty.');
      const errorMessage = 'Event ID cannot be empty.';
      config.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }
    logger.info(`Updating event with ID: ${eventId}`);

    const eventFilePath = getEventFilePath(eventId);
    logger.info(`Event file path resolved to: ${eventFilePath}`);

    let eventFileContent: string | null = null;
    if (!config.fileSystem.existsSync(eventFilePath)) {
      logger.info(`Event file not found at ${eventFilePath}, creating new event.`);
      // create new event
      eventFileContent = await this.createNewEvent(eventId, eventFileContent, eventFilePath);
      logger.info(`New event file created at ${eventFilePath}`);
    }

    try {
      if (eventFileContent === null) {
        eventFileContent = config.fileSystem.readFileSync(eventFilePath, 'utf-8');
      }

      // convert time range from ISO to app format
      let convertedTimeRange: { start?: string; end?: string } | undefined;
      if (eventData.timeRange) {
        convertedTimeRange = IsoTimeConverter.convertTimeRangeFromIso(eventData.timeRange);
        logger.info(`Converted time range from ISO to app format:`, {
          original: eventData.timeRange,
          converted: convertedTimeRange
        });
      }

      const eventTemplateVariables = new EventTemplateVariables(
        eventId,
        eventData.title || '',
        eventData.description || '',
        eventData.location || 'village',
        convertedTimeRange?.start || '0.0. 0:00',
        convertedTimeRange?.end || '0.0. 0:00'
      );
      logger.info(`Event template variables created for event ID: ${eventId}`, eventTemplateVariables);
      logger.info(`Event file content length: ${eventFileContent.length} characters`);
      logger.info(`Event eventId: ${eventTemplateVariables.eventId}`);
      logger.info(`Event title: ${eventTemplateVariables.title}`);
      logger.info(`Event description: ${eventTemplateVariables.description}`);
      logger.info(`Event location: ${eventTemplateVariables.location}`);
      logger.info(`Event timeStart: ${eventTemplateVariables.timeStart}`);
      logger.info(`Event timeEnd: ${eventTemplateVariables.timeEnd}`);

      const codeBuilder = new TypeScriptCodeBuilder(eventFileContent);
      const eventObjectName = eventTemplateVariables.mainEventFunction;
      let eventObjectBuilder: TypeScriptObjectBuilder | null = null;

      codeBuilder.findObject(eventObjectName, {
        onFound: (objBuilder: TypeScriptObjectBuilder) => {
          logger.info(`Found event object builder for '${eventObjectName}'`);
          eventObjectBuilder = objBuilder;
        },
        onNotFound: () => {
          logger.error(`Could not find event object builder for '${eventObjectName}'`);
        }
      });

      if (!eventObjectBuilder) {
        const errorMessage = `Could not find event object definition for '${eventObjectName}' in ${eventFilePath}`;
        config.editorAdapter.showErrorNotification(errorMessage);
        throw new Error(errorMessage);
      }

      const builder = eventObjectBuilder as TypeScriptObjectBuilder;

      if (eventData.title !== undefined) {
        logger.info(`Setting event title to: ${eventData.title}`);
        builder.setPropertyValue(
          eventTemplateVariables.propertyNames.title,
          this.formatStringForI18nCode(eventData.title)
        );
      }

      if (eventData.description !== undefined) {
        logger.info(`Setting event description to: ${eventData.description}`);
        builder.setPropertyValue(
          eventTemplateVariables.propertyNames.description,
          this.formatStringForI18nCode(eventData.description)
        );
      }

      if (eventData.location !== undefined) {
        logger.info(`Setting event location to: ${eventData.location}`);
        builder.setPropertyValue(
          eventTemplateVariables.propertyNames.location,
          eventTemplateVariables.quotedLocation
        );
      }

      if (eventData.timeRange !== undefined) {
        logger.info(`Setting event time range to: ${JSON.stringify(eventData.timeRange)}`);
        const timeRangeObject = {
          start: new CodeLiteral(`Time.fromString(${eventTemplateVariables.quotedTimeStart})`),
          end: new CodeLiteral(`Time.fromString(${eventTemplateVariables.quotedTimeEnd})`)
        };
        logger.info(`Setting event time range to: ${JSON.stringify(timeRangeObject)}`);
        const timeRangeString = this.objectConverter.convert(timeRangeObject);
        logger.info(`Formatted time range string: ${timeRangeString}`);
        builder.setPropertyValue(eventTemplateVariables.propertyNames.timeRange, timeRangeString);
      }

      // Handle children events update
      if (eventData.children !== undefined) {
        logger.info(`Updating children events for event ID: ${eventId}`);
        await this.updateChildrenProperty(builder, eventData.children, codeBuilder);
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

      try {
        await worldStateFileManager.addEventToWorldState(eventId, eventFilePath);
      } catch (worldStateError) {
        const errorMessage = `Event '${eventId}' was created and added to register, but failed to add to world state: ${worldStateError instanceof Error ? worldStateError.message : String(worldStateError)}`;
        config.editorAdapter.showWarningNotification(errorMessage);
        console.error(errorMessage, worldStateError);
      }

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

  /**
   * Updates the children property of an event
   * @param builder The TypeScript object builder for the event
   * @param children Array of child events
   * @param codeBuilder The main code builder for import management
   */
  private async updateChildrenProperty(
    builder: TypeScriptObjectBuilder,
    children: TChildEvent[],
    codeBuilder: TypeScriptCodeBuilder
  ): Promise<void> {
    if (children.length === 0) {
      // Set empty array if no children
      builder.setPropertyValue('children', '[]');
      return;
    }

    // Build the children array structure
    const childrenArray: any[] = [];

    for (const child of children) {
      // Validate that the child event exists
      const childEventPath = getEventFilePath(child.eventId);
      if (!config.fileSystem.existsSync(childEventPath)) {
        throw new Error(`Child event '${child.eventId}' does not exist at ${childEventPath}`);
      }

      // Add import for the child event
      const importName = `${child.eventId}Event`;
      const importPath = `../${child.eventId}/${child.eventId}.event`;

      // Add the import using the code builder's import manager
      const importManager = codeBuilder.getImportManager();
      importManager.addNamedImport(importName, importPath);

      // Create the child object
      const childObject = {
        condition: new CodeLiteral(`'${child.condition.replace(/'/g, "\\'")}'`),
        event: new CodeLiteral(importName)
      };

      childrenArray.push(childObject);
    }

    // Convert the children array to string representation
    const childrenString = this.objectConverter.convert(childrenArray);
    builder.setPropertyValue('children', childrenString);
  }
}

export const eventManager = new EventManager();