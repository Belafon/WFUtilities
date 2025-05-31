

export class CreatePassageScreen {
  constructor(
    public passageId: string,
    public title: string,
    public description: string,
    public nextPassageId?: string
  ) {}

  // Method to create a screen passage
  static create(passageData: CreatePassageScreen): CreatePassageScreen {
    return new CreatePassageScreen(
      passageData.passageId,
      passageData.title,
      passageData.description,
      passageData.nextPassageId
    );
  }
}