## Browser game kit 0.3.4

Updates the optional local documentation MCP to SDK 1.32.2 and Zod 4.6.7 and refreshes vulnerable transitive dependencies. Adds the M8ven publisher-verification badge.

The MCP still exposes only three read-only documentation tools over local stdio. Account integration and reviewed production access are unchanged.

Download the ZIP, extract it, and follow README.md. Existing users should run `npm --prefix mcp ci --ignore-scripts` after updating.

Validation: root tests, agent installer tests, MCP schema and stdio protocol tests, dependency audit, and extracted-release smoke check.
