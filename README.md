openapi: 3.1.0
info:
  title: WorldsFactory API
  version: 1.0.0
  description: API for WorldsFactory VS Code Extension
servers:
  - url: http://localhost:3149
    description: Development server

components:
  schemas:
    TimeRange:
      type: object
      required:
        - start
        - end
      properties:
        start:
          type: string
          description: Date and time in format 'D.M. H:mm'
          example: '2.1. 8:00'
          pattern: '^\d{1,2}\.\d{1,2}\.\s\d{1,2}:\d{2}$'
        end:
          type: string
          description: Date and time in format 'D.M. H:mm'
          example: '5.1. 8:00'
          pattern: '^\d{1,2}\.\d{1,2}\.\s\d{1,2}:\d{2}$'

    EventUpdateRequest:
      type: object
      required:
        - title
        - description
        - location
        - timeRange
      properties:
        title:
          type: string
        description:
          type: string
        location:
          type: string
        timeRange:
          $ref: '#/components/schemas/TimeRange'

    SetTimeRequest:
      type: object
      required:
        - timeRange
      properties:
        timeRange:
          $ref: '#/components/schemas/TimeRange'

    # --- Start of new/updated schemas for PassageUpdateRequest ---
    TLinkCostItem:
      type: object
      required:
        - id
        - amount
      properties:
        id:
          type: string
          description: TItemId
        amount:
          type: number

    TLinkCostObjectUpdateRequest:
      type: object
      properties:
        time: # Simplified DeltaTime for request
          type: object
          properties:
            value:
              type: number
              description: Duration value (e.g., minutes)
            unit:
              type: string
              enum: [min, hour, day]
              description: Unit of time
        items:
          type: array
          items:
            $ref: '#/components/schemas/TLinkCostItem'
        tools:
          type: array
          items:
            type: string # TItemId

    TLinkCostUpdateRequest:
      oneOf:
        - type: object # Simplified DeltaTime representation
          properties:
            value:
              type: number
              description: Duration value (e.g., minutes)
            unit:
              type: string
              enum: [min, hour, day]
              description: Unit of time for DeltaTime
          required:
            - value
            - unit
          description: Represents a simple time cost (DeltaTime).
        - $ref: '#/components/schemas/TLinkCostObjectUpdateRequest'

    TLinkUpdateRequest:
      type: object
      # text and passageId are usually required for a link
      properties:
        text:
          type: string
        passageId:
          type: string # Ids (TPassageId)
        autoPriority:
          type: number
        cost:
          $ref: '#/components/schemas/TLinkCostUpdateRequest'
        # onFinish: function, cannot be updated via JSON

    TPassageScreenBodyItemUpdateRequest:
      type: object
      properties:
        condition:
          type: boolean
          description: Condition for this body part (complex to update directly).
        redirect:
          type: string # Ids (TEventCharacterPassageId)
        text:
          type: string
        links:
          type: array
          items:
            $ref: '#/components/schemas/TLinkUpdateRequest'

    PassageUpdateRequest:
      type: object
      # 'type' indicates which kind of passage this update is for,
      # influencing which other properties are relevant.
      # 'title' is common for screen passages.
      required:
        - type
      properties:
        type:
          type: string
          enum: ['screen', 'linear', 'transition']
          description: The type of the passage being updated. This helps interpret other fields.
        
        # Screen-specific properties
        title: # Also in original minimal spec
          type: string
          description: New title for the screen passage (often an i18n key).
        image:
          type: string
          description: New image path for the screen passage.
        body:
          type: array
          items:
            $ref: '#/components/schemas/TPassageScreenBodyItemUpdateRequest'
          description: Full new body for the screen passage (complex update).
        
        # Linear-specific properties
        description:
          type: string
          description: New description for a linear passage.
        
        # Transition/Linear-specific properties
        nextPassageId:
          type: string
          description: New nextPassageId for a transition or linear passage.
    # --- End of new/updated schemas for PassageUpdateRequest ---

    SuccessResponse:
      type: object
      properties:
        success: 
          type: boolean
        message:
          type: string
      required:
        - success

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
        error:
          type: string
      required:
        - success
        - error

  responses:
    Success:
      description: Operation successful
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/SuccessResponse'
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'

paths:
  /event/{eventId}:
    put:
      summary: Update event details
      parameters:
        - name: eventId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/EventUpdateRequest'
      responses:
        '200':
          $ref: '#/components/responses/Success'
        '404':
          $ref: '#/components/responses/NotFound'
    delete:
      summary: Delete an event
      parameters:
        - name: eventId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          $ref: '#/components/responses/Success'
        '404':
          $ref: '#/components/responses/NotFound'

  /event/{eventId}/open:
    post:
      summary: Open an event in VS Code
      parameters:
        - name: eventId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          $ref: '#/components/responses/Success'
        '404':
          $ref: '#/components/responses/NotFound'

  /event/{eventId}/setTime:
    post:
      summary: Set event time range
      parameters:
        - name: eventId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SetTimeRequest'
      responses:
        '200':
          $ref: '#/components/responses/Success'
        '404':
          $ref: '#/components/responses/NotFound'

  /passage/{passageId}:
    put:
      summary: Update passage details
      parameters:
        - name: passageId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PassageUpdateRequest' # Point to the updated schema
      responses:
        '200':
          $ref: '#/components/responses/Success'
        '404':
          $ref: '#/components/responses/NotFound'
    delete:
      summary: Delete a passage
      parameters:
        - name: passageId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          $ref: '#/components/responses/Success'
        '404':
          $ref: '#/components/responses/NotFound'

  /passage/{passageId}/open:
    post:
      summary: Open a passage file in VS Code
      parameters:
        - name: passageId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          $ref: '#/components/responses/Success'
        '404':
          $ref: '#/components/responses/NotFound'