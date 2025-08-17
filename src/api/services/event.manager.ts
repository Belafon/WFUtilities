import path from 'path';
import { ChapterUpdateRequest, SetTimeRequest, TimeRange, TChildChapter } from '../../types';
import { chaptersDir, chapterFilePostfix, getChapterFilePath } from '../../Paths';
import { TypeScriptCodeBuilder } from '../../typescriptObjectParser/ObjectParser';
import { TypeScriptObjectBuilder } from "../../typescriptObjectParser/TypeScriptObjectBuilder";
import { CodeLiteral, ObjectToStringConverter } from '../../utils/objectToStringConverter';
import { config } from '../../WFServerConfig';
import { logger } from '../../utils/logger';
import { templateManager } from '../../templates/TemplateManager';
import { registerFileManager } from '../../register/RegisterFileManager';
import { ChapterTemplateVariables } from '../../templates/chapter.template';
import { worldStateFileManager } from '../../register/WorldStateFileManager';
import { isoTimeConverter as IsoTimeConverter } from '../../utils/IsoTimeConverter';

/**
 * Chapter Manager Service
 * Handles business logic for chapter operations
 */
export class ChapterManager {
  private objectConverter: ObjectToStringConverter;

  constructor() {
    this.objectConverter = new ObjectToStringConverter('  '); // Default indent unit: 2 spaces
  }

  /**
   * Updates an chapter with the provided data.
   * Assumes that if a field is present in chapterData, it should be updated.
   * If a field is undefined in chapterData, it's left unchanged in the file.
   * @param chapterId The ID of the chapter to update (e.g., 'kingdom')
   * @param chapterData The data to update the chapter with.
   */
  public async updateChapter(chapterId: string, chapterData: ChapterUpdateRequest): Promise<void> {
    if (!chapterId || chapterId.trim() === '') {
      logger.error('Chapter ID cannot be empty.');
      const errorMessage = 'Chapter ID cannot be empty.';
      config.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }
    logger.info(`Updating chapter with ID: ${chapterId}`);

    const chapterFilePath = getChapterFilePath(chapterId);
    logger.info(`Chapter file path resolved to: ${chapterFilePath}`);

    let chapterFileContent: string | null = null;
    if (!config.fileSystem.existsSync(chapterFilePath)) {
      logger.info(`Chapter file not found at ${chapterFilePath}, creating new chapter.`);
      // create new chapter
      chapterFileContent = await this.createNewChapter(chapterId, chapterFileContent, chapterFilePath);
      logger.info(`New chapter file created at ${chapterFilePath}`);
    }

    try {
      if (chapterFileContent === null) {
        chapterFileContent = config.fileSystem.readFileSync(chapterFilePath, 'utf-8');
      }

      // convert time range from ISO to app format
      let convertedTimeRange: { start?: string; end?: string } | undefined;
      if (chapterData.timeRange) {
        convertedTimeRange = IsoTimeConverter.convertTimeRangeFromIso(chapterData.timeRange);
        logger.info(`Converted time range from ISO to app format:`, {
          original: chapterData.timeRange,
          converted: convertedTimeRange
        });
      }

      const chapterTemplateVariables = new ChapterTemplateVariables(
        chapterId,
        chapterData.title || '',
        chapterData.description || '',
        chapterData.location || 'village',
        convertedTimeRange?.start || '0.0. 0:00',
        convertedTimeRange?.end || '0.0. 0:00'
      );
      logger.info(`Chapter template variables created for chapter ID: ${chapterId}`, chapterTemplateVariables);
      logger.info(`Chapter file content length: ${chapterFileContent.length} characters`);
      logger.info(`Chapter chapterId: ${chapterTemplateVariables.chapterId}`);
      logger.info(`Chapter title: ${chapterTemplateVariables.title}`);
      logger.info(`Chapter description: ${chapterTemplateVariables.description}`);
      logger.info(`Chapter location: ${chapterTemplateVariables.location}`);
      logger.info(`Chapter timeStart: ${chapterTemplateVariables.timeStart}`);
      logger.info(`Chapter timeEnd: ${chapterTemplateVariables.timeEnd}`);

      const codeBuilder = new TypeScriptCodeBuilder(chapterFileContent);
      const chapterObjectName = chapterTemplateVariables.mainChapterFunction;
      let chapterObjectBuilder: TypeScriptObjectBuilder | null = null;

      codeBuilder.findObject(chapterObjectName, {
        onFound: (objBuilder: TypeScriptObjectBuilder) => {
          logger.info(`Found chapter object builder for '${chapterObjectName}'`);
          chapterObjectBuilder = objBuilder;
        },
        onNotFound: () => {
          logger.error(`Could not find chapter object builder for '${chapterObjectName}'`);
        }
      });

      if (!chapterObjectBuilder) {
        const errorMessage = `Could not find chapter object definition for '${chapterObjectName}' in ${chapterFilePath}`;
        config.editorAdapter.showErrorNotification(errorMessage);
        throw new Error(errorMessage);
      }

      const builder = chapterObjectBuilder as TypeScriptObjectBuilder;

      if (chapterData.title !== undefined) {
        logger.info(`Setting chapter title to: ${chapterData.title}`);
        builder.setPropertyValue(
          chapterTemplateVariables.propertyNames.title,
          this.formatStringForI18nCode(chapterData.title)
        );
      }

      if (chapterData.description !== undefined) {
        logger.info(`Setting chapter description to: ${chapterData.description}`);
        builder.setPropertyValue(
          chapterTemplateVariables.propertyNames.description,
          this.formatStringForI18nCode(chapterData.description)
        );
      }

      if (chapterData.location !== undefined) {
        logger.info(`Setting chapter location to: ${chapterData.location}`);
        builder.setPropertyValue(
          chapterTemplateVariables.propertyNames.location,
          chapterTemplateVariables.quotedLocation
        );
      }

      if (chapterData.timeRange !== undefined) {
        logger.info(`Setting chapter time range to: ${JSON.stringify(chapterData.timeRange)}`);
        const timeRangeObject = {
          start: new CodeLiteral(`Time.fromString(${chapterTemplateVariables.quotedTimeStart})`),
          end: new CodeLiteral(`Time.fromString(${chapterTemplateVariables.quotedTimeEnd})`)
        };
        logger.info(`Setting chapter time range to: ${JSON.stringify(timeRangeObject)}`);
        const timeRangeString = this.objectConverter.convert(timeRangeObject);
        logger.info(`Formatted time range string: ${timeRangeString}`);
        builder.setPropertyValue(chapterTemplateVariables.propertyNames.timeRange, timeRangeString);
      }

      // Handle children chapters update
      if (chapterData.children !== undefined) {
        logger.info(`Updating children chapters for chapter ID: ${chapterId}`);
        await this.updateChildrenProperty(builder, chapterData.children, codeBuilder);
      }

      const updatedContent = await codeBuilder.toString();
      config.fileSystem.writeFileSync(chapterFilePath, updatedContent, 'utf-8');
      config.editorAdapter.showInformationNotification(`Chapter '${chapterId}' updated successfully.`);
      console.log(`Chapter '${chapterId}' updated successfully in ${chapterFilePath}`);

    } catch (error) {
      const errorMessage = `Failed to update chapter '${chapterId}': ${error instanceof Error ? error.message : String(error)}`;
      config.editorAdapter.showErrorNotification(errorMessage);
      console.error(errorMessage, error);
      throw error;
    }
  }

  private async createNewChapter(chapterId: string, chapterFileContent: string | null, chapterFilePath: string) {
    try {
      // create chapter file from template
      const templateGenerationOutput = await templateManager.generateAndSaveChapter({
        chapterId: chapterId,
      });
      if (!templateGenerationOutput.success) {
        const errorMessage = `Failed to create new chapter file for '${chapterId}': ${templateGenerationOutput.error}`;
        config.editorAdapter.showErrorNotification(errorMessage);
        throw new Error(errorMessage);
      }

      chapterFileContent = templateGenerationOutput.content;

      // add chapterPassages file from template
      const chapterPassagesFileGenerationOutput = await templateManager.generateAndSaveChapterPassages({
        chapterId: chapterId
      });
      if (!chapterPassagesFileGenerationOutput.success) {
        const errorMessage = `Failed to create new chapter passages file for '${chapterId}': ${chapterPassagesFileGenerationOutput.error}`;
        config.editorAdapter.showErrorNotification(errorMessage);
        throw new Error(errorMessage);
      }

      // add chapter to register
      await registerFileManager.addChapterToRegister(chapterId, chapterFilePath);

      try {
        await worldStateFileManager.addChapterToWorldState(chapterId, chapterFilePath);
      } catch (worldStateError) {
        const errorMessage = `Chapter '${chapterId}' was created and added to register, but failed to add to world state: ${worldStateError instanceof Error ? worldStateError.message : String(worldStateError)}`;
        config.editorAdapter.showWarningNotification(errorMessage);
        console.error(errorMessage, worldStateError);
      }

      return chapterFileContent;
    } catch (error) {
      this.deleteChapter(chapterId).catch((err) => {
        console.error(`Failed to rollback chapter deletion for '${chapterId}':`, err);
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
   * Deletes an chapter file.
   * @param chapterId The ID of the chapter to delete.
   */
  public async deleteChapter(chapterId: string): Promise<void> {
    if (!chapterId || chapterId.trim() === '') {
      const errorMessage = 'Chapter ID cannot be empty for deletion.';
      config.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }

    const chapterFilePath = getChapterFilePath(chapterId);

    if (!config.fileSystem.existsSync(chapterFilePath)) {
      const errorMessage = `Chapter file to delete not found at ${chapterFilePath}`;
      config.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      config.fileSystem.unlinkSync(chapterFilePath);
      config.editorAdapter.showInformationNotification(`Chapter file ${chapterFilePath} deleted successfully.`);
      console.log(`Chapter file ${chapterFilePath} deleted successfully.`);
    } catch (error) {
      const errorMessageText = `Failed to delete chapter file ${chapterFilePath}: ${error instanceof Error ? error.message : String(error)}`;
      config.editorAdapter.showErrorNotification(errorMessageText);
      console.error(`Error deleting chapter file ${chapterFilePath}:`, error);
      throw error;
    }
  }

  /**
   * Opens an chapter file in the configured editor.
   * @param chapterId The ID of the chapter to open.
   */
  public async openChapter(chapterId: string): Promise<void> {
    logger.info(`Attempting to open chapter with ID: ${chapterId}`);
    if (!chapterId || chapterId.trim() === '') {
      logger.error('Chapter ID cannot be empty for opening.');
      const errorMessage = 'Chapter ID cannot be empty for opening.';
      config.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }

    const chapterFilePath = getChapterFilePath(chapterId);
    logger.info(`Chapter file path resolved to: ${chapterFilePath}`);

    if (!config.fileSystem.existsSync(chapterFilePath)) {
      const errorMessage = `Chapter file to open not found at ${chapterFilePath}`;
      config.editorAdapter.showErrorNotification(errorMessage);
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      await config.editorAdapter.openFile(chapterFilePath);
      logger.info(`Chapter file ${chapterFilePath} opened successfully.`);
      console.log(`Attempted to open chapter file: ${chapterFilePath}`);
    } catch (error) {
      logger.error(`Failed to open chapter file ${chapterFilePath}:`, error);
      let detailMessage = '';
      if (error instanceof Error) {
        detailMessage = (error as Error).message || (error as any).name || String(error); // Prioritize message, then name, then full string
      } else {
        detailMessage = String(error);
      }

      const errorMessageText = `Failed to open chapter file ${chapterFilePath}: ${detailMessage}`;

      config.editorAdapter.showErrorNotification(errorMessageText);
      console.error(`Error opening chapter file ${chapterFilePath}:`, error);
      logger.error(`Error opening chapter file ${chapterFilePath}:`, error);
      throw error;
    }
    logger.info(`Chapter file ${chapterFilePath} opened successfully.`);
  }

  /**
   * Sets the time range for an chapter.
   * @param chapterId The ID of the chapter
   * @param timeRange The time range to set
   */
  public async setChapterTime(chapterId: string, timeRange: SetTimeRequest['timeRange']): Promise<void> {
    if (!timeRange || timeRange.start === undefined || timeRange.end === undefined) {
      const errorMessage = 'Invalid timeRange provided for setChapterTime. Both start and end are required.';
      config.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }
    const chapterUpdateData = { timeRange } as ChapterUpdateRequest;
    await this.updateChapter(chapterId, chapterUpdateData);
    console.log(`Time range for chapter '${chapterId}' set successfully via updateChapter.`);
  }

  /**
   * Updates the children property of an chapter
   * @param builder The TypeScript object builder for the chapter
   * @param children Array of child chapters
   * @param codeBuilder The main code builder for import management
   */
  private async updateChildrenProperty(
    builder: TypeScriptObjectBuilder,
    children: TChildChapter[],
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
      // Validate that the child chapter exists
      const childChapterPath = getChapterFilePath(child.chapterId);
      if (!config.fileSystem.existsSync(childChapterPath)) {
        throw new Error(`Child chapter '${child.chapterId}' does not exist at ${childChapterPath}`);
      }

      // Add import for the child chapter
      const importName = `${child.chapterId}Chapter`;
      const importPath = `../${child.chapterId}/${child.chapterId}.chapter`;

      // Add the import using the code builder's import manager
      const importManager = codeBuilder.getImportManager();
      importManager.addNamedImport(importName, importPath);

      // Create the child object
      const childObject = {
        condition: new CodeLiteral(`'${child.condition.replace(/'/g, "\\'")}'`),
        chapter: new CodeLiteral(importName)
      };

      childrenArray.push(childObject);
    }

    // Convert the children array to string representation
    const childrenString = this.objectConverter.convert(childrenArray);
    builder.setPropertyValue('children', childrenString);
  }
}

export const chapterManager = new ChapterManager();